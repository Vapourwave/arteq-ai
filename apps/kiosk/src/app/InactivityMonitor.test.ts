import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InactivityMonitor } from "./InactivityMonitor";

describe("InactivityMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function make(overrides: Partial<{ idleMs: number; graceMs: number }> = {}) {
    const onPrompt = vi.fn();
    const onReset = vi.fn();
    const monitor = new InactivityMonitor({
      idleMs: overrides.idleMs ?? 1000,
      graceMs: overrides.graceMs ?? 500,
      onPrompt,
      onReset,
      setTimer: (fn, ms) => setTimeout(fn, ms) as unknown as number,
      clearTimer: (h) => clearTimeout(h as unknown as ReturnType<typeof setTimeout>),
    });
    return { monitor, onPrompt, onReset };
  }

  it("prompts only after the full idle window with no activity", () => {
    const { monitor, onPrompt } = make();
    monitor.start();

    vi.advanceTimersByTime(999);
    expect(onPrompt).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onPrompt).toHaveBeenCalledTimes(1);
    expect(monitor.isPrompting).toBe(true);
  });

  it("resets the idle clock on activity, so an active patient is never prompted", () => {
    const { monitor, onPrompt } = make();
    monitor.start();

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(900);
      monitor.noteActivity();
    }

    expect(onPrompt).not.toHaveBeenCalled();
  });

  it("resets the session when the prompt goes unanswered for the grace window", () => {
    const { monitor, onPrompt, onReset } = make();
    monitor.start();

    vi.advanceTimersByTime(1000);
    expect(onPrompt).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(monitor.isPrompting).toBe(false);
  });

  it("treats activity during the grace window as 'still here' and does not reset", () => {
    const { monitor, onReset } = make();
    monitor.start();

    vi.advanceTimersByTime(1000); // prompt shows
    monitor.noteActivity(); // "I'm here"
    expect(monitor.isPrompting).toBe(false);

    vi.advanceTimersByTime(499);
    expect(onReset).not.toHaveBeenCalled();

    // ...and the idle clock has started over, so it prompts again later.
    vi.advanceTimersByTime(1);
    expect(onReset).not.toHaveBeenCalled();
  });

  it("stops firing anything after stop()", () => {
    const { monitor, onPrompt, onReset } = make();
    monitor.start();
    monitor.stop();

    vi.advanceTimersByTime(100000);
    expect(onPrompt).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("does not resurrect itself: noteActivity after a reset is a no-op", () => {
    const { monitor, onPrompt } = make();
    monitor.start();
    vi.advanceTimersByTime(1500); // prompt + reset

    monitor.noteActivity();
    vi.advanceTimersByTime(100000);
    expect(onPrompt).toHaveBeenCalledTimes(1); // not called a second time
  });
});
