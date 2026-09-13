import type { TranscriptProcessingResult } from "@arteq/shared";
import { applyGuardrails } from "./guardrails.js";
import { assessRawTranscript } from "./rawTranscriptAssessment.js";
import type { QualityOutcome, TranscriptRefinementProvider } from "./TranscriptRefinementProvider.js";

const EMPTY_INPUT_REASON = "I didn't catch anything. Could you try again?";
const FALLBACK_REASON = "Let's make sure I understood you correctly.";

/**
 * The Phase 4 orchestrator. This is the ONE place that:
 *  - runs the deterministic gate (assessRawTranscript) to decide whether
 *    refinement is worth running at all (latency architecture) — quality
 *    guard is NEVER gated, it always runs for non-empty input
 *  - calls refine() (conditionally) then assessQuality() (always)
 *  - measures latency for each stage and the total
 *  - isolates each stage's failure from the other (a failed quality check
 *    does not discard a successful refinement, and vice versa)
 *  - applies deterministic guardrails on top of the LLM's own verdict
 *  - never throws — always returns a valid result, per CLAUDE.md §11/§24
 *    ("never fabricate success", patient-facing errors must be graceful)
 *
 * This function is provider-agnostic (works with any TranscriptRefinementProvider,
 * including a fake one in tests) — the orchestration/guardrail/gate logic is
 * exactly the part the Phase 4 assessment argued should be deterministic
 * and NOT delegated to the LLM.
 */
export async function processTranscript(
  provider: TranscriptRefinementProvider,
  rawTranscript: string,
  segmentCount = 1,
): Promise<TranscriptProcessingResult> {
  const totalStart = performance.now();
  const trimmed = rawTranscript.trim();

  if (trimmed.length === 0) {
    return {
      cleanTranscript: "",
      quality: { status: "INSUFFICIENT", score: 0, issues: [], reviewReason: EMPTY_INPUT_REASON },
      diagnostics: {
        refinementExecuted: false,
        refinementLatencyMs: 0,
        qualityLatencyMs: 0,
        totalLatencyMs: performance.now() - totalStart,
        usedFallback: false,
        fallbackLatencyMs: null,
        guardrailsApplied: ["empty_raw_input"],
        gateSignals: [],
      },
    };
  }

  // --- TEMPORARY DIAGNOSTIC (Malayalam/Manglish regression investigation) ---
  // Logs transcript CONTENT (never audio, never secrets) at each stage so a
  // failure can be attributed to the correct boundary. Remove once Phase 4
  // has been validated end-to-end.
  console.log("[diag][stage2.5 gate-input]", JSON.stringify(trimmed), "segmentCount=", segmentCount);
  const assessment = assessRawTranscript(trimmed, segmentCount);
  console.log("[diag][stage2.5 gate-result]", JSON.stringify(assessment));

  let cleanTranscript: string;
  let refinementFailed = false;
  let refinementLatencyMs = 0;

  if (assessment.needsRefinement) {
    console.log("[diag][stage3 refinement-input]", JSON.stringify(trimmed));
    const refineStart = performance.now();
    try {
      const outcome = await provider.refine(trimmed);
      cleanTranscript = outcome.cleanTranscript;
      console.log("[diag][stage4 refinement-output]", JSON.stringify(cleanTranscript));
    } catch (err) {
      console.warn("[transcript] refine() failed, falling back to raw transcript:", err);
      cleanTranscript = trimmed;
      refinementFailed = true;
    }
    refinementLatencyMs = performance.now() - refineStart;
  } else {
    // Fast path: gate found no evidence refinement is needed. This is NOT
    // "content approved" — it's "no cleanup evidence found" — quality guard
    // below still independently reviews this raw text.
    cleanTranscript = trimmed;
    console.log("[diag][stage3/4 refinement-skipped] gate found no signals, using raw as clean");
  }

  let llmQuality: QualityOutcome;
  let qualityFailed = false;
  const qualityStart = performance.now();
  try {
    llmQuality = await provider.assessQuality(trimmed, cleanTranscript);
    console.log("[diag][stage5 quality-output]", JSON.stringify(llmQuality));
  } catch (err) {
    console.warn("[transcript] assessQuality() failed, falling back to REVIEW:", err);
    llmQuality = { status: "REVIEW", score: 0, issues: [], reviewReason: null };
    qualityFailed = true;
  }
  const qualityLatencyMs = performance.now() - qualityStart;

  const guarded = applyGuardrails(trimmed, cleanTranscript, llmQuality);
  if (guarded.guardrailsApplied.length > 0) {
    console.log("[diag][guardrails]", JSON.stringify(guarded.guardrailsApplied), "-> status", guarded.status);
  }
  const usedFallback = refinementFailed || qualityFailed;
  const totalLatencyMs = performance.now() - totalStart;

  const result: TranscriptProcessingResult = {
    cleanTranscript,
    quality: {
      status: guarded.status,
      score: llmQuality.score,
      issues: guarded.issues,
      reviewReason: guarded.status === "CLEAR" ? null : llmQuality.reviewReason ?? FALLBACK_REASON,
    },
    diagnostics: {
      refinementExecuted: assessment.needsRefinement,
      refinementLatencyMs,
      qualityLatencyMs,
      totalLatencyMs,
      usedFallback,
      fallbackLatencyMs: usedFallback ? totalLatencyMs : null,
      guardrailsApplied: guarded.guardrailsApplied,
      gateSignals: assessment.signals,
    },
  };
  console.log("[diag][stage6 final-patient-facing]", JSON.stringify(result.cleanTranscript));
  return result;
}
