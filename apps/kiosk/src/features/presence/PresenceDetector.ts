/**
 * Presence means "someone is here," never "who is this" (CLAUDE.md §22,
 * docs/02 §23). Implementations must not perform facial recognition or any
 * form of identification — only a boolean-ish "a person is present" signal.
 */
export interface PresenceDetector {
  start(onPresence: () => void): void;
  stop(): void;
}
