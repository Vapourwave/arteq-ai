/**
 * The "Are you still there?" check (docs/03 §30) — shown over the current
 * screen after a stretch of inactivity, just before the session would
 * otherwise reset. One clear action to keep going; doing nothing lets the
 * reset proceed and the next patient gets a clean slate.
 *
 * Deliberately plain (CLAUDE.md §17/§43): a quiet overlay, one heading, one
 * button — not a modal with a card, icon, and countdown ring.
 */
export function StillTherePrompt({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="overlay" role="alertdialog" aria-labelledby="still-there-heading">
      <div className="overlay-panel">
        <h2 id="still-there-heading">Are you still there?</h2>
        <p className="hint">This session will end in a moment.</p>
        <button className="primary-action" onClick={onConfirm} autoFocus>
          I'm still here
        </button>
      </div>
    </div>
  );
}
