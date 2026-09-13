import { describe, expect, it } from "vitest";
import { PcmResampler, float32ToPcm16, pcm16ToBase64 } from "./PcmResampler";

describe("PcmResampler", () => {
  it("returns input directly if input and output sample rates match", () => {
    const resampler = new PcmResampler(16000, 16000);
    const input = new Float32Array([0.1, 0.2, 0.3]);
    const output = resampler.process(input);
    expect(output).toBe(input);
  });

  it("resamples 48kHz to 16kHz with correct sample count and zero error on integer factor", () => {
    const resampler = new PcmResampler(48000, 16000);
    const inputLength = 1024;
    const input = new Float32Array(inputLength);
    for (let i = 0; i < inputLength; i++) {
      input[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }

    const output = resampler.process(input);
    const expectedLength = Math.ceil(inputLength / 3);
    expect(output.length).toBe(expectedLength);

    for (let i = 0; i < 10; i++) {
      const expected = Math.sin((2 * Math.PI * 440 * i) / 16000);
      expect(Math.abs(output[i] - expected)).toBeLessThan(1e-5);
    }
  });

  it("maintains streaming continuity across chunk boundaries without sample loss or discontinuities", () => {
    const inRate = 48000;
    const outRate = 16000;
    const totalSamples = 3000;
    const fullInput = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      fullInput[i] = Math.sin((2 * Math.PI * 440 * i) / inRate);
    }

    const singlePassResampler = new PcmResampler(inRate, outRate);
    const fullOutput = singlePassResampler.process(fullInput);

    const chunkedResampler = new PcmResampler(inRate, outRate);
    const chunkSize = 256;
    const chunks: Float32Array[] = [];
    for (let i = 0; i < totalSamples; i += chunkSize) {
      const chunk = fullInput.subarray(i, Math.min(i + chunkSize, totalSamples));
      chunks.push(chunkedResampler.process(chunk));
    }

    const totalChunkedLength = chunks.reduce((acc, c) => acc + c.length, 0);
    expect(totalChunkedLength).toBe(fullOutput.length);

    const mergedChunked = new Float32Array(totalChunkedLength);
    let offset = 0;
    for (const c of chunks) {
      mergedChunked.set(c, offset);
      offset += c.length;
    }

    for (let i = 0; i < fullOutput.length; i++) {
      expect(Math.abs(fullOutput[i] - mergedChunked[i])).toBeLessThan(1e-5);
    }
  });

  it("converts Float32 [-1, 1] correctly to 16-bit signed PCM", () => {
    const f32 = new Float32Array([-1.0, 0.0, 1.0, 0.5]);
    const pcm = float32ToPcm16(f32);
    expect(pcm[0]).toBe(-32768);
    expect(pcm[1]).toBe(0);
    expect(pcm[2]).toBe(32767);
    expect(pcm[3]).toBe(16383);
  });

  it("encodes PCM to valid base64 string", () => {
    const pcm = new Int16Array([0, 1000, -1000]);
    const b64 = pcm16ToBase64(pcm);
    expect(typeof b64).toBe("string");
    expect(b64.length).toBeGreaterThan(0);
  });
});
