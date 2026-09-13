/**
 * Product safety/quality layer for the ASSISTANT's generated spoken
 * response — explicitly NOT the ASR/refinement quality guard
 * (services/refinement/*), which validates the PATIENT's transcript. This
 * is a structurally different concern: does what the assistant is about to
 * say (or just said) look like it's asserting a specific fact that isn't
 * actually backed by anything the session/context knows?
 *
 * Real-time constraint (native-audio architecture): for a live spoken
 * reply, audio has already streamed to the patient by the time the full
 * response text is available for review — this layer cannot un-speak
 * audio already played. Today it is diagnostic/logging infrastructure
 * (flags a mismatch for operational visibility) and a hard gate for any
 * future text-confirmation surface. If stronger pre-speech control is ever
 * required, that needs a "generate text -> validate -> then synthesize
 * audio" pipeline shape, a genuine architecture change, not something this
 * function can retrofit.
 *
 * Deterministic, pure, no LLM call — mirrors services/refinement/guardrails.ts's
 * pattern-based, conservative style. Must NOT rewrite the assistant's text,
 * must NOT invent patient facts, must NOT touch the patient's transcript at
 * all — it only ever produces a verdict about the assistant's own words.
 */

export type GroundingStatus = "CLEAR" | "REVIEW";

export interface GroundingAssessment {
  status: GroundingStatus;
  /** Which check(s) fired, e.g. "unexpected_content", "unbacked_specific_claim". */
  reasons: string[];
}

/**
 * Patterns that look like a specific, checkable factual assertion a
 * hospital receptionist could get wrong — day-of-week + open/closed
 * claims, a named doctor, a specific clock time. Deliberately narrow and
 * pattern-based (not semantic understanding) — conservative like the ASR
 * gate: only flags clear structural evidence of a specific claim, never
 * judges whether prose "sounds plausible" in general.
 *
 * The "closed on Sundays" fabrication is a REAL captured finding from this
 * project's own native-audio investigation (2026-08-30) — gemini-2.5-flash-
 * native-audio-latest invented this with zero backend behind it. Reused
 * here as the motivating real case for the day/hours pattern below, not an
 * invented example.
 */
const DAYS = "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?";
const HOURS_STATUS = "(?:closed|open|unavailable)";
// Matches either word order ("closed on Sundays" or "Sundays we are
// closed") within a short window, since real phrasing varies.
const DAY_OF_WEEK_HOURS_CLAIM_PATTERN = new RegExp(
  `\\b${HOURS_STATUS}\\b[^.!?]{0,40}\\b${DAYS}\\b|\\b${DAYS}\\b[^.!?]{0,40}\\b${HOURS_STATUS}\\b`,
  "i",
);
const NAMED_DOCTOR_CLAIM_PATTERN = /\bdr\.?\s+[a-z][a-z'-]+\b/i;
const SPECIFIC_CLOCK_TIME_CLAIM_PATTERN = /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i;

/**
 * @param assistantResponseText The assistant's spoken reply (from
 *   outputAudioTranscription, accumulated for the turn).
 * @param knownFacts Short strings describing what's actually known/backed
 *   for this session (e.g. real department names, real appointment times
 *   once a booking stage exists). Empty for now — this vertical slice has
 *   no backend-sourced facts yet, so ANY specific claim is by definition
 *   unbacked. This is intentional: it makes the guard meaningful even
 *   before real clinical data exists, rather than a no-op stub.
 */
export function assessAssistantResponse(
  assistantResponseText: string,
  knownFacts: string[] = [],
): GroundingAssessment {
  const reasons: string[] = [];
  const trimmed = assistantResponseText.trim();

  if (trimmed.length === 0) {
    return { status: "CLEAR", reasons: [] };
  }

  const isBackedByKnownFact = (claim: string) =>
    knownFacts.some((fact) => fact.toLowerCase().includes(claim.toLowerCase()));

  const dayHoursMatch = trimmed.match(DAY_OF_WEEK_HOURS_CLAIM_PATTERN);
  if (dayHoursMatch && !isBackedByKnownFact(dayHoursMatch[0])) {
    reasons.push("unbacked_hours_claim");
  }

  const doctorMatch = trimmed.match(NAMED_DOCTOR_CLAIM_PATTERN);
  if (doctorMatch && !isBackedByKnownFact(doctorMatch[0])) {
    reasons.push("unbacked_doctor_name");
  }

  const timeMatch = trimmed.match(SPECIFIC_CLOCK_TIME_CLAIM_PATTERN);
  if (timeMatch && !isBackedByKnownFact(timeMatch[0])) {
    reasons.push("unbacked_specific_time");
  }

  return { status: reasons.length > 0 ? "REVIEW" : "CLEAR", reasons };
}
