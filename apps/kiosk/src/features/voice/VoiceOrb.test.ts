import { describe, expect, it } from "vitest";
import { resolveOrbState } from "./VoiceOrb";

describe("resolveOrbState", () => {
  it("shows connecting while welcoming (greeting playing), regardless of transport status", () => {
    expect(resolveOrbState("connecting", "welcoming", false)).toBe("connecting");
    expect(resolveOrbState("listening", "welcoming", false)).toBe("connecting");
    expect(resolveOrbState("listening", "welcoming", true)).toBe("connecting");
  });

  it("shows connecting when status or phase is connecting", () => {
    expect(resolveOrbState("connecting", "connecting", false)).toBe("connecting");
    expect(resolveOrbState("connecting", "listening", false)).toBe("connecting");
    expect(resolveOrbState("listening", "connecting", false)).toBe("connecting");
  });

  it("shows listening once the patient is in listening phase and assistant isn't speaking", () => {
    expect(resolveOrbState("listening", "listening", false)).toBe("listening");
  });

  it("shows speaking when assistant's audio is actively playing", () => {
    expect(resolveOrbState("listening", "speaking", false)).toBe("speaking");
    expect(resolveOrbState("listening", "listening", true)).toBe("speaking");
  });

  it("shows stopping while a session is winding down", () => {
    expect(resolveOrbState("stopping", "listening", false)).toBe("stopping");
    expect(resolveOrbState("stopping", "speaking", true)).toBe("stopping");
  });

  it("falls back to idle for error status", () => {
    expect(resolveOrbState("error", "listening", false)).toBe("idle");
  });
});
