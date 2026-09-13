/**
 * Provider-agnostic contract for the two LLM calls behind transcript
 * refinement + quality guard (Phase 4 architecture decision D: two
 * independent calls, not one combined call — see the Phase 4 assessment).
 *
 * Kept as TWO methods, not one, so:
 *  - each concern has its own narrow, independently-testable prompt
 *  - assessQuality gets an independent read of the transcript rather than
 *    the same model re-certifying its own single-pass output
 *  - a future provider swap (or per-method provider swap) doesn't require
 *    reshaping both concerns at once
 *
 * Mirrors the existing VoiceProvider pattern (CLAUDE.md §10, docs/02 §6):
 * callers never talk to Gemini directly, only to this interface.
 */
export interface RefineOutcome {
  cleanTranscript: string;
}

export interface QualityOutcome {
  status: "CLEAR" | "REVIEW" | "INSUFFICIENT";
  score: number;
  issues: string[];
  reviewReason: string | null;
}

export interface TranscriptRefinementProvider {
  readonly name: string;
  isConfigured(): boolean;
  refine(rawTranscript: string): Promise<RefineOutcome>;
  assessQuality(rawTranscript: string, cleanTranscript: string): Promise<QualityOutcome>;
}
