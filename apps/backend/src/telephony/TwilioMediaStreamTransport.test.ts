import { beforeEach, describe, expect, it } from "vitest";
import {
  TwilioMediaStreamTransport,
  type TwilioSocket,
} from "./TwilioMediaStreamTransport.js";
import type { PhoneVoiceTransportCallbacks } from "./PhoneVoiceTransport.js";

class FakeTwilioSocket implements TwilioSocket {
  readonly OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  closed = false;
  private listeners: Record<string, Array<(...a: any[]) => void>> = {};

  on(event: string, listener: (...a: any[]) => void): void {
    (this.listeners[event] ??= []).push(listener);
  }
  emit(event: string, ...args: any[]): void {
    for (const l of this.listeners[event] ?? []) l(...args);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
    this.emit("close");
  }

  /** Convenience: emit a JSON Twilio frame. */
  recv(obj: unknown): void {
    this.emit("message", JSON.stringify(obj));
  }
  sentEvents(): Array<Record<string, any>> {
    return this.sent.map((s) => JSON.parse(s));
  }
}

function makeCallbacks(): PhoneVoiceTransportCallbacks & {
  starts: any[];
  audio: string[];
  dtmf: string[];
  stops: number;
  closes: number;
  errors: string[];
} {
  const rec = {
    starts: [] as any[],
    audio: [] as string[],
    dtmf: [] as string[],
    stops: 0,
    closes: 0,
    errors: [] as string[],
    onStart(meta: any) {
      rec.starts.push(meta);
    },
    onCallerAudio(b64: string) {
      rec.audio.push(b64);
    },
    onDtmf(d: string) {
      rec.dtmf.push(d);
    },
    onStop() {
      rec.stops++;
    },
    onClose() {
      rec.closes++;
    },
    onError(m: string) {
      rec.errors.push(m);
    },
  };
  return rec;
}

const START_FRAME = {
  event: "start",
  streamSid: "MZ0000000000000000000000000000aa",
  start: {
    streamSid: "MZ0000000000000000000000000000aa",
    callSid: "CA0000000000000000000000000000bb",
    accountSid: "AC0000000000000000000000000000cc",
    tracks: ["inbound"],
    mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
    customParameters: { secret: "s3cr3t" },
  },
};

describe("TwilioMediaStreamTransport — inbound events", () => {
  let socket: FakeTwilioSocket;
  let cb: ReturnType<typeof makeCallbacks>;
  let transport: TwilioMediaStreamTransport;

  beforeEach(() => {
    socket = new FakeTwilioSocket();
    cb = makeCallbacks();
    transport = new TwilioMediaStreamTransport(socket);
    transport.start(cb);
  });

  it("ignores the `connected` handshake frame", () => {
    socket.recv({ event: "connected", protocol: "Call", version: "1.0.0" });
    expect(cb.starts).toHaveLength(0);
    expect(cb.errors).toHaveLength(0);
  });

  it("maps `start` to onStart with streamId, callId and customParameters", () => {
    socket.recv(START_FRAME);
    expect(cb.starts).toHaveLength(1);
    expect(cb.starts[0]).toEqual({
      streamId: "MZ0000000000000000000000000000aa",
      callId: "CA0000000000000000000000000000bb",
      customParameters: { secret: "s3cr3t" },
    });
  });

  it("errors (no crash) on a `start` with no streamSid anywhere", () => {
    socket.recv({ event: "start", start: { callSid: "CA1" } });
    expect(cb.starts).toHaveLength(0);
    expect(cb.errors.join()).toMatch(/streamSid/i);
  });

  it("maps `media` to onCallerAudio with the raw base64 payload", () => {
    socket.recv(START_FRAME);
    socket.recv({
      event: "media",
      media: { track: "inbound", chunk: "1", timestamp: "20", payload: "AP8A/w==" },
      streamSid: START_FRAME.streamSid,
    });
    expect(cb.audio).toEqual(["AP8A/w=="]);
  });

  it("drops a `media` frame with an empty payload", () => {
    socket.recv(START_FRAME);
    socket.recv({ event: "media", media: { payload: "" }, streamSid: START_FRAME.streamSid });
    expect(cb.audio).toHaveLength(0);
  });

  it("maps `dtmf` to onDtmf", () => {
    socket.recv(START_FRAME);
    socket.recv({ event: "dtmf", dtmf: { track: "inbound_track", digit: "5" }, streamSid: START_FRAME.streamSid });
    expect(cb.dtmf).toEqual(["5"]);
  });

  it("accepts a `mark` acknowledgement silently", () => {
    socket.recv(START_FRAME);
    socket.recv({ event: "mark", mark: { name: "greeting" }, streamSid: START_FRAME.streamSid });
    expect(cb.errors).toHaveLength(0);
  });

  it("maps `stop` to onStop and records the hangup", () => {
    socket.recv(START_FRAME);
    socket.recv({ event: "stop", stop: { callSid: "CA1", accountSid: "AC1" }, streamSid: START_FRAME.streamSid });
    expect(cb.stops).toBe(1);
    expect(transport.hangupReceived).toBe(true);
  });

  it("does not throw on malformed (non-JSON) frames, reports an error instead", () => {
    expect(() => socket.emit("message", "not json at all {{{")).not.toThrow();
    expect(cb.errors.join()).toMatch(/malformed/i);
  });

  it("ignores unknown event types forward-compatibly (error, no crash)", () => {
    socket.recv(START_FRAME);
    expect(() => socket.recv({ event: "someFutureEvent", streamSid: START_FRAME.streamSid })).not.toThrow();
    expect(cb.errors.join()).toMatch(/unknown twilio event/i);
  });

  it("fires onClose exactly once when the socket closes", () => {
    socket.recv(START_FRAME);
    socket.close();
    socket.close();
    expect(cb.closes).toBe(1);
  });

  it("surfaces socket errors via onError", () => {
    socket.emit("error", new Error("ECONNRESET"));
    expect(cb.errors).toContain("ECONNRESET");
  });
});

