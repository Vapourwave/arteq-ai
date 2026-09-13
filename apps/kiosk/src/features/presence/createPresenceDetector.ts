import type { PresenceDetector } from "./PresenceDetector";
import { DevelopmentPresenceDetector } from "./DevelopmentPresenceDetector";
import { CameraPresenceDetector } from "./CameraPresenceDetector";

export type PresenceMode = "development" | "camera";

function readMode(): PresenceMode {
  const raw = import.meta.env.VITE_PRESENCE_MODE;
  return raw === "camera" ? "camera" : "development";
}

export function createPresenceDetector(): {
  detector: PresenceDetector;
  mode: PresenceMode;
} {
  const mode = readMode();
  const detector = mode === "camera" ? new CameraPresenceDetector() : new DevelopmentPresenceDetector();
  return { detector, mode };
}
