import { describe, expect, it } from "vitest";
import { processTranscript } from "./processTranscript.js";
import type {
  QualityOutcome,
  RefineOutcome,
  TranscriptRefinementProvider,
} from "./TranscriptRefinementProvider.js";

/**
 * A fake provider lets us test the orchestrator's gating, failure isolation,
 * and fallback behavior deterministically, without real network calls or
 * non-deterministic LLM output.
 */
class FakeProvider implements TranscriptRefinementProvider {
  readonly name = "fake";
  refineCallCount = 0;
  qualityCallCount = 0;
  constructor(
    private refineImpl: (raw: string) => Promise<RefineOutcome>,
    private qualityImpl: (raw: string, clean: string) => Promise<QualityOutcome>,
  ) {}
  isConfigured() {
    return true;
  }
  refine(raw: string) {
    this.refineCallCount++;
    return this.refineImpl(raw);
  }
  assessQuality(raw: string, clean: string) {
    this.qualityCallCount++;
    return this.qualityImpl(raw, clean);
  }
}

const okRefine = async (raw: string): Promise<RefineOutcome> => ({ cleanTranscript: raw });
const okQuality = async (): Promise<QualityOutcome> => ({
  status: "CLEAR",
  score: 0.9,
  issues: [],
  reviewReason: null,
});

describe("processTranscript — empty/invalid input", () => {
  it("short-circuits empty raw input to INSUFFICIENT without calling the provider at all", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const result = await processTranscript(provider, "   ");
    expect(provider.refineCallCount).toBe(0);
    expect(provider.qualityCallCount).toBe(0);
    expect(result.quality.status).toBe("INSUFFICIENT");
    expect(result.cleanTranscript).toBe("");
    expect(result.diagnostics.usedFallback).toBe(false);
    expect(result.diagnostics.refinementExecuted).toBe(false);
  });
});

describe("processTranscript — fast path (gate finds no signals)", () => {
  it("clean English: refinement is skipped, quality guard still runs", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const result = await processTranscript(
      provider,
      "I have tooth pain and I want to see a dentist.",
      1,
    );
    expect(provider.refineCallCount).toBe(0);
    expect(provider.qualityCallCount).toBe(1);
    expect(result.diagnostics.refinementExecuted).toBe(false);
    expect(result.diagnostics.refinementLatencyMs).toBe(0);
    expect(result.cleanTranscript).toBe("I have tooth pain and I want to see a dentist.");
    expect(result.quality.status).toBe("CLEAR");
  });

  it("clean Malayalam: refinement is skipped", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const raw = "എനിക്ക് പല്ല് വേദന എടുക്കുന്നു. എനിക്ക് പല്ല് ഡോക്ടറിനെ കാണണം.";
    const result = await processTranscript(provider, raw, 1);
    expect(provider.refineCallCount).toBe(0);
    expect(result.cleanTranscript).toBe(raw);
  });

  it("clean Manglish: refinement is skipped", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const raw = "Enikku nalla pallu vedhna undu, dentistne kaananam.";
    const result = await processTranscript(provider, raw, 1);
    expect(provider.refineCallCount).toBe(0);
  });

  it("Malayalam + English code-switching must NOT be routed to refinement merely for mixing scripts", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const raw =
      "എനിക്ക് പല്ലുവേദന എടുക്കുന്നു. I want to see a dentist. My tooth really hurts. വളരെയധികം വേദന എടുക്കുന്നതുണ്ട്.";
    const result = await processTranscript(provider, raw, 1);
    expect(provider.refineCallCount).toBe(0);
    expect(result.diagnostics.gateSignals).toEqual([]);
  });

  it("a long but clean transcript: segment count alone must not force refinement", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const raw =
      "I have had a bad headache since this morning, and also some tooth pain on the left side. " +
      "It gets worse when I bite down. " +
      "I want to see a doctor about the headache and maybe a dentist about the tooth as well.";
    const result = await processTranscript(provider, raw, 3);
    expect(provider.refineCallCount).toBe(0);
  });

  it("quality guard ALWAYS runs even when refinement is skipped", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    await processTranscript(provider, "I have tooth pain.", 1);
    expect(provider.qualityCallCount).toBe(1);
  });
});

