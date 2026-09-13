export function WelcomeView({
  onSpeak,
  onAskReceptionist,
}: {
  onSpeak: () => void;
  onAskReceptionist: () => void;
}) {
  return (
    <div className="screen screen-welcome">
      <h1>Welcome. How can I help you?</h1>
      <p className="hint">Speak naturally, in Malayalam, Manglish, or English.</p>
      <button className="iridescent mic-button icon-button mic-btn tap-to-speak-btn" onClick={onSpeak} aria-label="Speak">
        <MicIcon />
        <span className="drop-shadow"></span>
      </button>
      <p className="hint">Tap to speak</p>
      <button className="link-action" type="button" onClick={onAskReceptionist}>
        Ask a receptionist
      </button>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
