import { describe, expect, it } from "vitest";
import { applyGuardrails, checkLengthRatio, checkNotEmpty, checkScriptPreserved } from "./guardrails.js";
import type { QualityOutcome } from "./TranscriptRefinementProvider.js";

const CLEAR: QualityOutcome = { status: "CLEAR", score: 0.95, issues: [], reviewReason: null };

describe("checkNotEmpty", () => {
  it("flags empty/invalid refinement output as INSUFFICIENT", () => {
    const finding = checkNotEmpty("   ");
    expect(finding?.severity).toBe("INSUFFICIENT");
  });

  it("does not flag normal short output", () => {
    expect(checkNotEmpty("I have tooth pain.")).toBeNull();
  });
});

describe("checkLengthRatio", () => {
  it("does not flag a normal-length English sentence", () => {
    expect(
      checkLengthRatio(
        "I have tooth pain and I want to see a dentist.",
        "I have tooth pain and I want to see a dentist.",
      ),
    ).toBeNull();
  });

  it("does not flag legitimate short utterances (below the trivial-length threshold)", () => {
    // Short utterances must not be penalized just for being short.
    expect(checkLengthRatio("tooth pain", "tooth pain")).toBeNull();
  });

  it("handles longer utterances without a false positive", () => {
    const raw =
      "Enikku innu kaalathu muthal nalla thalavedanayum pinne pallu vedanayum undu, doctor ne kaananam.";
    const clean =
      "I have had a bad headache since this morning, and also tooth pain. I need to see a doctor.";
    expect(checkLengthRatio(raw, clean)).toBeNull();
  });

  it("flags apparent content loss (clean much shorter than raw) — possible dropped Malayalam", () => {
    const raw =
      "Enikku nalla thalavedanayum pallu vedanayum undu, doctor ne kaananam, ithu valare severe aanu.";
    const clean = "pain.";
    const finding = checkLengthRatio(raw, clean);
    expect(finding?.severity).toBe("REVIEW");
    expect(finding?.guardrail).toBe("length_ratio_short");
  });

  it("flags apparent invented/hallucinated content (clean much longer than raw)", () => {
    const raw = "I have tooth pain.";
    const clean =
      "The patient reports severe, persistent tooth pain that began three days ago, radiating to the jaw, worse at night, with associated swelling and no relief from over the counter medication.";
    const finding = checkLengthRatio(raw, clean);
    expect(finding?.severity).toBe("REVIEW");
    expect(finding?.guardrail).toBe("length_ratio_long");
  });
});

describe("checkScriptPreserved", () => {
  it("does not flag pure English", () => {
    expect(
      checkScriptPreserved(
        "I have tooth pain and I want to see a dentist.",
        "I have tooth pain and I want to see a dentist.",
      ),
    ).toBeNull();
  });

  it("does not flag Malayalam preserved correctly", () => {
    expect(
      checkScriptPreserved(
        "എനിക്ക് പല്ലുവേദന ഉണ്ട്. എനിക്ക് ഡെന്റിസ്റ്റിനെ കാണണം.",
        "എനിക്ക് പല്ലുവേദന ഉണ്ട്, എനിക്ക് ഡെന്റിസ്റ്റിനെ കാണണം.",
      ),
    ).toBeNull();
  });

  it("does not flag Manglish/code-switching (no Malayalam script on either side)", () => {
    expect(
      checkScriptPreserved(
        "Enikku nalla tooth pain undu, dentistine kaananam.",
        "I have severe tooth pain, I need to see a dentist.",
      ),
    ).toBeNull();
  });

  it("flags Malayalam content dropped from the refined transcript", () => {
    const raw = "എനിക്ക് നല്ല തലവേദനയും പല്ലുവേദനയും ഉണ്ട്, ഡെന്റിസ്റ്റിനെ കാണണം.";
    const clean = "I have a headache.";
    const finding = checkScriptPreserved(raw, clean);
    expect(finding?.severity).toBe("REVIEW");
    expect(finding?.guardrail).toBe("malayalam_script_lost");
  });
});

describe("applyGuardrails — never upgrades toward CLEAR, only downgrades", () => {
  it("leaves a CLEAR verdict alone when nothing is wrong", () => {
    const result = applyGuardrails(
      "I have tooth pain and I want to see a dentist.",
      "I have tooth pain and I want to see a dentist.",
      CLEAR,
    );
    expect(result.status).toBe("CLEAR");
    expect(result.guardrailsApplied).toEqual([]);
  });

  it("downgrades a CLEAR LLM verdict to REVIEW when a guardrail fires", () => {
    // LLM (incorrectly) says CLEAR, but content was clearly dropped.
    const result = applyGuardrails(
      "Enikku nalla thalavedanayum pallu vedanayum undu, doctor ne kaananam, valare severe aanu ithu.",
      "pain",
      CLEAR,
    );
    expect(result.status).toBe("REVIEW");
    expect(result.guardrailsApplied).toContain("length_ratio_short");
  });

  it("never downgrades INSUFFICIENT back up, and empty output always wins as INSUFFICIENT", () => {
    const result = applyGuardrails("some raw text here that is long enough", "", CLEAR);
    expect(result.status).toBe("INSUFFICIENT");
  });

  it("keeps the more severe of the LLM verdict and guardrail findings", () => {
    const llmSaysReview: QualityOutcome = {
      status: "REVIEW",
      score: 0.5,
      issues: ["ambiguous request"],
      reviewReason: "Please confirm.",
    };
    // No guardrail fires here — result should stay REVIEW (from the LLM), not be cleared.
    const result = applyGuardrails(
      "I have tooth pain and I want to see a dentist.",
      "I have tooth pain and I want to see a dentist.",
      llmSaysReview,
    );
    expect(result.status).toBe("REVIEW");
    expect(result.issues).toContain("ambiguous request");
  });
});
