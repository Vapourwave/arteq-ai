import type { PresenceDetector } from "./PresenceDetector";

/**
 * Development/demo stand-in for real presence sensing. Does nothing on its
 * own — IdleView renders a "Tap to begin" affordance that calls `simulate()`
 * when this detector is active, so the full kiosk flow can be exercised
 * without a webcam or CV model (per Stage-2 directive §5: "a simple/manual/
 * dev trigger may be used" during early development).
 */
export class DevelopmentPresenceDetector implements PresenceDetector {
  private onPresence: (() => void) | null = null;

  start(onPresence: () => void): void {
    this.onPresence = onPresence;
  }

  stop(): void {
    this.onPresence = null;
  }

  simulate(): void {
    this.onPresence?.();
  }
}
