import type { TranscriptProcessingResult } from "@arteq/shared";

/**
 * Shown when a voice session ends WITHOUT reaching an OP ticket (the patient
 * stopped early, or only wanted to talk). Reflects back the REFINED
 * transcript — never the raw ASR output (Phase 4 decision 4). A short
 * quality note appears only when the quality guard didn't return CLEAR; a
 * CLEAR result shows nothing extra ("show only what helps", docs/03 §2.1).
 *
 * Deliberately a calm dead-end with one clear next step, not a
 * work-in-progress screen — nothing here should read as unfinished to a
 * client watching a demo.
 */
export function CompleteView({
  result,
  onStartOver,
}: {
  result: TranscriptProcessingResult;
  onStartOver: () => void;
}) {
  const { cleanTranscript, quality } = result;
  const showQualityNote = quality.status !== "CLEAR";

  return (
    <div className="screen screen-complete">
      <h1>Here's what I heard</h1>
      <p className="transcript-result">{cleanTranscript || "(no speech captured)"}</p>
      {showQualityNote && (
        <p className="quality-note" data-status={quality.status}>
          {quality.reviewReason ?? "Let's make sure I understood you correctly."}
        </p>
      )}
      <p className="hint">
        If that's not right, start again — or ask a receptionist at the front desk.
      </p>
      <button className="primary-action" onClick={onStartOver}>
        Start over
      </button>
    </div>
  );
}
