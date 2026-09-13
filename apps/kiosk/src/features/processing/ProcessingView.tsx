import { useEffect, useRef, useState } from "react";
import type { TranscriptProcessingResult } from "@arteq/shared";
import { useTranscriptProcessing } from "../transcript/useTranscriptProcessing";

// After this long, add a quiet second line so a longer-than-usual wait never
// looks frozen (docs/03 §12/§33 — an honest wait state, not "AI thinking"
// theatre, but also not a dead screen).
const REASSURANCE_AFTER_MS = 5000;

/**
 * The documented PROCESSING state (docs/03 §12 "Understanding what you
 * said…"), sitting between LISTENING and COMPLETE. Calls the Phase 4
 * refinement + quality-guard endpoint once, on mount, over the raw
 * transcript captured during LISTENING.
 *
 * Deliberately minimal per docs/03 §33: a short, honest wait state, not
 * "AI thinking" theatre — reuses the same calm pulsing-dot treatment as the
 * listening screen rather than inventing new decorative animation.
 */
export function ProcessingView({
  rawTranscript,
  segmentCount,
  onFinished,
}: {
  rawTranscript: string;
  segmentCount: number;
  onFinished: (result: TranscriptProcessingResult) => void;
}) {
  const { process } = useTranscriptProcessing();
  const startedRef = useRef(false);
  const [showReassurance, setShowReassurance] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void process(rawTranscript, segmentCount).then(onFinished);
  }, [process, rawTranscript, segmentCount, onFinished]);

  useEffect(() => {
    const id = window.setTimeout(() => setShowReassurance(true), REASSURANCE_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="screen screen-processing">
      <h1>Understanding what you said…</h1>
      <div className="listening-dot" aria-hidden="true" />
      {showReassurance && <p className="hint">Just a moment.</p>}
    </div>
  );
}
