import { describe, expect, it } from "vitest";
import {
  LinearResampler,
  float32ToInt16,
  float32ToPcm16le,
  int16ToFloat32,
  pcm16leToFloat32,
} from "./resample.js";

describe("LinearResampler", () => {
  it("returns the input untouched when in and out rates match", () => {
    const r = new LinearResampler(16000, 16000);
    const input = Float32Array.from([0.1, -0.2, 0.3]);
    expect(r.process(input)).toBe(input);
  });

  it("upsamples 8k -> 16k to roughly double the sample count", () => {
    const r = new LinearResampler(8000, 16000);
    const input = new Float32Array(160).fill(0.25);
    const out = r.process(input);
    expect(out.length).toBeGreaterThanOrEqual(315);
    expect(out.length).toBeLessThanOrEqual(325);
  });

  it("downsamples 24k -> 8k to roughly a third of the sample count", () => {
    const r = new LinearResampler(24000, 8000);
    const input = new Float32Array(480).fill(-0.5);
    const out = r.process(input);
    expect(out.length).toBeGreaterThanOrEqual(157);
    expect(out.length).toBeLessThanOrEqual(163);
  });

  it("preserves a DC level (constant signal stays constant)", () => {
    const r = new LinearResampler(8000, 16000);
    const out = r.process(new Float32Array(80).fill(0.4));
    for (const s of out) expect(s).toBeCloseTo(0.4, 5);
  });

  it("carries interpolation phase across chunks — no discontinuity at the boundary", () => {
    const r = new LinearResampler(8000, 16000);
    const chunkA = new Float32Array(80).fill(0.6);
    const chunkB = new Float32Array(80).fill(0.6);
    const outA = r.process(chunkA);
    const outB = r.process(chunkB);
    // Last sample of A and first sample of B must both still be ~0.6 — a
    // per-chunk-reset resampler would emit a 0 (or a big step) at the seam.
    expect(outA[outA.length - 1]).toBeCloseTo(0.6, 4);
    expect(outB[0]).toBeCloseTo(0.6, 4);
    // Total output count stays ~2x total input across the two calls.
    expect(outA.length + outB.length).toBeGreaterThanOrEqual(315);
    expect(outA.length + outB.length).toBeLessThanOrEqual(325);
  });

  it("reset() clears the carried tail", () => {
    const r = new LinearResampler(8000, 16000);
    r.process(new Float32Array(80).fill(0.6));
    r.reset();
    // After reset, a fresh constant chunk resamples cleanly from its own
    // first sample, not from the previous 0.6 tail.
    const out = r.process(new Float32Array(80).fill(-0.3));
    for (const s of out) expect(s).toBeCloseTo(-0.3, 5);
  });
});

describe("PCM <-> Float32 helpers", () => {
  it("round-trips PCM16 LE bytes through Float32 within one quantstep", () => {
    const original = Int16Array.from([0, 1, -1, 12345, -12345, 32767, -32768]);
    const bytes = new Uint8Array(original.buffer.slice(0));
    const back = pcm16leToFloat32(bytes);
    const reencoded = new Int16Array(float32ToPcm16le(back).buffer);
    for (let i = 0; i < original.length; i++) {
      expect(Math.abs(reencoded[i] - original[i])).toBeLessThanOrEqual(1);
    }
  });

  it("float32ToPcm16le writes little-endian byte order", () => {
    const bytes = float32ToPcm16le(Float32Array.from([1]));
    // +full scale is 0x7FFF -> bytes [0xFF, 0x7F] little-endian.
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0x7f);
  });

  it("int16 <-> float32 round-trips within one quantstep", () => {
    const original = Int16Array.from([0, 500, -500, 30000, -30000]);
    const back = float32ToInt16(int16ToFloat32(original));
    for (let i = 0; i < original.length; i++) {
      expect(Math.abs(back[i] - original[i])).toBeLessThanOrEqual(1);
    }
  });
});
