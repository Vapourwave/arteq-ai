/**
 * Human fallback (docs/03 §28, CLAUDE.md §12: "when a request exceeds the
 * system's scope, escalate to a human"). Reached from the welcome screen and
 * from a voice error — anywhere the patient would be better served by a
 * person.
 *
 * The tone matters: per the spec this must never read like an error or a
 * punishment for "using it wrong". It is a normal, offered path.
 */
export function ReceptionistHandoffView({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen screen-receptionist">
      <h1>A receptionist can help you</h1>
      <p className="hint">
        Please step over to the front desk — a member of staff will assist you.
      </p>
      <button className="secondary-action" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
