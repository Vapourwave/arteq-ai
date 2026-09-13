import { describe, expect, it, vi } from "vitest";
import { PhoneCallSession } from "./PhoneCallSession.js";
import type {
  PhoneVoiceTransport,
  PhoneVoiceTransportCallbacks,
} from "./PhoneVoiceTransport.js";
import type {
  VoiceProvider,
  VoiceSession,
  VoiceSessionCallbacks,
} from "../providers/voice/VoiceProvider.js";

const flush = () => new Promise<void>((r) => setImmediate(r));

class FakeTransport implements PhoneVoiceTransport {
  cb: PhoneVoiceTransportCallbacks | null = null;
  sent: string[] = [];
  clears = 0;
  closes = 0;

  start(cb: PhoneVoiceTransportCallbacks): void {
    this.cb = cb;
  }
  sendCallerAudio(b64: string): void {
    this.sent.push(b64);
  }
  clearCallerAudio(): void {
    this.clears++;
  }
  close(): void {
    this.closes++;
  }

  emitStart(customParameters: Record<string, string> = {}): void {
    this.cb?.onStart({ streamId: "MZ1", callId: "CA1", customParameters });
  }
  emitCallerAudio(b64: string): void {
    this.cb?.onCallerAudio(b64);
  }
  emitStop(): void {
    this.cb?.onStop();
  }
  emitClose(): void {
    this.cb?.onClose();
  }
}

class FakeVoiceSession implements VoiceSession {
  chunks: string[] = [];
  stopCalls = 0;
  sendAudioChunk(b64: string): void {
    this.chunks.push(b64);
  }
  stop(): void {
    this.stopCalls++;
  }
}

class FakeVoiceProvider implements VoiceProvider {
  readonly name = "fake";
  configured = true;
  session = new FakeVoiceSession();
  lastCallbacks: VoiceSessionCallbacks | null = null;
  startCalls = 0;
  /** When true, startSession() blocks until resolveStart() is called. */
  deferStart = false;
  private release: (() => void) | null = null;

  isConfigured(): boolean {
    return this.configured;
  }
  async startSession(cb: VoiceSessionCallbacks): Promise<VoiceSession> {
    this.startCalls++;
    this.lastCallbacks = cb;
    if (this.deferStart) {
      await new Promise<void>((r) => {
        this.release = r;
      });
    }
    return this.session;
  }
  resolveStart(): void {
    this.release?.();
    this.release = null;
  }
}

/** One µ-law frame as base64 (silence bytes — content doesn't matter here). */
const MULAW_FRAME = Buffer.alloc(160, 0xff).toString("base64");
/** One core assistant PCM16 LE @ 24kHz chunk as base64. */
const CORE_CHUNK = (() => {
  const bytes = new Uint8Array(480 * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < 480; i++) view.setInt16(i * 2, Math.round(Math.sin(i / 7) * 9000), true);
  return Buffer.from(bytes).toString("base64");
})();

