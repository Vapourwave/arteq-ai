import { muLawDecode, muLawEncode } from "./audio/mulaw.js";
import {
  LinearResampler,
  float32ToInt16,
  float32ToPcm16le,
  int16ToFloat32,
  pcm16leToFloat32,
} from "./audio/resample.js";

/**
 * THE conversion boundary between the telephony transport and the
 * receptionist voice core (CLAUDE.md §8, docs/07 §"Transport boundary").
 *
 * Everything telephony-shaped stops here:
 *   - µ-law / G.711 codec
 *   - 8 kHz narrowband sample rate
 *   - base64 media frames
 *
 * Everything above this adapter (PhoneCallSession, VoiceProvider,
 * conversation state, grounding) only ever deals in the SAME linear-PCM
 * contracts the kiosk already uses:
 *   - inbound  to the core: base64 PCM16 LE @ 16 kHz  (VOICE_AUDIO_CONTRACT)
 *   - outbound from the core: base64 PCM16 LE @ 24 kHz (ASSISTANT_AUDIO_CONTRACT)
 *
 * One adapter instance per call. It is stateful on purpose: each direction
 * owns a LinearResampler that carries interpolation phase across frames so
 * streamed audio has no periodic click (docs/04 §7).
 */

/** Rates are fixed by the two ends we bridge; named, not magic numbers. */
const TELEPHONY_RATE_HZ = 8000;
const CORE_INPUT_RATE_HZ = 16000; // VOICE_AUDIO_CONTRACT.sampleRateHz
const CORE_OUTPUT_RATE_HZ = 24000; // ASSISTANT_AUDIO_CONTRACT.sampleRateHz

export class TelephonyAudioAdapter {
  /** caller 8 kHz µ-law -> core 16 kHz PCM16 */
  private readonly upsampler = new LinearResampler(TELEPHONY_RATE_HZ, CORE_INPUT_RATE_HZ);
  /** core 24 kHz PCM16 -> caller 8 kHz µ-law */
  private readonly downsampler = new LinearResampler(CORE_OUTPUT_RATE_HZ, TELEPHONY_RATE_HZ);

  /**
   * One inbound telephony media frame -> one base64 PCM16 chunk ready for
   * VoiceSession.sendAudioChunk(). Steps: base64 -> µ-law bytes -> decode to
   * linear PCM16 @ 8 kHz -> resample to 16 kHz -> PCM16 LE bytes -> base64.
   */
  callerFrameToCore(muLawBase64: string): string {
    const muLaw = Buffer.from(muLawBase64, "base64");
    const pcm8k = muLawDecode(muLaw);
    const float8k = int16ToFloat32(pcm8k);
    const float16k = this.upsampler.process(float8k);
    const pcm16kBytes = float32ToPcm16le(float16k);
    return Buffer.from(pcm16kBytes).toString("base64");
  }

  /**
   * One core assistant-audio chunk (base64 PCM16 LE @ 24 kHz) -> base64
   * µ-law @ 8 kHz ready to hand to the transport as an outbound media
   * payload. Steps: base64 -> PCM16 LE bytes -> Float32 @ 24 kHz -> resample
   * to 8 kHz -> Int16 -> µ-law encode -> base64.
   */
  coreChunkToCaller(pcm16Base64: string): string {
    const pcmBytes = Buffer.from(pcm16Base64, "base64");
    const float24k = pcm16leToFloat32(pcmBytes);
    const float8k = this.downsampler.process(float24k);
    const int8k = float32ToInt16(float8k);
    const muLaw = muLawEncode(int8k);
    return Buffer.from(muLaw).toString("base64");
  }

  /**
   * Barge-in: the caller started talking over the assistant. The transport
   * flushes its own outbound buffer; here we drop the downsampler's carried
   * interpolation tail so the next reply doesn't glide out of a stale
   * sample from the reply that was just cut.
   */
  resetOutbound(): void {
    this.downsampler.reset();
  }
}
