/**
 * G.711 µ-law (PCMU) codec — the narrowband codec every telephony provider
 * (Twilio, Plivo, Exotel, …) uses on the wire for `audio/x-mulaw;rate=8000`.
 *
 * This is deliberately a standalone, dependency-free module in the
 * telephony/ boundary (CLAUDE.md §8 "telephony-specific details must not
 * leak into the receptionist core"): nothing above the
 * TelephonyAudioAdapter ever sees a µ-law byte — the core voice pipeline
 * only ever handles linear PCM16 (see packages/shared/voiceProtocol.ts
 * VOICE_AUDIO_CONTRACT / ASSISTANT_AUDIO_CONTRACT).
 *
 * Algorithm: the standard Sun/ITU-T G.711 µ-law with an 0x84 bias and a
 * 32635 clip point, operating on signed 16-bit linear samples. Verified by
 * round-trip tests in mulaw.test.ts (µ-law is lossy, so the test asserts a
 * bounded quantisation error, not bit-exact recovery).
 */

const BIAS = 0x84; // 132
const CLIP = 32635;

/** One signed-16-bit linear sample -> one µ-law byte (0-255). */
export function muLawEncodeSample(sample: number): number {
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample = sample + BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }

  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** One µ-law byte -> one signed-16-bit linear sample. */
export function muLawDecodeSample(muLawByte: number): number {
  muLawByte = ~muLawByte & 0xff;
  const sign = muLawByte & 0x80;
  const exponent = (muLawByte >> 4) & 0x07;
  const mantissa = muLawByte & 0x0f;
  let sample = (((mantissa << 3) + BIAS) << exponent) - BIAS;
  return sign !== 0 ? -sample : sample;
}

/** µ-law byte buffer -> linear PCM16 samples (same sample rate, 8kHz). */
export function muLawDecode(muLaw: Uint8Array): Int16Array {
  const out = new Int16Array(muLaw.length);
  for (let i = 0; i < muLaw.length; i++) {
    out[i] = muLawDecodeSample(muLaw[i]);
  }
  return out;
}

/** Linear PCM16 samples -> µ-law byte buffer (same sample rate, 8kHz). */
export function muLawEncode(pcm16: Int16Array): Uint8Array {
  const out = new Uint8Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    out[i] = muLawEncodeSample(pcm16[i]);
  }
  return out;
}