describe("PhoneCallSession — phone transport <-> receptionist voice core", () => {
  it("rejects the call and closes the transport when the voice provider is unconfigured", () => {
    const provider = new FakeVoiceProvider();
    provider.configured = false;
    const transport = new FakeTransport();

    new PhoneCallSession(transport, provider, { log: vi.fn() }).begin();

    expect(provider.startCalls).toBe(0);
    expect(transport.closes).toBe(1);
  });

  it("starts a core voice session when the stream starts", async () => {
    const provider = new FakeVoiceProvider();
    const transport = new FakeTransport();
    new PhoneCallSession(transport, provider, { log: vi.fn() }).begin();

    transport.emitStart();
    await flush();

    expect(provider.startCalls).toBe(1);
  });

  it("rejects the stream when the shared secret does not match", async () => {
    const provider = new FakeVoiceProvider();
    const transport = new FakeTransport();
    new PhoneCallSession(transport, provider, {
      expectedStreamSecret: "right",
      log: vi.fn(),
    }).begin();

    transport.emitStart({ secret: "wrong" });
    await flush();

    expect(provider.startCalls).toBe(0);
    expect(transport.closes).toBe(1);
  });

  it("accepts the stream when the shared secret matches", async () => {
    const provider = new FakeVoiceProvider();
    const transport = new FakeTransport();
    new PhoneCallSession(transport, provider, {
      expectedStreamSecret: "right",
      log: vi.fn(),
    }).begin();

    transport.emitStart({ secret: "right" });
    await flush();

    expect(provider.startCalls).toBe(1);
    expect(transport.closes).toBe(0);
  });

  it("converts caller µ-law frames and forwards them to the core as PCM16 chunks", async () => {
    const provider = new FakeVoiceProvider();
    const transport = new FakeTransport();
    new PhoneCallSession(transport, provider, { log: vi.fn() }).begin();
    transport.emitStart();
    await flush();

    transport.emitCallerAudio(MULAW_FRAME);

    expect(provider.session.chunks).toHaveLength(1);
    const forwarded = Buffer.from(provider.session.chunks[0], "base64");
    // 160 µ-law samples @ 8kHz -> ~320 PCM16 samples @ 16kHz -> ~640 bytes.
    expect(forwarded.length).toBeGreaterThan(560);
    expect(forwarded.length % 2).toBe(0);
  });

  it("ignores caller audio that arrives before the core session is ready", () => {
    const provider = new FakeVoiceProvider();
    const transport = new FakeTransport();
    new PhoneCallSession(transport, provider, { log: vi.fn() }).begin();
    transport.emitStart(); // not awaited — session not created yet

    expect(() => transport.emitCallerAudio(MULAW_FRAME)).not.toThrow();
    expect(provider.session.chunks).toHaveLength(0);
  });

  it("converts assistant audio chunks and sends them to the caller as µ-law", async () => {
    const provider = new FakeVoiceProvider();
    const transport = new FakeTransport();
    new PhoneCallSession(transport, provider, { log: vi.fn() }).begin();
    transport.emitStart();
    await flush();

    provider.lastCallbacks!.onAssistantAudioChunk(CORE_CHUNK);

    expect(transport.sent).toHaveLength(1);
    const muLaw = Buffer.from(transport.sent[0], "base64");
    // 480 PCM16 @ 24kHz -> ~160 µ-law bytes @ 8kHz.
    expect(muLaw.length).toBeGreaterThan(150);
    expect(muLaw.length).toBeLessThan(170);
  });

  it("on barge-in: clears caller-bound audio and keeps working afterwards", async () => {
    const provider = new FakeVoiceProvider();
    const transport = new FakeTransport();
    new PhoneCallSession(transport, provider, { log: vi.fn() }).begin();
    transport.emitStart();
    await flush();

    provider.lastCallbacks!.onInterrupted();
    expect(transport.clears).toBe(1);

    // Still forwards audio after the interruption.
    provider.lastCallbacks!.onAssistantAudioChunk(CORE_CHUNK);
    expect(transport.sent).toHaveLength(1);
  });

  it("on hangup: stops the core session once and closes the transport, idempotently", async () => {
    const provider = new FakeVoiceProvider();
    const transport = new FakeTransport();
    new PhoneCallSession(transport, provider, { log: vi.fn() }).begin();
    transport.emitStart();
    await flush();

    transport.emitStop();
    transport.emitClose(); // socket close follows the stop event

    expect(provider.session.stopCalls).toBe(1);
    expect(transport.closes).toBe(1);
  });

  it("tears down when the core voice provider reports an error", async () => {
    const provider = new FakeVoiceProvider();
    const transport = new FakeTransport();
    new PhoneCallSession(transport, provider, { log: vi.fn() }).begin();
    transport.emitStart();
    await flush();

    provider.lastCallbacks!.onError("gemini live 503");

    expect(provider.session.stopCalls).toBe(1);
    expect(transport.closes).toBe(1);
  });

  it("does not leak a core session when the caller hangs up mid-connect", async () => {
    const provider = new FakeVoiceProvider();
    provider.deferStart = true;
    const transport = new FakeTransport();
    new PhoneCallSession(transport, provider, { log: vi.fn() }).begin();

    transport.emitStart();
    await flush(); // startSession is now awaiting inside handleStart
    expect(provider.startCalls).toBe(1);

    transport.emitStop(); // hangup before the provider session resolves
    transport.emitClose();
    provider.resolveStart(); // provider connection finally completes
    await flush();

    // The now-resolved session must be stopped, not left dangling.
    expect(provider.session.stopCalls).toBe(1);
    expect(transport.closes).toBe(1);
  });

  it("stops forwarding caller audio once torn down", async () => {
    const provider = new FakeVoiceProvider();
    const transport = new FakeTransport();
    new PhoneCallSession(transport, provider, { log: vi.fn() }).begin();
    transport.emitStart();
    await flush();

    transport.emitStop();
    transport.emitCallerAudio(MULAW_FRAME);

    expect(provider.session.chunks).toHaveLength(0);
  });
});
