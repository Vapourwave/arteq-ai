import { describe, expect, it } from "vitest";
import { assessRawTranscript } from "./rawTranscriptAssessment.js";

describe("assessRawTranscript — fast path (no signals, refinement skipped)", () => {
  it("clean English, single segment", () => {
    const result = assessRawTranscript("I have tooth pain and I want to see a dentist.", 1);
    expect(result.needsRefinement).toBe(false);
    expect(result.signals).toEqual([]);
  });

  it("clean Malayalam, single segment", () => {
    const result = assessRawTranscript(
      "എനിക്ക് പല്ല് വേദന എടുക്കുന്നു. എനിക്ക് പല്ല് ഡോക്ടറിനെ കാണണം.",
      1,
    );
    expect(result.needsRefinement).toBe(false);
  });

  it("clean Manglish, single segment", () => {
    const result = assessRawTranscript("Enikku nalla pallu vedhna undu, dentistne kaananam.", 1);
    expect(result.needsRefinement).toBe(false);
  });

  it("Malayalam + English code-switching must NOT be flagged merely for mixing scripts", () => {
    const result = assessRawTranscript(
      "എനിക്ക് പല്ലുവേദന എടുക്കുന്നു. I want to see a dentist. My tooth really hurts. വളരെയധികം വേദന എടുക്കുന്നതുണ്ട്.",
      1,
    );
    expect(result.needsRefinement).toBe(false);
    expect(result.signals).toEqual([]);
  });

  it("a long but clean transcript — segment count alone must not force refinement", () => {
    // Real captured "longer utterance" fixture, split across a plausible
    // number of natural clause-boundary segments, each substantial.
    const raw =
      "I have had a bad headache since this morning, and also some tooth pain on the left side. " +
      "It gets worse when I bite down. " +
      "I want to see a doctor about the headache and maybe a dentist about the tooth as well.";
    const result = assessRawTranscript(raw, 3);
    expect(result.needsRefinement).toBe(false);
  });
});

describe("assessRawTranscript — escalates to refinement", () => {
  it("real captured contamination: Hindi Devanagari fragment (from this project's investigation)", () => {
    const raw = "I have tooth pain and I want to see a dentist. याद है?";
    const result = assessRawTranscript(raw, 2);
    expect(result.needsRefinement).toBe(true);
    expect(result.signals).toContain("unexpected_script");
  });

  it("real captured contamination: Tamil/Hindi/Spanish multi-segment fragmentation", () => {
    const raw =
      "எனக்கு பல்லு வலி எடுக்குது. I want to see a dentist. 50 है। मैं क्यों पर स्मोकிங் करूं? ¿Eres de dónde?";
    const result = assessRawTranscript(raw, 4);
    expect(result.needsRefinement).toBe(true);
    expect(result.signals).toContain("unexpected_script");
  });

  it("real captured contamination: Japanese/CJK fragment", () => {
    const raw =
      "എനിക്ക് പല്ല് വേദനിക്കുന്നു. ഐ വാണ്ട് ടു സീ എ ഡെന്റിസ്റ്റ്. 我 要 弄 瑞 。 お いの の バウチャー の 流れ で ね 、 えい の の 流れ で";
    const result = assessRawTranscript(raw, 3);
    expect(result.needsRefinement).toBe(true);
    expect(result.signals).toContain("unexpected_script");
  });

  it("garbled/fragmented transcript with many short segments, no foreign script", () => {
    // Same shape as the captured natural-pause fixture: several short,
    // disconnected fragments — should escalate on fragmentation alone.
    const raw = "And it can uh. Haan. dentistine kaana. uh huh. what.";
    const result = assessRawTranscript(raw, 5);
    expect(result.needsRefinement).toBe(true);
    expect(result.signals).toContain("fragmented_short_segments");
  });

  it("ambiguous/borderline: a single unfamiliar-script word amid otherwise clean speech — conservative default", () => {
    const raw = "എനിക്ക് வலி ഉണ്ട്."; // one Tamil word amid Malayalam
    const result = assessRawTranscript(raw, 1);
    expect(result.needsRefinement).toBe(true);
  });
});

