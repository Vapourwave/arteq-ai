import type { QualityOutcome } from "./TranscriptRefinementProvider.js";

/**
 * Deterministic safety net wrapping the LLM quality guard (Phase 4
 * architecture decision D). These are pure, zero-network, zero-hallucination
 * checks — the backend's own "AI proposes, backend decides" pattern
 * (CLAUDE.md §5.2) applied to transcript quality itself, not just to
 * routing/departments/doctors.
 *
 * Rule: a guardrail may only push the status toward MORE caution
 * (CLEAR -> REVIEW -> INSUFFICIENT), never the reverse. A guardrail can
 * never manufacture a CLEAR verdict — only the LLM's own assessment (or the
 * default when nothing is wrong) can produce CLEAR.
 */

const STATUS_SEVERITY: Record<QualityOutcome["status"], number> = {
  CLEAR: 0,
  REVIEW: 1,
  INSUFFICIENT: 2,
};

function moreCautious(
  a: QualityOutcome["status"],
  b: QualityOutcome["status"],
): QualityOutcome["status"] {
  return STATUS_SEVERITY[a] >= STATUS_SEVERITY[b] ? a : b;
}

// Malayalam Unicode block: U+0D00–U+0D7F.
const MALAYALAM_SCRIPT_PATTERN = /[ഀ-ൿ]/;

/** Below this, a raw transcript is too short for the ratio/script checks to be meaningful. */
const TRIVIAL_LENGTH_THRESHOLD = 12;

export interface GuardrailFinding {
  guardrail: string;
  severity: QualityOutcome["status"];
  issue: string;
}

/**
 * Flags a clean transcript that's dramatically shorter than the raw one —
 * a plausible signal of dropped content — or dramatically longer, a
 * plausible signal of invented content.
 */
export function checkLengthRatio(rawTranscript: string, cleanTranscript: string): GuardrailFinding | null {
  const rawLen = rawTranscript.trim().length;
  const cleanLen = cleanTranscript.trim().length;
  if (rawLen < TRIVIAL_LENGTH_THRESHOLD) return null;

  if (cleanLen < rawLen * 0.25) {
    return {
      guardrail: "length_ratio_short",
      severity: "REVIEW",
      issue: "The refined transcript is much shorter than the raw transcript.",
    };
  }
  if (cleanLen > rawLen * 2) {
    return {
      guardrail: "length_ratio_long",
      severity: "REVIEW",
      issue: "The refined transcript is much longer than the raw transcript.",
    };
  }
  return null;
}

/**
 * Flags apparent loss of Malayalam content: raw transcript contains
 * Malayalam script but the refined transcript contains none at all.
 */
export function checkScriptPreserved(rawTranscript: string, cleanTranscript: string): GuardrailFinding | null {
  if (rawTranscript.trim().length < TRIVIAL_LENGTH_THRESHOLD) return null;
  const rawHasMalayalam = MALAYALAM_SCRIPT_PATTERN.test(rawTranscript);
  const cleanHasMalayalam = MALAYALAM_SCRIPT_PATTERN.test(cleanTranscript);
  if (rawHasMalayalam && !cleanHasMalayalam) {
    return {
      guardrail: "malayalam_script_lost",
      severity: "REVIEW",
      issue: "The raw transcript contains Malayalam script that is missing from the refined transcript.",
    };
  }
  return null;
}

/** Flags an empty or whitespace-only refined transcript. */
export function checkNotEmpty(cleanTranscript: string): GuardrailFinding | null {
  if (cleanTranscript.trim().length === 0) {
    return {
      guardrail: "empty_output",
      severity: "INSUFFICIENT",
      issue: "The refined transcript is empty.",
    };
  }
  return null;
}

const ALL_GUARDRAILS = [checkLengthRatio, checkScriptPreserved] as const;

export interface GuardrailResult {
  status: QualityOutcome["status"];
  issues: string[];
  guardrailsApplied: string[];
}

/**
 * Applies every deterministic guardrail on top of the LLM's own quality
 * verdict. Never overrides toward CLEAR — only ever holds the line or pushes
 * toward more caution.
 */
export function applyGuardrails(
  rawTranscript: string,
  cleanTranscript: string,
  llmQuality: QualityOutcome,
): GuardrailResult {
  const emptyFinding = checkNotEmpty(cleanTranscript);
  const findings = emptyFinding
    ? [emptyFinding]
    : ALL_GUARDRAILS.map((check) => check(rawTranscript, cleanTranscript)).filter(
        (f): f is GuardrailFinding => f !== null,
      );

  let status = llmQuality.status;
  const issues = [...llmQuality.issues];
  const guardrailsApplied: string[] = [];

  for (const finding of findings) {
    status = moreCautious(status, finding.severity);
    issues.push(finding.issue);
    guardrailsApplied.push(finding.guardrail);
  }

  return { status, issues, guardrailsApplied };
}
