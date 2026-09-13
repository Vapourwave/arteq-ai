/**
 * Linear-interpolation resampler to 16kHz mono PCM.
 *
 * Ported from legacy/old-ai-studio-source/src/services/geminiLiveVoiceService.ts.
 * That implementation was identified in the architecture assessment as
 * high-confidence reusable: it carries interpolation state ACROSS chunks
 * (`remainder` / `lastSample`) instead of resetting to zero on every buffer,
 * which is exactly what docs/04 §7 requires ("must preserve continuity
 * across audio chunks"). A resampler that resets per-chunk introduces an
 * audible click/discontinuity at every buffer boundary — this one doesn't.
 *
 * The browser's actual AudioContext sample rate is NOT guaranteed to be
 * 16000Hz just because it was requested (docs/04 §6) — callers must pass
 * the true runtime rate in, never assume it.
 */
export class PcmResampler {
  private remainder = 0;
  private lastSample = 0;
  private hasLastSample = false;

  constructor(
    private readonly inputSampleRate: number,
    private readonly outputSampleRate = 16000,
  ) {}

  /** Resamples one Float32 chunk, preserving interpolation phase for the next call. */
  process(input: Float32Array): Float32Array {
    if (this.inputSampleRate === this.outputSampleRate) {
      return input;
    }

    const ratio = this.inputSampleRate / this.outputSampleRate;
    const output: number[] = [];

    // Position within `input`, continuing from where the previous chunk left off.
    let position = this.remainder;

    const sampleAt = (index: number): number => {
      if (index < 0) return this.hasLastSample ? this.lastSample : input[0] ?? 0;
      if (index >= input.length) return input[input.length - 1] ?? 0;
      return input[index];
    };

    while (position < input.length) {
      const i0 = Math.floor(position);
      const i1 = i0 + 1;
      const frac = position - i0;
      const a = sampleAt(i0);
      const b = sampleAt(i1);
      output.push(a + (b - a) * frac);
      position += ratio;
    }

    this.remainder = position - input.length;
    if (input.length > 0) {
      this.lastSample = input[input.length - 1];
      this.hasLastSample = true;
    }

    return Float32Array.from(output);
  }
}

/** Float32 [-1, 1] samples -> 16-bit signed little-endian PCM. */
export function float32ToPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}

export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
