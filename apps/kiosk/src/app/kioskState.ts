/**
 * Full conceptual session state machine (docs/02 §21, docs/03 §4). Now
 * implemented through PROCESSING as of Phase 4 (transcript refinement +
 * quality guard, docs/03 §12 "Understanding what you said…"). The remaining
 * states are named here so the type system documents where identity/OTP,
 * routing, and OP/token work will attach later, without pretending they
 * exist yet.
 */
export type KioskState =
  | "idle"
  | "welcome"
  | "listening"
  | "processing"
  | "complete"
  // Human fallback (docs/03 §28, CLAUDE.md §12) — reachable from the welcome
  // screen and from a voice error, any time a person would serve the patient
  // better than the kiosk.
  | "receptionist"
  | "admin"
  // -- represented for future implementation only, not yet reachable --
  | "identity"
  | "routing"
  | "opRegistration"
  | "ticket";

export const IMPLEMENTED_STATES: ReadonlySet<KioskState> = new Set([
  "idle",
  "welcome",
  "listening",
  "processing",
  "complete",
  "receptionist",
  // Phase 5: reached directly from "listening" when the voice session ends
  // with a real, backend-generated OP ticket — bypasses the older
  // transcript-refinement flow below, which is still used whenever the
  // session ends WITHOUT a ticket (patient stopped early, error, etc.).
  "ticket",
  "admin",
]);
