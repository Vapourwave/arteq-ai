import { describe, expect, it } from "vitest";
import { assessAssistantResponse } from "./assessAssistantResponse.js";

describe("assessAssistantResponse — clear (no unbacked specific claims)", () => {
  it("the fixed deterministic test reply used by the native-audio vertical slice is CLEAR", () => {
    const result = assessAssistantResponse("Thank you, I heard you. This is a test of the voice response.");
    expect(result.status).toBe("CLEAR");
    expect(result.reasons).toEqual([]);
  });

  it("empty text is CLEAR (nothing was said)", () => {
    const result = assessAssistantResponse("");
    expect(result.status).toBe("CLEAR");
  });

  it("generic reassurance with no specific factual claim is CLEAR", () => {
    const result = assessAssistantResponse("Don't worry, let's find a good time for you to see the doctor.");
    expect(result.status).toBe("CLEAR");
  });
});

describe("assessAssistantResponse — flags unbacked specific claims", () => {
  it("real captured fabrication: 'closed on Sundays' with no backend data behind it", () => {
    // The EXACT real captured hallucination from this project's native-audio
    // investigation (2026-08-30) — gemini-2.5-flash-native-audio-latest
    // invented this with zero backend/session data supporting it.
    const result = assessAssistantResponse(
      "Oh I understand. Tooth pain can be really bad. Let me check our appointments for today. " +
        "Just a moment... It looks like we are closed on Sundays, unfortunately. Is it an emergency?",
    );
    expect(result.status).toBe("REVIEW");
    expect(result.reasons).toContain("unbacked_hours_claim");
  });

  it("a named doctor with no known-facts backing is flagged", () => {
    const result = assessAssistantResponse("Dr. Anjali Menon can see you this afternoon.");
    expect(result.status).toBe("REVIEW");
    expect(result.reasons).toContain("unbacked_doctor_name");
  });

  it("a specific clock time with no known-facts backing is flagged", () => {
    const result = assessAssistantResponse("Please come in at 3:30 PM.");
    expect(result.status).toBe("REVIEW");
    expect(result.reasons).toContain("unbacked_specific_time");
  });
});

describe("assessAssistantResponse — a claim backed by known session facts is not flagged", () => {
  it("does not flag an hours claim that matches a provided known fact", () => {
    const result = assessAssistantResponse("We are closed on Sundays, unfortunately.", [
      "Clinic hours: closed on Sundays",
    ]);
    expect(result.status).toBe("CLEAR");
  });

  it("does not flag a doctor name that matches a provided known fact", () => {
    const result = assessAssistantResponse("Dr. Anjali Menon can see you this afternoon.", [
      "Available doctor: Dr. Anjali Menon",
    ]);
    expect(result.status).toBe("CLEAR");
  });
});

describe("assessAssistantResponse — never touches the patient transcript", () => {
  it("only ever takes the assistant's own text as input, has no patient-transcript parameter", () => {
    // Structural guarantee, not a runtime check: this test documents the
    // contract — assessAssistantResponse's signature has no way to receive
    // or mutate a patient transcript, by design.
    expect(assessAssistantResponse.length).toBeLessThanOrEqual(2);
  });
});
