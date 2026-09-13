import type {
  PhoneCallMeta,
  PhoneVoiceTransport,
  PhoneVoiceTransportCallbacks,
} from "./PhoneVoiceTransport.js";

/**
 * Twilio Media Streams implementation of PhoneVoiceTransport.
 *
 * Wire protocol (verified against Twilio's current "Media Streams —
 * WebSocket Messages" docs, 2026): a bidirectional `<Connect><Stream>` WS.
 *   Inbound  (Twilio -> us): connected | start | media | dtmf | mark | stop
 *   Outbound (us -> Twilio): media | mark | clear
 * All audio payloads are base64 `audio/x-mulaw` @ 8000 Hz, mono, with NO
 * container/header bytes. Every outbound frame must carry the `streamSid`
 * from the `start` event.
 *
 * This is the ONLY file that knows any of that. Everything Twilio-specific
 * — event names, streamSid/callSid, the `clear` control message, the
 * customParameters shared-secret — is contained here (CLAUDE.md §8).
 */

/** Minimal surface of a `ws` WebSocket — narrowed so tests can pass a mock. */
export interface TwilioSocket {
  on(event: "message", listener: (data: unknown) => void): void;
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  send(data: string): void;
  close(): void;
  readyState: number;
  readonly OPEN: number;
}

// 20 ms of µ-law @ 8 kHz. Twilio plays whatever size it's given, but
// re-framing to small, regular frames keeps `clear` (barge-in) responsive
// and matches Twilio's own guidance.
const OUTBOUND_FRAME_BYTES = 160;

export class TwilioMediaStreamTransport implements PhoneVoiceTransport {
  private callbacks: PhoneVoiceTransportCallbacks | null = null;
  private streamSid: string | null = null;
  private outboundRemainder = Buffer.alloc(0);
  private closed = false;
  private stopSeen = false;

  constructor(private readonly socket: TwilioSocket) {}

  start(callbacks: PhoneVoiceTransportCallbacks): void {
    this.callbacks = callbacks;

    this.socket.on("message", (data) => this.handleMessage(data));
    this.socket.on("error", (err) => {
      this.callbacks?.onError(err?.message ?? "Twilio media stream socket error");
    });
    this.socket.on("close", () => {
      if (this.closed) return;
      this.closed = true;
      this.callbacks?.onClose();
    });
  }

  private handleMessage(data: unknown): void {
    let event: TwilioInboundEvent;
    try {
      event = JSON.parse(typeof data === "string" ? data : String(data));
    } catch {
      // Malformed frame — ignore, never throw out of the socket handler.
      this.callbacks?.onError("Malformed Twilio frame (not JSON)");
      return;
    }
    if (!event || typeof event.event !== "string") {
      this.callbacks?.onError("Twilio frame missing `event`");
      return;
    }

    switch (event.event) {
      case "connected":
        // Handshake only; nothing to do until `start`.
        break;

      case "start": {
        const start = event.start ?? ({} as NonNullable<TwilioInboundEvent["start"]>);
        this.streamSid = event.streamSid ?? start.streamSid ?? null;
        if (!this.streamSid) {
          this.callbacks?.onError("Twilio `start` without streamSid");
          return;
        }
        const meta: PhoneCallMeta = {
          streamId: this.streamSid,
          callId: start.callSid ?? "unknown",
          customParameters: start.customParameters ?? {},
        };
        this.callbacks?.onStart(meta);
        break;
      }

      case "media": {
        const payload = event.media?.payload;
        if (typeof payload === "string" && payload.length > 0) {
          this.callbacks?.onCallerAudio(payload);
        }
        break;
      }

      case "dtmf": {
        const digit = event.dtmf?.digit;
        if (typeof digit === "string") this.callbacks?.onDtmf(digit);
        break;
      }

      case "mark":
        // Playback-complete acknowledgement for a mark we sent. The vertical
        // slice doesn't gate on marks; accepted silently.
        break;

      case "stop":
        this.stopSeen = true;
        this.callbacks?.onStop();
        break;

      default:
        // Unknown event type — forward-compatible: ignore, don't crash.
        this.callbacks?.onError(`Unknown Twilio event: ${event.event}`);
    }
  }

  sendCallerAudio(muLawBase64: string): void {
    if (this.closed || !this.streamSid) return;
    const incoming = Buffer.from(muLawBase64, "base64");
    let buf = this.outboundRemainder.length
      ? Buffer.concat([this.outboundRemainder, incoming])
      : incoming;

    let offset = 0;
    while (buf.length - offset >= OUTBOUND_FRAME_BYTES) {
      const frame = buf.subarray(offset, offset + OUTBOUND_FRAME_BYTES);
      this.sendRaw({
        event: "media",
        streamSid: this.streamSid,
        media: { payload: frame.toString("base64") },
      });
      offset += OUTBOUND_FRAME_BYTES;
    }
    this.outboundRemainder = buf.subarray(offset);
  }

  clearCallerAudio(): void {
    // Drop our own not-yet-sent tail, then tell Twilio to empty its buffer.
    this.outboundRemainder = Buffer.alloc(0);
    if (this.closed || !this.streamSid) return;
    this.sendRaw({ event: "clear", streamSid: this.streamSid });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.outboundRemainder = Buffer.alloc(0);
    try {
      this.socket.close();
    } catch {
      // already closing
    }
  }

  /** True once a Twilio `stop` event has been observed (caller hung up). */
  get hangupReceived(): boolean {
    return this.stopSeen;
  }

  private sendRaw(message: TwilioOutboundEvent): void {
    if (this.socket.readyState !== this.socket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }
}

// ---- Twilio wire shapes (only the fields we read) --------------------------

interface TwilioInboundEvent {
  event: string;
  streamSid?: string;
  start?: {
    streamSid?: string;
    callSid?: string;
    accountSid?: string;
    customParameters?: Record<string, string>;
  };
  media?: { payload?: string; track?: string };
  dtmf?: { digit?: string };
  mark?: { name?: string };
}

type TwilioOutboundEvent =
  | { event: "media"; streamSid: string; media: { payload: string } }
  | { event: "mark"; streamSid: string; mark: { name: string } }
  | { event: "clear"; streamSid: string };
