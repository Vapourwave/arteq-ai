import { describe, expect, it } from "vitest";
import { TelephonyAudioAdapter } from "./TelephonyAudioAdapter.js";
import { muLawDecode, muLawEncode } from "./audio/mulaw.js";

/** base64 -> Int16Array, respecting the Buffer's offset (Node may pool). */
function pcm16(b64: string): Int16Array {
  const buf = Buffer.from(b64, "base64");
  return new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2));
}

/** One inbound Twilio media payload: `n` samples of a mid-level tone as µ-law. */
function muLawFrame(n: number): string {
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) pcm[i] = Math.round(Math.sin(i / 5) * 8000);
  return Buffer.from(muLawEncode(pcm)).toString("base64");
}

/** One Gemini Live assistant-audio chunk: `n` samples of PCM16 LE @ 24kHz. */
function corePcmChunk(n: number): string {
  const bytes = new Uint8Array(n * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < n; i++) view.setInt16(i * 2, Math.round(Math.sin(i / 9) * 10000), true);
  return Buffer.from(bytes).toString("base64");
}

function rms(samples: Int16Array): number {
  let sumSq = 0;
  for (const s of samples) sumSq += s * s;
  return Math.sqrt(sumSq / Math.max(1, samples.length));
}

describe("TelephonyAudioAdapter — the telephony<->core conversion boundary", () => {
  it("caller frame -> core: µ-law 8k in, PCM16 LE base64 out at ~2x the samples (16k)", () => {
    const adapter = new TelephonyAudioAdapter();
    const inSamples = 160; // 20ms @ 8kHz
    const outBytes = Buffer.from(adapter.callerFrameToCore(muLawFrame(inSamples)), "base64");

    expect(outBytes.length % 2).toBe(0); // whole PCM16 samples
    const outSamples = outBytes.length / 2;
    expect(outSamples).toBeGreaterThan(inSamples * 1.8);
    expect(outSamples).toBeLessThan(inSamples * 2.2);
  });

  it("core chunk -> caller: PCM16 LE 24k in, µ-law base64 out at ~1/3 the samples (8k)", () => {
    const adapter = new TelephonyAudioAdapter();
    const inSamples = 480; // 20ms @ 24kHz
    const muLawBytes = Buffer.from(adapter.coreChunkToCaller(corePcmChunk(inSamples)), "base64");

    expect(muLawBytes.length).toBeGreaterThan(inSamples / 3 - 6);
    expect(muLawBytes.length).toBeLessThan(inSamples / 3 + 6);
  });

  it("caller->core conversion produces sane, non-silent, non-clipped audio", () => {
    const adapter = new TelephonyAudioAdapter();
    const n = 800;
    const pcmIn = new Int16Array(n);
    for (let i = 0; i < n; i++) pcmIn[i] = Math.round(Math.sin((2 * Math.PI * 300 * i) / 8000) * 6000);
    const frameIn = Buffer.from(muLawEncode(pcmIn)).toString("base64");

    const level = rms(pcm16(adapter.callerFrameToCore(frameIn)));
    expect(level).toBeGreaterThan(1000); // not silence
    expect(level).toBeLessThan(12000); // not clipped garbage
  });

  it("streams many frames without a boundary discontinuity spiking amplitude", () => {
    const adapter = new TelephonyAudioAdapter();
    let maxAbs = 0;
    for (let f = 0; f < 10; f++) {
      for (const s of pcm16(adapter.callerFrameToCore(muLawFrame(160)))) {
        maxAbs = Math.max(maxAbs, Math.abs(s));
      }
    }
    expect(maxAbs).toBeLessThan(12000); // input peak ~8000, no boundary spikes
  });

  it("resetOutbound() is safe and the next chunk still converts cleanly", () => {
    const adapter = new TelephonyAudioAdapter();
    adapter.coreChunkToCaller(corePcmChunk(480));
    adapter.resetOutbound();
    const after = Buffer.from(adapter.coreChunkToCaller(corePcmChunk(480)), "base64");
    expect(after.length).toBeGreaterThan(150);
    expect(rms(muLawDecode(after))).toBeGreaterThan(500);
  });
});