describe("processTranscript — slow path (gate finds signals, refinement runs)", () => {
  it("suspicious foreign-script contamination triggers refinement", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const raw = "I have tooth pain and I want to see a dentist. याद है?";
    const result = await processTranscript(provider, raw, 2);
    expect(provider.refineCallCount).toBe(1);
    expect(result.diagnostics.refinementExecuted).toBe(true);
    expect(result.diagnostics.gateSignals).toContain("unexpected_script");
  });

  it("garbled/fragmented transcript (many short segments) triggers refinement", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const raw = "And it can uh. Haan. dentistine kaana. uh huh. what.";
    const result = await processTranscript(provider, raw, 5);
    expect(provider.refineCallCount).toBe(1);
    expect(result.diagnostics.gateSignals).toContain("fragmented_short_segments");
  });

  it("ambiguous/borderline transcript: conservative default runs refinement", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const raw = "എനിക്ക് வலி ഉണ്ട്."; // one Tamil word amid otherwise-Malayalam speech
    const result = await processTranscript(provider, raw, 1);
    expect(provider.refineCallCount).toBe(1);
  });

  it("quality guard still runs after refinement executes", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    await processTranscript(provider, "याद है?", 1);
    expect(provider.qualityCallCount).toBe(1);
  });

  it("duplicate-repetition signal triggers refinement, and quality guard still runs", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const result = await processTranscript(provider, "I have have tooth pain", 1);
    expect(provider.refineCallCount).toBe(1);
    expect(provider.qualityCallCount).toBe(1);
    expect(result.diagnostics.refinementExecuted).toBe(true);
    expect(result.diagnostics.gateSignals).toContain("duplicate_adjacent_token");
  });
});

describe("processTranscript — latency measurement", () => {
  it("measures refinement, quality, and total latency when refinement executes", async () => {
    const provider = new FakeProvider(
      async (raw) => {
        await new Promise((r) => setTimeout(r, 5));
        return { cleanTranscript: raw };
      },
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        return okQuality();
      },
    );
    // Force escalation via fragmentation signal so refine() actually runs.
    const result = await processTranscript(provider, "some speech here", 3);
    expect(result.diagnostics.refinementExecuted).toBe(true);
    expect(result.diagnostics.refinementLatencyMs).toBeGreaterThan(0);
    expect(result.diagnostics.qualityLatencyMs).toBeGreaterThan(0);
    expect(result.diagnostics.totalLatencyMs).toBeGreaterThanOrEqual(
      result.diagnostics.refinementLatencyMs + result.diagnostics.qualityLatencyMs,
    );
  });

  it("reports zero refinement latency on the fast path", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const result = await processTranscript(provider, "I have tooth pain.", 1);
    expect(result.diagnostics.refinementExecuted).toBe(false);
    expect(result.diagnostics.refinementLatencyMs).toBe(0);
  });
});

describe("processTranscript — failure and fallback (refinement path)", () => {
  it("falls back to the raw transcript when refine() fails, and never throws", async () => {
    const provider = new FakeProvider(
      async () => {
        throw new Error("simulated refine failure");
      },
      okQuality,
    );
    // Force escalation so refine() is actually invoked and can fail.
    const result = await processTranscript(provider, "I have tooth pain.", 3);
    expect(result.cleanTranscript).toBe("I have tooth pain.");
    expect(result.diagnostics.usedFallback).toBe(true);
    expect(result.diagnostics.fallbackLatencyMs).not.toBeNull();
  });

  it("keeps a successful refinement even when assessQuality() fails (does not discard good work)", async () => {
    const provider = new FakeProvider(
      async (raw) => ({ cleanTranscript: `refined: ${raw}` }),
      async () => {
        throw new Error("simulated quality failure");
      },
    );
    const result = await processTranscript(provider, "I have tooth pain.", 3);
    expect(result.cleanTranscript).toBe("refined: I have tooth pain.");
    expect(result.quality.status).toBe("REVIEW");
    expect(result.diagnostics.usedFallback).toBe(true);
  });

  it("never returns a fabricated CLEAR when both stages fail", async () => {
    const provider = new FakeProvider(
      async () => {
        throw new Error("refine down");
      },
      async () => {
        throw new Error("quality down");
      },
    );
    const result = await processTranscript(provider, "I have tooth pain.", 3);
    expect(result.quality.status).not.toBe("CLEAR");
    expect(result.quality.reviewReason).toBeTruthy();
  });

  it("never returns a fabricated CLEAR when quality guard fails on the fast path (refinement skipped)", async () => {
    const provider = new FakeProvider(okRefine, async () => {
      throw new Error("quality down");
    });
    const result = await processTranscript(provider, "I have tooth pain.", 1);
    expect(provider.refineCallCount).toBe(0);
    expect(result.quality.status).not.toBe("CLEAR");
    expect(result.diagnostics.usedFallback).toBe(true);
  });
});

describe("processTranscript — repeated calls are independent (session isolation)", () => {
  it("does not leak state between consecutive calls", async () => {
    const provider = new FakeProvider(okRefine, okQuality);
    const first = await processTranscript(provider, "first session transcript");
    const second = await processTranscript(provider, "second session transcript");
    expect(first.cleanTranscript).toBe("first session transcript");
    expect(second.cleanTranscript).toBe("second session transcript");
  });
});
