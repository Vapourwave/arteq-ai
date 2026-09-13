import type { PresenceDetector } from "./PresenceDetector";

const SAMPLE_INTERVAL_MS = 400;
const FRAME_WIDTH = 96;
const FRAME_HEIGHT = 72;
// Fraction of sampled pixels that must change meaningfully between frames
// before we call it "presence." Deliberately coarse — this is motion
// detection, not identification (CLAUDE.md §22).
const CHANGE_FRACTION_THRESHOLD = 0.06;
const PIXEL_DELTA_THRESHOLD = 24;
// Consecutive motion samples required before firing, to avoid a single
// noisy frame (e.g. a passing shadow) triggering a false wake.
const CONSECUTIVE_SAMPLES_REQUIRED = 2;

/**
 * Lightweight webcam-based presence detector using frame-differencing
 * motion detection — NOT facial recognition, NOT identification. It only
 * answers "did something change in front of the camera," which is all
 * docs/02 §23 / docs/06 §11-12 ask presence detection to do for the MVP.
 *
 * This has NOT been verified against real hardware/lighting in this
 * environment (no camera available here) — per CLAUDE.md §39, that
 * verification must happen on the actual kiosk before this is trusted in
 * production. Treat this as a reference implementation to tune, not a
 * finished sensor.
 */
export class CameraPresenceDetector implements PresenceDetector {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private previousFrame: Uint8ClampedArray | null = null;
  private intervalId: number | null = null;
  private consecutiveHits = 0;
  private onPresence: (() => void) | null = null;

  async start(onPresence: () => void): Promise<void> {
    this.onPresence = onPresence;

    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn("[CameraPresenceDetector] camera not available in this environment");
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
      console.warn("[CameraPresenceDetector] camera permission denied or unavailable", err);
      return;
    }

    this.video = document.createElement("video");
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();

    this.canvas = document.createElement("canvas");
    this.canvas.width = FRAME_WIDTH;
    this.canvas.height = FRAME_HEIGHT;

    this.intervalId = window.setInterval(() => this.sample(), SAMPLE_INTERVAL_MS);
  }

  private sample(): void {
    if (!this.video || !this.canvas) return;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(this.video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    const frame = ctx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT).data;

    if (this.previousFrame) {
      let changed = 0;
      const totalPixels = FRAME_WIDTH * FRAME_HEIGHT;
      for (let i = 0; i < frame.length; i += 4) {
        const delta =
          Math.abs(frame[i] - this.previousFrame[i]) +
          Math.abs(frame[i + 1] - this.previousFrame[i + 1]) +
          Math.abs(frame[i + 2] - this.previousFrame[i + 2]);
        if (delta > PIXEL_DELTA_THRESHOLD) changed++;
      }

      if (changed / totalPixels > CHANGE_FRACTION_THRESHOLD) {
        this.consecutiveHits++;
        if (this.consecutiveHits >= CONSECUTIVE_SAMPLES_REQUIRED) {
          this.consecutiveHits = 0;
          this.onPresence?.();
        }
      } else {
        this.consecutiveHits = 0;
      }
    }

    this.previousFrame = frame;
  }

  stop(): void {
    if (this.intervalId !== null) window.clearInterval(this.intervalId);
    this.intervalId = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.previousFrame = null;
    this.onPresence = null;
  }
}
