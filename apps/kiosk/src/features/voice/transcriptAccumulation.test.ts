import { describe, expect, it } from "vitest";
import { joinTranscriptSegments, pushTranscriptSegment } from "./transcriptAccumulation";

describe("pushTranscriptSegment / joinTranscriptSegments", () => {
  it("joins a single English segment", () => {
    let segments: string[] = [];
    segments = pushTranscriptSegment(segments, "I have tooth pain and I want to see a dentist.");
    expect(joinTranscriptSegments(segments)).toBe("I have tooth pain and I want to see a dentist.");
  });

  it("joins multiple transcript segments with a space, not glued together", () => {
    let segments: string[] = [];
    segments = pushTranscriptSegment(segments, "എനിക്ക്");
    segments = pushTranscriptSegment(segments, "വല്ലാത്ത വേദനയുണ്ട് പല്ലിന്.");
    // Reproduces the exact fusion bug found in the natural-pause test —
    // must NOT produce "എനിക്ക്വല്ലാത്ത..." with no separator.
    expect(joinTranscriptSegments(segments)).toBe("എനിക്ക് വല്ലാത്ത വേദനയുണ്ട് പല്ലിന്.");
  });

  it("collapses an exact-duplicate segment immediately following the previous one", () => {
    let segments: string[] = [];
    segments = pushTranscriptSegment(segments, "എനിക്ക്");
    segments = pushTranscriptSegment(segments, "എനിക്ക്");
    expect(segments).toEqual(["എനിക്ക്"]);
    expect(joinTranscriptSegments(segments)).toBe("എനിക്ക്");
  });

  it("does NOT collapse the same phrase if it recurs non-adjacently (legitimate repetition)", () => {
    let segments: string[] = [];
    segments = pushTranscriptSegment(segments, "tooth pain");
    segments = pushTranscriptSegment(segments, "and a headache");
    segments = pushTranscriptSegment(segments, "tooth pain");
    expect(segments).toEqual(["tooth pain", "and a headache", "tooth pain"]);
  });

  it("ignores empty/whitespace-only deltas", () => {
    let segments: string[] = [];
    segments = pushTranscriptSegment(segments, "  ");
    segments = pushTranscriptSegment(segments, "");
    expect(segments).toEqual([]);
    expect(joinTranscriptSegments(segments)).toBe("");
  });

  it("preserves Manglish/code-switching content across segments", () => {
    let segments: string[] = [];
    segments = pushTranscriptSegment(segments, "എനിക്ക് നല്ല tooth pain ഉണ്ട്.");
    segments = pushTranscriptSegment(segments, "എനിക്ക് dentistനെ കാണണം.");
    expect(joinTranscriptSegments(segments)).toBe(
      "എനിക്ക് നല്ല tooth pain ഉണ്ട്. എനിക്ക് dentistനെ കാണണം.",
    );
  });

  it("handles a longer utterance built from many segments", () => {
    let segments: string[] = [];
    const parts = [
      "I have had",
      "a bad headache since this morning,",
      "and also tooth pain.",
      "I need to see a doctor",
      "as soon as possible.",
    ];
    for (const part of parts) segments = pushTranscriptSegment(segments, part);
    expect(joinTranscriptSegments(segments)).toBe(parts.join(" "));
  });

  it("starts empty for a new session (no leakage between sessions)", () => {
    const fresh: string[] = [];
    expect(joinTranscriptSegments(fresh)).toBe("");
  });
});
