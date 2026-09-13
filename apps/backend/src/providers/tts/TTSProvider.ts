import type { Readable } from "node:stream";

/**
 * Provider-agnostic contract for text-to-speech synthesis (CLAUDE.md §8
 * "TTSProvider"), mirroring the existing VoiceProvider (voice/VoiceProvider.ts)
 * and TranscriptRefinementProvider patterns: callers never talk to a TTS
 * vendor's API directly, only to this interface.
 *
 * EXPERIMENTAL scope note: this abstraction exists to evaluate Fish Audio
 * S2 Pro via a dev-only test harness (routes/tts.ts) — it is not wired into
 * the real patient pipeline, because that pipeline has no AI-response stage
 * yet for TTS to sit behind. See docs/04 §31 for the eventual intended
 * architecture (structured answer -> response text -> language selection ->
 * TTS provider -> speaker) once that stage exists.
 */
export interface TTSSynthesisResult {
  /** MIME type of the audio stream, e.g. "audio/mpeg". */
  contentType: string;
  /** The audio bytes as a Node Readable — callers pipe this directly to an
   * HTTP response rather than buffering, so a streaming-capable provider's
   * latency benefit isn't thrown away by an intermediate buffer. */
  audioStream: Readable;
}

export interface TTSProvider {
  readonly name: string;
  isConfigured(): boolean;
  synthesize(text: string): Promise<TTSSynthesisResult>;
}
