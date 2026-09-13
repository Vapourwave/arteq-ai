import { useState } from "react";
import type { TTSProviderId } from "@arteq/shared";
import { TTS_TEST_UTTERANCES } from "./ttsTestFixtures";
import { useTTSTest } from "./useTTSTest";

/**
 * EXPERIMENTAL, dev-only screen for evaluating Fish S2 Pro as a TTS
 * provider (see docs/backend providers/tts/). Reachable only in
 * development mode (same `mode === "development"` gate IdleView already
 * uses for its manual presence trigger) — never shown to a patient, and
 * not part of the documented KioskState session machine, since this tool
 * plays canned test utterances, not real patient-facing output.
 *
 * Playback here buffers the full response into a Blob before playing (see
 * useTTSTest.ts) — it reports real network/provider time-to-first-byte
 * separately from time-to-playable so the gap between them is visible,
 * but does not yet do true progressive/MediaSource streaming playback.
 * That's flagged as a follow-up in the evaluation report, not silently
 * hidden here.
 */
export function TTSTestView({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState<TTSProviderId>("fish");
  const { status, errorMessage, latency, play } = useTTSTest();

  return (
    <div className="screen screen-tts-test">
      <p className="eyebrow">EXPERIMENTAL — dev only</p>
      <h1>TTS provider test</h1>

      <div className="tts-test-provider-select">
        <label>
          <input
            type="radio"
            name="tts-provider"
            value="fish"
            checked={provider === "fish"}
            onChange={() => setProvider("fish")}
          />
          Fish S2 Pro
        </label>
        <label>
          <input
            type="radio"
            name="tts-provider"
            value="current"
            checked={provider === "current"}
            onChange={() => setProvider("current")}
          />
          Current/default TTS (not implemented yet)
        </label>
      </div>

      <ul className="tts-test-utterance-list">
        {TTS_TEST_UTTERANCES.map((utterance) => (
          <li key={utterance.id}>
            <button
              className="secondary-action"
              disabled={status === "requesting"}
              onClick={() => void play(utterance.text, provider)}
            >
              [{utterance.category}] {utterance.label}
            </button>
            <span className="tts-test-utterance-text">{utterance.text}</span>
          </li>
        ))}
      </ul>

      <div className="tts-test-status" data-status={status}>
        {status === "requesting" && <p>Requesting…</p>}
        {status === "playing" && <p>Playing…</p>}
        {status === "error" && <p className="quality-note">{errorMessage}</p>}
        {latency && (
          <p className="hint">
            Time to first byte: {latency.timeToFirstByteMs.toFixed(0)}ms · Time to playable:{" "}
            {latency.timeToPlayableMs.toFixed(0)}ms
          </p>
        )}
      </div>

      <button className="primary-action" onClick={onClose}>
        Back
      </button>
    </div>
  );
}
