import type { TTSProvider, TTSSynthesisResult } from "./TTSProvider.js";

/**
 * The "current/default TTS" slot in the provider abstraction. No default
 * TTS exists in this project yet — SARVAM_API_KEY has been reserved in
 * env.ts since early in this project (docs/04 §17) but was never wired up,
 * and no other TTS implementation exists anywhere in this codebase or the
 * legacy prototype (confirmed by inspection before this integration).
 *
 * This provider makes that reserved-but-unbuilt status explicit and
 * queryable (`isConfigured() === false`) rather than silently doing
 * nothing or crashing, so the dev test harness can report a clear "not
 * implemented yet" instead of an opaque failure — same pattern as
 * `hasSarvamCredentials` gating elsewhere.
 */
export class ReservedTTSProvider implements TTSProvider {
  readonly name = "reserved-unimplemented";

  isConfigured(): boolean {
    return false;
  }

  async synthesize(_text: string): Promise<TTSSynthesisResult> {
    throw new Error(
      "No default TTS provider is implemented yet. This slot is reserved (see docs/04 §17) — only the experimental Fish provider is currently wired up.",
    );
  }
}
