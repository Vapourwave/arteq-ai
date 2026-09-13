/**
 * ARTEQ AI — Transcript Refinement + Quality Guard contract (Phase 4).
 *
 * This is the shape of POST /api/transcript/process — the kiosk's ONLY
 * window into this stage. Everything about how many LLM calls happen
 * internally, which provider is used, or what deterministic guardrails ran
 * is a backend implementation detail; the kiosk only ever sees this result.
 *
 * Pipeline this sits in (docs/01 §7, docs/02 §10-11, docs/04 §12-13):
 *   raw transcript -> refinement -> quality guard -> (future) confirmation -> routing
 * Each stage must remain distinguishable — this type keeps `quality` and
 * `diagnostics` as separate namespaces from `cleanTranscript` rather than a
 * single flat blob, specifically so a stage can be inspected/tested/evolved
 * independently of the others.
 */

export type QualityStatus = "CLEAR" | "REVIEW" | "INSUFFICIENT";

/**
 * The quality-guard verdict. Deliberately minimal for Phase 4 (per Decision
 * 3): only what the patient-facing UI and this phase's tests actually need.
 * Future fields (e.g. a breakdown by issue category) can be added here
 * without touching `cleanTranscript` or `diagnostics`.
 */
export interface QualityAssessment {
  status: QualityStatus;
  /** 0.0-1.0. Advisory only — `status` is the field that drives UI/logic. */
  score: number;
  issues: string[];
  /** Patient-facing-safe explanation when status is not CLEAR, else null. */
  reviewReason: string | null;
}

/**
 * Internal/diagnostic only — never rendered in patient-facing UI (Decision
 * 4). Exists so latency and guardrail behavior can be measured and logged
 * during development/validation without adding patient-visible surface.
 */
export interface ProcessingDiagnostics {
  /** False when the deterministic gate decided refinement wasn't worth
   * running (fast path) — see rawTranscriptAssessment.ts. Quality guard
   * runs either way; this only reflects the refinement stage. */
  refinementExecuted: boolean;
  refinementLatencyMs: number;
  qualityLatencyMs: number;
  totalLatencyMs: number;
  usedFallback: boolean;
  fallbackLatencyMs: number | null;
  /** Which deterministic guardrails fired, e.g. "length_ratio", "script_loss". */
  guardrailsApplied: string[];
  /** Signals that made the gate decide refinement was needed — empty array
   * means the gate found no evidence, not that it "approved" the content
   * (it never judges correctness, only whether cleanup looks warranted). */
  gateSignals: string[];
}

/**
 * The full Phase 4 result. Extensibility seam for the future pipeline
 * (docs/01's Understanding -> Intent+Entities -> Structured Request ->
 * Confirmation -> Routing): later phases add NEW optional top-level fields
 * here (e.g. `understanding?: UnderstandingResult`) rather than reshaping
 * `cleanTranscript`/`quality`/`diagnostics`, so existing consumers of this
 * type never need to change when a new stage is appended.
 */
export interface TranscriptProcessingResult {
  cleanTranscript: string;
  quality: QualityAssessment;
  diagnostics: ProcessingDiagnostics;
}

export interface TranscriptProcessRequest {
  rawTranscript: string;
  /** How many discrete Gemini Live transcription segments were joined to
   * form rawTranscript. Optional/omittable (defaults to 1 server-side) —
   * used only as a weak input to the deterministic refinement gate, never
   * as a correctness signal on its own. */
  segmentCount?: number;
}
