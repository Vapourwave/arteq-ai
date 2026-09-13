import { describe, expect, it } from "vitest";
import { muLawDecode, muLawDecodeSample, muLawEncode, muLawEncodeSample } from "./mulaw.js";

describe("G.711 µ-law codec", () => {
  it("encodes silence to the µ-law idle byte (0xFF) and decodes it back to 0", () => {
    expect(muLawEncodeSample(0)).toBe(0xff);
    expect(muLawDecodeSample(0xff)).toBe(0);
  });

  it("uses the µ-law sign convention: high bit set for positive, clear for negative", () => {
    const pos = muLawEncodeSample(32767); // clips to +full scale -> 0x80
    const neg = muLawEncodeSample(-32768); // clips to -full scale -> 0x00
    expect(pos & 0x80).toBe(0x80);
    expect(neg & 0x80).toBe(0);
    expect(pos).not.toBe(neg);
  });

  it("round-trips a sweep of samples within µ-law quantisation error", () => {
    // µ-law is lossy; the step size grows with amplitude but stays a small
    // fraction of the level. Assert well under ~8% for a representative sweep.
    for (let s = -32000; s <= 32000; s += 250) {
      const recovered = muLawDecodeSample(muLawEncodeSample(s));
      const tolerance = Math.max(64, Math.abs(s) * 0.08);
      expect(Math.abs(recovered - s)).toBeLessThanOrEqual(tolerance);
    }
  });

  it("clips at the µ-law clip point rather than wrapping", () => {
    // Both are above the 32635 clip point, so they must encode identically.
    expect(muLawEncodeSample(32700)).toBe(muLawEncodeSample(32767));
    expect(muLawDecodeSample(muLawEncodeSample(32767))).toBeGreaterThan(30000);
  });

  it("encodes/decodes whole buffers element-wise, preserving length", () => {
    const pcm = Int16Array.from([0, 1000, -1000, 20000, -20000, 32767, -32768]);
    const encoded = muLawEncode(pcm);
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.length).toBe(pcm.length);
    const decoded = muLawDecode(encoded);
    expect(decoded.length).toBe(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      const tolerance = Math.max(64, Math.abs(pcm[i]) * 0.08);
      expect(Math.abs(decoded[i] - pcm[i])).toBeLessThanOrEqual(tolerance);
    }
  });

  it("only ever produces integer bytes in 0-255", () => {
    for (let s = -32768; s <= 32767; s += 137) {
      const b = muLawEncodeSample(s);
      expect(Number.isInteger(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });
});