describe("assessRawTranscript — never rejects, only signals", () => {
  it("always returns a decision without throwing, even for empty input", () => {
    expect(() => assessRawTranscript("", 0)).not.toThrow();
  });
});

describe("assessRawTranscript — duplicate-repetition gate signal", () => {
  it("whitespace-separated duplicate: 'I have have tooth pain'", () => {
    const result = assessRawTranscript("I have have tooth pain", 1);
    expect(result.needsRefinement).toBe(true);
    expect(result.signals).toContain("duplicate_adjacent_token");
  });

  it("whitespace-separated duplicate at the start: 'I I want to see a dentist'", () => {
    const result = assessRawTranscript("I I want to see a dentist", 1);
    expect(result.needsRefinement).toBe(true);
    expect(result.signals).toContain("duplicate_adjacent_token");
  });

  it("Malayalam whitespace-separated duplicate: 'എനിക്ക് എനിക്ക്'", () => {
    const result = assessRawTranscript("എനിക്ക് എനിക്ക് നല്ല തലവേദനയുണ്ട്.", 1);
    expect(result.needsRefinement).toBe(true);
    expect(result.signals).toContain("duplicate_adjacent_token");
  });

  it("Malayalam glued duplicate with no separator: 'എനിക്ക്എനിക്ക്'", () => {
    // The exact real captured adversarial fixture from this project's eval
    // suite (apps/backend/scripts/eval-transcript-refinement.ts) — a
    // duplicate glued directly onto other text with no space at all.
    const raw =
      "And it can uhഎനിക്ക്എനിക്ക് വല്ലാത്ത വേദനയുണ്ട് പല്ലിന്.Haan, inke ghar mein dusre ka naamVandistine kaana";
    const result = assessRawTranscript(raw, 5);
    expect(result.needsRefinement).toBe(true);
    expect(result.signals).toContain("duplicate_adjacent_token");
  });

  it("does not flag a normal Malayalam sentence", () => {
    const result = assessRawTranscript(
      "എനിക്ക് പല്ല് വേദന എടുക്കുന്നു. എനിക്ക് പല്ല് ഡോക്ടറിനെ കാണണം.",
      1,
    );
    expect(result.signals).not.toContain("duplicate_adjacent_token");
  });

  it("does not flag a normal English sentence", () => {
    const result = assessRawTranscript("I have tooth pain and I want to see a dentist.", 1);
    expect(result.signals).not.toContain("duplicate_adjacent_token");
  });

  it("does not flag a normal Manglish sentence", () => {
    const result = assessRawTranscript("Enikku nalla pallu vedhna undu, dentistne kaananam.", 1);
    expect(result.signals).not.toContain("duplicate_adjacent_token");
  });

  it("does not flag Malayalam + English code-switching merely for mixing languages", () => {
    const result = assessRawTranscript(
      "എനിക്ക് പല്ലുവേദന എടുക്കുന്നു. I want to see a dentist. My tooth really hurts. വളരെയധികം വേദന എടുക്കുന്നതുണ്ട്.",
      1,
    );
    expect(result.signals).not.toContain("duplicate_adjacent_token");
  });

  it("does not aggressively flag the same word repeated in non-adjacent positions of an otherwise normal sentence", () => {
    // Hand-written (not a real capture) — deliberately reuses "I" three
    // times, none of them adjacent, to prove only adjacency/gluing counts
    // as evidence, never repetition of a word anywhere in the sentence.
    const raw = "I want to see a dentist. I have had pain since morning. I really need help.";
    const result = assessRawTranscript(raw, 1);
    expect(result.signals).not.toContain("duplicate_adjacent_token");
  });
});
