import type { ConversationState } from "@arteq/shared";

/**
 * A short, patient-facing summary of what ARTEQ has actually understood.
 *
 * Bug 1 fix: the raw live ASR string can be visibly broken (wrong script,
 * fused words) even when Gemini has interpreted the intent correctly. The
 * authoritative interpretation already exists in ConversationState —
 * `reasonText` is the phrase Gemini itself passed to the `find_department`
 * tool ("in the patient's own words", e.g. "tooth pain"), and
 * `selectedDepartment` / `selectedDoctor` are the backend-validated routing
 * results. This function composes those grounded pieces into one calm line.
 *
 * It never reads the raw ASR, never calls an LLM, and returns `null` when
 * nothing reliable is known yet — so the caller falls back to a neutral
 * "listening" state instead of inventing a sentence (the UI must never show
 * an invented patient statement).
 */
export function describePatientUnderstanding(state: ConversationState): string | null {
  const reason = state.reasonText?.trim() || null;
  const department = state.selectedDepartment?.name ?? null;
  const doctor = state.selectedDoctor?.name ?? null;

  if (doctor && reason) return `I understood you'd like to see ${doctor} for ${reason}.`;
  if (doctor && department) return `I understood you'd like to see ${doctor} in ${department}.`;
  if (department && reason)
    return `I understood you'd like help with ${reason} — I can take you to ${department}.`;
  if (department) return `I understood you'd like to visit ${department}.`;
  if (reason) return `I understood you mentioned ${reason}.`;
  return null;
}
