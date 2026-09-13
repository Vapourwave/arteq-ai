/**
 * Linear-interpolation resampler with cross-chunk continuity.
 *
 * Ported deliberately from the kiosk's proven implementation
 * (apps/kiosk/src/features/voice/audio/PcmResampler.ts), which the original
 * architecture assessment flagged as high-confidence reusable: it carries
 * interpolation state (`remainder` / `lastSample`) ACROSS chunks instead of
 * resetting to zero on every buffer, so there is no audible click/
 * discontinuity at buffer boundaries (docs/04 §7 "must preserve continuity
 * across audio chunks"). A per-chunk-reset resampler is the classic cause
 * of a periodic tick on streamed audio.
 *
 * The telephony channel needs two of these per call:
 *   - caller  8kHz -> core 16kHz   (upsample, patient speech into the AI)
 *   - core   24kHz -> caller 8kHz  (downsample, AI speech out to the caller)
 *
 * Kept generic on both rates (no hard-coded 16000) so a future provider
 * that negotiates a different rate needs no code change here.
 */
export class LinearResampler {
  private remainder = 0;
  private lastSample = 0;
  private hasLastSample = false;

  constructor(
    private readonly inputSampleRate: number,
    private readonly outputSampleRate: number,
  ) {}

  /** Resample one Float32 chunk ([-1, 1]); interpolation phase is preserved
   * for the next call so streamed chunks join seamlessly. */
  process(input: Float32Array): Float32Array {
    if (this.inputSampleRate === this.outputSampleRate) {
      return input;
    }

    const ratio = this.inputSampleRate / this.outputSampleRate;
    const output: number[] = [];
    let position = this.remainder;

    const sampleAt = (index: number): number => {
      if (index < 0) return this.hasLastSample ? this.lastSample : input[0] ?? 0;
      if (index >= input.length) return input[input.length - 1] ?? 0;
      return input[index];
    };

    while (position < input.length) {
      const indexBefore = Math.floor(position) - 1;
      const indexAfter = Math.floor(position);
      const frac = position - Math.floor(position);
      const a = sampleAt(indexBefore);
      const b = sampleAt(indexAfter);
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

  /** Drop carried interpolation state. Called on barge-in for the outbound
   * (core -> caller) resampler: the assistant reply it was mid-way through
   * has been cut, so the next reply must not interpolate from a stale tail
   * sample. */
  reset(): void {
    this.remainder = 0;
    this.lastSample = 0;
    this.hasLastSample = false;
  }
}

/** Signed 16-bit little-endian PCM bytes -> Float32 [-1, 1]. */
export function pcm16leToFloat32(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = Math.floor(bytes.byteLength / 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

/** Float32 [-1, 1] -> signed 16-bit little-endian PCM bytes. */
export function float32ToPcm16le(input: Float32Array): Uint8Array {
  const out = new Uint8Array(input.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return out;
}

/** Float32 [-1, 1] -> Int16Array (for the µ-law encoder, which is per-sample). */
export function float32ToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

/** Int16 samples -> Float32 [-1, 1]. */
export function int16ToFloat32(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = input[i] / 32768;
  }
  return out;
}
