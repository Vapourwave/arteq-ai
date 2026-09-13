import { useEffect, useRef, useState } from "react";
import type { VoiceSessionStatus } from "./useVoiceSession";

const POLL_INTERVAL_MS = 60;
const LEVEL_VISUAL_GAIN = 6;

export type OrbState = "connecting" | "listening" | "speaking" | "stopping" | "idle";

/** Maps the patient-facing phase (not the raw transport status) to an orb state. */
export function resolveOrbState(
  status: VoiceSessionStatus,
  phase: "connecting" | "welcoming" | "listening" | "speaking" | "blocked" | string,
  assistantSpeaking: boolean,
): OrbState {
  if (status === "stopping") return "stopping";
  if (status === "error") return "idle";
  if (status === "connecting" || phase === "connecting" || phase === "welcoming") return "connecting";
  if (phase === "speaking" || assistantSpeaking) return "speaking";
  if (phase === "listening") return "listening";
  return "idle";
}

/**
 * Mood Orbs Blob visual replacement for ARTEQ AI.
 * Animates slowly during idle, morphs faster and subtly pulses in scale
 * when the user or Gemini is speaking, driven by existing audio activity levels.
 */
export function VoiceOrb({
  status,
  phase,
  getInputLevel,
  getOutputLevel,
  isAssistantSpeaking,
}: {
  status: VoiceSessionStatus;
  phase: "welcoming" | "listening" | "speaking" | "blocked" | string;
  getInputLevel: () => number;
  getOutputLevel: () => number;
  isAssistantSpeaking: () => boolean;
}) {
  const [level, setLevel] = useState(0);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [blobType, setBlobType] = useState<string>(() => {
    return (
      localStorage.getItem("arteq_blob_type") ||
      (localStorage.getItem("arteq_dark_mode") === "true" ? "blob-1" : "blob-4")
    );
  });
  const smoothedLevel = useRef(0);

  useEffect(() => {
    const handleBlobChange = () => {
      setBlobType(
        localStorage.getItem("arteq_blob_type") ||
        (localStorage.getItem("arteq_dark_mode") === "true" ? "blob-1" : "blob-4")
      );
    };
    window.addEventListener("arteq_blob_type_changed", handleBlobChange);
    window.addEventListener("storage", handleBlobChange);
    return () => {
      window.removeEventListener("arteq_blob_type_changed", handleBlobChange);
      window.removeEventListener("storage", handleBlobChange);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const speaking = isAssistantSpeaking();
      const nextState = resolveOrbState(status, phase, speaking);
      setOrbState((prev) => (prev === nextState ? prev : nextState));

      const isGeminiSpeaking = phase === "speaking" || speaking;
      const userAudio = getInputLevel();
      const assistantAudio = getOutputLevel();

      let rawActivity = 0;
      if (isGeminiSpeaking) {
        rawActivity = assistantAudio * 3.5;
      } else if (phase === "listening" && userAudio > 0.015) {
        rawActivity = userAudio * LEVEL_VISUAL_GAIN;
      } else {
        rawActivity = 0;
      }

      smoothedLevel.current = smoothedLevel.current * 0.7 + Math.min(1, rawActivity) * 0.3;
      setLevel(smoothedLevel.current);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [status, phase, getInputLevel, getOutputLevel, isAssistantSpeaking]);

  const scale = 1 + level * 0.18;
  const animSpeed = 1 + level * 2.2;
  const paletteNum = blobType.replace("blob-", "");

  return (
    <div
      className={`voice-orb-wrapper blobs palette-${paletteNum}`}
      data-orb-state={orbState}
      aria-hidden="true"
      style={{
        transform: `scale(${scale})`,
        ["--anim-speed" as any]: animSpeed,
      }}
    >
      <svg viewBox="0 0 1200 1200">
        <g className="blob blob-1">
          <path />
        </g>
        <g className="blob blob-2">
          <path />
        </g>
        <g className="blob blob-3">
          <path />
        </g>
        <g className="blob blob-4">
          <path />
        </g>
        <g className="blob blob-1 alt">
          <path />
        </g>
        <g className="blob blob-2 alt">
          <path />
        </g>
        <g className="blob blob-3 alt">
          <path />
        </g>
        <g className="blob blob-4 alt">
          <path />
        </g>
      </svg>
    </div>
  );
}

