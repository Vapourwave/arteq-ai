/**
 * Public-kiosk inactivity guard (docs/03 §30, CLAUDE.md §23).
 *
 * A patient can walk away at any point in the flow — mid-transcript, on the
 * ticket screen, halfway through a correction. Without this, the next
 * patient inherits the previous one's session (transcript, selected
 * department/doctor, ticket, and — once identity lands — their phone number
 * and patient record). That is both a privacy failure and a confusing UX.
 *
 * Two stages, matching the spec:
 *   idle for `idleMs`      -> onPrompt()  ("Are you still there?")
 *   no response for graceMs -> onReset()  (full session reset to idle)
 *
 * Deliberately framework-free and clock-injectable so the staging logic can
 * be unit-tested with fake timers, the same way transcriptAccumulation.ts
 * and VoiceOrb's resolveOrbState are tested without React.
 */

export interface InactivityMonitorOptions {
  /** Quiet time before the "still there?" prompt is shown. */
  idleMs: number;
  /** Time the prompt stays up unanswered before a full reset. */
  graceMs: number;
  /** Show the "Are you still there?" prompt. */
  onPrompt: () => void;
  /** Reset the whole session back to idle. */
  onReset: () => void;
  /** Injectable for tests; defaults to window timers. */
  setTimer?: (fn: () => void, ms: number) => number;
  clearTimer?: (handle: number) => void;
}

export class InactivityMonitor {
  private readonly idleMs: number;
  private readonly graceMs: number;
  private readonly onPrompt: () => void;
  private readonly onReset: () => void;
  private readonly setTimer: (fn: () => void, ms: number) => number;
  private readonly clearTimer: (handle: number) => void;

  private handle: number | null = null;
  private running = false;
  private prompting = false;

  constructor(options: InactivityMonitorOptions) {
    this.idleMs = options.idleMs;
    this.graceMs = options.graceMs;
    this.onPrompt = options.onPrompt;
    this.onReset = options.onReset;
    this.setTimer = options.setTimer ?? ((fn, ms) => window.setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((h) => window.clearTimeout(h));
  }

  /** True while the "Are you still there?" prompt should be visible. */
  get isPrompting(): boolean {
    return this.prompting;
  }

  /** Begin (or restart) watching. Safe to call repeatedly. */
  start(): void {
    this.running = true;
    this.prompting = false;
    this.armIdleTimer();
  }

  /** Stop watching entirely (e.g. once the session is already back at idle). */
  stop(): void {
    this.running = false;
    this.prompting = false;
    this.cancelTimer();
  }

  /**
   * Record a sign of life (touch, key, a new transcript delta, etc.). During
   * the idle phase this simply restarts the clock. During the grace phase it
   * is treated as "yes, I'm still here" — the prompt is dismissed and the
   * idle clock starts over. It never, on its own, triggers the reset.
   */
  noteActivity(): void {
    if (!this.running) return;
    this.prompting = false;
    this.armIdleTimer();
  }

  private armIdleTimer(): void {
    this.cancelTimer();
    this.handle = this.setTimer(() => {
      this.prompting = true;
      this.onPrompt();
      this.armGraceTimer();
    }, this.idleMs);
  }

  private armGraceTimer(): void {
    this.cancelTimer();
    this.handle = this.setTimer(() => {
      this.prompting = false;
      this.running = false;
      this.onReset();
    }, this.graceMs);
  }

  private cancelTimer(): void {
    if (this.handle !== null) {
      this.clearTimer(this.handle);
      this.handle = null;
    }
  }
}
