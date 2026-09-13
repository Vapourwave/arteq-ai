export function IdleView({
  showManualTrigger,
  onSimulatePresence,
  onOpenTTSTest,
  onOpenAdmin,
}: {
  showManualTrigger: boolean;
  onSimulatePresence: () => void;
  onOpenAdmin: () => void;
  /** DEV ONLY — opens the TTS evaluation screen. Gated behind the
   * VITE_SHOW_DEV_TOOLS flag (see config/demo.ts); omit to hide entirely,
   * which is the default for anything a client sees. */
  onOpenTTSTest?: () => void;
}) {
  return (
    <div className="screen screen-idle">
      <p className="eyebrow">ARTEQ AI</p>
      <h1>How can I help you?</h1>
      <p className="hint">Your AI hospital receptionist.</p>
      {showManualTrigger && (
        <button className="iridescent tap-to-begin-btn" onClick={onSimulatePresence}>
          Tap to begin
          <span className="drop-shadow"></span>
        </button>
      )}
      {onOpenTTSTest && (
        <button className="secondary-action" onClick={onOpenTTSTest}>
          TTS test (dev)
        </button>
      )}
      
      {/* Settings/Admin Icon */}
      <button 
        className="icon-button admin-trigger" 
        onClick={onOpenAdmin}
        aria-label="Settings"
        style={{ position: 'absolute', bottom: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>
  );
}
