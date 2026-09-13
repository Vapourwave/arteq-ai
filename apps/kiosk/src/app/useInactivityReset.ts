import { useCallback, useEffect, useRef, useState } from "react";
import { InactivityMonitor } from "./InactivityMonitor";

// Public-hospital defaults. Deliberately generous: a patient reading the
// ticket screen or thinking about what to say must not be rushed, but an
// abandoned session must not linger for the next person (docs/03 §30).
const IDLE_MS = 60_000;
const GRACE_MS = 15_000;

/**
 * Wires InactivityMonitor to the DOM: window pointer/key events count as
 * activity, and the caller gets back whether the "Are you still there?"
 * prompt should show, a `confirmPresence()` for its button, and a
 * `notePatientActivity()` the voice screen calls whenever it detects the
 * patient is actually speaking.
 *
 * Bug 2 fix: on a kiosk the patient interacts by *voice*, not touch — so a
 * timer fed only by pointer/key events fires "Are you still there?" straight
 * over someone mid-sentence. The voice screen now reports microphone / ASR
 * activity through `notePatientActivity`, which resets the timer (and
 * dismisses the prompt if it is already up) exactly like a touch would.
 *
 * `enabled` should be true for every state except idle — there is nothing
 * to time out from the idle screen, and the presence detector owns that
 * transition.
 */
export function useInactivityReset({
  enabled,
  onReset,
}: {
  enabled: boolean;
  onReset: () => void;
}): { promptVisible: boolean; confirmPresence: () => void; notePatientActivity: () => void } {
  const [promptVisible, setPromptVisible] = useState(false);
  // Keep the latest onReset without re-creating the monitor each render.
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;
  const monitorRef = useRef<InactivityMonitor | null>(null);

  if (monitorRef.current === null) {
    monitorRef.current = new InactivityMonitor({
      idleMs: IDLE_MS,
      graceMs: GRACE_MS,
      onPrompt: () => setPromptVisible(true),
      onReset: () => {
        setPromptVisible(false);
        onResetRef.current();
      },
    });
  }

  useEffect(() => {
    const monitor = monitorRef.current!;
    if (!enabled) {
      monitor.stop();
      setPromptVisible(false);
      return;
    }

    monitor.start();
    const noteActivity = () => {
      monitor.noteActivity();
      if (monitor.isPrompting === false) setPromptVisible(false);
    };
    // `passive` — these listeners never call preventDefault; they only
    // observe. Capture phase so a tap anywhere still counts even if a child
    // stops propagation.
    window.addEventListener("pointerdown", noteActivity, { passive: true, capture: true });
    window.addEventListener("keydown", noteActivity, { passive: true, capture: true });
    return () => {
      monitor.stop();
      window.removeEventListener("pointerdown", noteActivity, { capture: true });
      window.removeEventListener("keydown", noteActivity, { capture: true });
    };
  }, [enabled]);

  // A sign of life — a touch on the "I'm still here" button, or the voice
  // screen detecting the patient is speaking. Re-arms the idle timer and,
  // if the prompt is already showing, takes it down (task: speaking again
  // must cancel it). `InactivityMonitor.noteActivity()` is a no-op unless
  // the monitor is running, and it always cancels the previous timer before
  // arming a new one, so repeated calls can never stack timers.
  const noteActivity = useCallback(() => {
    monitorRef.current!.noteActivity();
    setPromptVisible(false);
  }, []);

  return {
    promptVisible,
    confirmPresence: noteActivity,
    notePatientActivity: noteActivity,
  };
}