describe("TwilioMediaStreamTransport — outbound audio", () => {
  let socket: FakeTwilioSocket;
  let transport: TwilioMediaStreamTransport;

  beforeEach(() => {
    socket = new FakeTwilioSocket();
    transport = new TwilioMediaStreamTransport(socket);
    transport.start(makeCallbacks());
    socket.recv(START_FRAME);
  });

  it("does not send audio before `start` (no streamSid yet)", () => {
    const fresh = new FakeTwilioSocket();
    const t = new TwilioMediaStreamTransport(fresh);
    t.start(makeCallbacks());
    t.sendCallerAudio(Buffer.alloc(320, 0x7f).toString("base64"));
    expect(fresh.sent).toHaveLength(0);
  });

  it("re-frames outbound audio into 160-byte media frames carrying the streamSid", () => {
    transport.sendCallerAudio(Buffer.alloc(320, 0x7f).toString("base64"));
    const media = socket.sentEvents().filter((m) => m.event === "media");
    expect(media).toHaveLength(2);
    for (const m of media) {
      expect(m.streamSid).toBe(START_FRAME.streamSid);
      expect(Object.keys(m.media)).toEqual(["payload"]); // no header/extra fields
      expect(Buffer.from(m.media.payload, "base64").length).toBe(160);
    }
  });

  it("buffers a sub-frame remainder and flushes it once enough bytes arrive", () => {
    transport.sendCallerAudio(Buffer.alloc(100, 0x7f).toString("base64"));
    expect(socket.sentEvents().filter((m) => m.event === "media")).toHaveLength(0);

    transport.sendCallerAudio(Buffer.alloc(80, 0x7f).toString("base64")); // now 180 buffered
    const media = socket.sentEvents().filter((m) => m.event === "media");
    expect(media).toHaveLength(1);
    expect(Buffer.from(media[0].media.payload, "base64").length).toBe(160);
  });

  it("clearCallerAudio() sends a `clear` control frame and drops the buffered remainder", () => {
    transport.sendCallerAudio(Buffer.alloc(100, 0x7f).toString("base64")); // 100 buffered
    transport.clearCallerAudio();

    const events = socket.sentEvents();
    expect(events.at(-1)).toEqual({ event: "clear", streamSid: START_FRAME.streamSid });

    // The 100 buffered bytes were dropped: adding 60 more must NOT now flush 160.
    transport.sendCallerAudio(Buffer.alloc(60, 0x7f).toString("base64"));
    expect(socket.sentEvents().filter((m) => m.event === "media")).toHaveLength(0);
  });

  it("stops sending after close()", () => {
    transport.close();
    transport.sendCallerAudio(Buffer.alloc(320, 0x7f).toString("base64"));
    expect(socket.sentEvents().filter((m) => m.event === "media")).toHaveLength(0);
    expect(socket.closed).toBe(true);
  });

  it("does not send when the socket is not OPEN", () => {
    socket.readyState = 3; // CLOSED
    transport.sendCallerAudio(Buffer.alloc(320, 0x7f).toString("base64"));
    expect(socket.sent).toHaveLength(0);
  });
});
