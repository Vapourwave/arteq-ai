/**
 * Opt-in evaluation script for Phase 4 (transcript refinement + quality
 * guard) — NOT part of `npm test` (that suite is deterministic and
 * network-free). This script makes REAL calls to the running backend's
 * POST /api/transcript/process endpoint, which makes REAL Gemini calls.
 * Run manually: `npm run eval:transcript --workspace apps/backend`
 * (requires the backend dev server running with a configured GEMINI_API_KEY).
 *
 * This is the "real evidence" pass for cases that aren't practical to keep
 * re-recording live speech for: Malayalam/Manglish fidelity, hallucination
 * risk, the actual natural-pause fragmentation this project hit, and
 * duplicate-segment handling — per CLAUDE.md §39 "do not fake verification."
 *
 * Per docs/04 §40/§41, this doubles as a starting golden test set: each
 * fixture is a {raw, expectations} pair whose result gets printed for
 * before/after comparison on future model or prompt changes.
 */

const BACKEND_URL = process.env.EVAL_BACKEND_URL ?? "http://localhost:8787";

interface Fixture {
  name: string;
  rawTranscript: string;
  /** Real segment count when known from an actual capture; omitted (=1)
   * for hand-written single-utterance fixtures. Feeds the Phase 4
   * refinement gate exactly as the kiosk would report it. */
  segmentCount?: number;
  check: (result: any) => string[]; // returns list of failure messages, empty = pass
}

const MALAYALAM_PATTERN = /[ഀ-ൿ]/;
const SUSPICIOUS_INVENTED_TERMS = /\b(diagnosis|prescri(be|ption)|infection confirmed|cancer|surgery required)\b/i;

const fixtures: Fixture[] = [
  {
    name: "normal English speech",
    rawTranscript: "I have tooth pain and I want to see a dentist.",
    check: (r) => {
      const failures: string[] = [];
      if (!/tooth pain/i.test(r.cleanTranscript)) failures.push("lost 'tooth pain'");
      if (!/dentist/i.test(r.cleanTranscript)) failures.push("lost 'dentist'");
      if (SUSPICIOUS_INVENTED_TERMS.test(r.cleanTranscript)) failures.push("possible invented medical content");
      return failures;
    },
  },
  {
    name: "Malayalam",
    rawTranscript: "എനിക്ക് പല്ലുവേദന ഉണ്ട്. എനിക്ക് ഡെന്റിസ്റ്റിനെ കാണണം.",
    check: (r) => {
      const failures: string[] = [];
      if (!MALAYALAM_PATTERN.test(r.cleanTranscript)) failures.push("Malayalam script was dropped");
      return failures;
    },
  },
  {
    name: "Manglish/code-switching",
    rawTranscript: "എനിക്ക് നല്ല tooth pain ഉണ്ട്. എനിക്ക് dentistനെ കാണണം.",
    check: (r) => {
      const failures: string[] = [];
      const hasMalayalam = MALAYALAM_PATTERN.test(r.cleanTranscript);
      const hasEnglish = /tooth pain|dentist/i.test(r.cleanTranscript);
      if (!hasMalayalam && !hasEnglish) failures.push("both Malayalam and English content appear lost");
      return failures;
    },
  },
  {
    name: "natural pause — realistic post-fix input (space-joined, duplicate collapsed)",
    // Reconstructed from this project's actual captured pause-test segments
    // (backend diagnostic log: 5 segments, lengths 13/7/36/34/16) with the
    // frontend accumulation fix applied (space-joined, exact-duplicate
    // adjacent segment collapsed) — this is what the fixed pipeline now
    // actually sends.
    rawTranscript:
      "And it can uh എനിക്ക് വല്ലാത്ത വേദനയുണ്ട് പല്ലിന്. Haan, inke ghar mein dusre ka naam Vandistine kaana",
    segmentCount: 5, // real capture: backend diagnostic log showed 5 segments
    check: (r) => {
      const failures: string[] = [];
      if (!MALAYALAM_PATTERN.test(r.cleanTranscript)) failures.push("lost the legitimate Malayalam content");
      if (r.quality.status === "CLEAR") failures.push("quality guard should NOT be CLEAR for this garbled input");
      return failures;
    },
  },
  {
    name: "natural pause — adversarial worst-case (raw glued, no separators)",
    // The EXACT raw string this project actually captured and reported —
    // tests the refinement prompt's own resilience as a second line of
    // defense, in case some future segment source lacks the space-join fix.
    rawTranscript:
      "And it can uhഎനിക്ക്എനിക്ക് വല്ലാത്ത വേദനയുണ്ട് പല്ലിന്.Haan, inke ghar mein dusre ka naamVandistine kaana",
    segmentCount: 5, // real capture, pre-space-join fix — same 5 underlying segments
    check: (r) => {
      const failures: string[] = [];
      // Stale-assertion fix: this fixture's job is to prove the duplicate
      // fusion is cleaned up. It previously also asserted quality could
      // never be CLEAR — but the duplicate-repetition gate signal now
      // routes this input through refinement, which strips the corrupted
      // fusion entirely and returns a genuinely clean transcript; the
      // quality guard correctly marking that CLEAR is the desired outcome,
      // not a defect. See phase4-code-changes.txt / prior report section H.
      if (r.cleanTranscript.includes("എനിക്ക്എനിക്ക്")) failures.push("duplicate fusion 'എനിക്ക്എനിക്ക്' was not cleaned up");
      return failures;
    },
  },
  {
    name: "duplicate adjacent segments (explicit)",
    rawTranscript: "എനിക്ക് എനിക്ക് നല്ല തലവേദനയുണ്ട്.",
    check: (r) => {
      const failures: string[] = [];
      if (/എനിക്ക്\s+എനിക്ക്/.test(r.cleanTranscript)) failures.push("duplicate 'എനിക്ക് എനിക്ക്' was not collapsed");
      return failures;
    },
  },
  {
    name: "short utterance",
    rawTranscript: "tooth pain",
    check: (r) => {
      const failures: string[] = [];
      if (r.cleanTranscript.length > 40) failures.push("short utterance was padded/expanded unexpectedly");
      return failures;
    },
  },
  {
    name: "longer utterance",
    rawTranscript:
      "I have had a bad headache since this morning, and also some tooth pain on the left side. It gets worse when I bite down. I want to see a doctor about the headache and maybe a dentist about the tooth as well.",
    check: (r) => {
      const failures: string[] = [];
      for (const term of ["headache", "tooth", "left side", "doctor", "dentist"]) {
        if (!new RegExp(term, "i").test(r.cleanTranscript)) failures.push(`lost detail: "${term}"`);
      }
      return failures;
    },
  },
  {
    name: "empty/invalid input",
    rawTranscript: "   ",
    check: (r) => {
      const failures: string[] = [];
      if (r.quality.status !== "INSUFFICIENT") failures.push(`expected INSUFFICIENT, got ${r.quality.status}`);
      return failures;
    },
  },
  {
    name: "gate slow-path — real captured contamination (Tamil/Hindi/Spanish)",
    // Same real captured fixture used in rawTranscriptAssessment.test.ts —
    // reused here (not invented) so the eval script actually exercises the
    // refinement-runs branch against the real Gemini refinement call, since
    // none of the fixtures above trigger it.
    rawTranscript:
      "எனக்கு பல்லு வலி எடுக்குது. I want to see a dentist. 50 है। मैं क्यों पर स्मोकிங் करूं? ¿Eres de dónde?",
    segmentCount: 4,
    check: (r) => {
      const failures: string[] = [];
      if (!/tooth|dentist/i.test(r.cleanTranscript)) failures.push("lost the legitimate English content");
      return failures;
    },
  },
  {
    name: "gate slow-path — real captured fragmentation, no foreign script",
    rawTranscript: "And it can uh. Haan. dentistine kaana. uh huh. what.",
    segmentCount: 5,
    check: () => [], // no strong content expectation — this exercises latency/routing only
  },
];

async function runFixture(fixture: Fixture) {
  const start = Date.now();
  const response = await fetch(`${BACKEND_URL}/api/transcript/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawTranscript: fixture.rawTranscript, segmentCount: fixture.segmentCount ?? 1 }),
  });
  const wallMs = Date.now() - start;

  if (!response.ok) {
    console.log(`FAIL  ${fixture.name} — HTTP ${response.status}`);
    return { passed: false, refinementExecuted: null as boolean | null };
  }

  const result = await response.json();
  const failures = fixture.check(result);
  const status = failures.length === 0 ? "PASS" : "FAIL";
  const path = result.diagnostics.refinementExecuted ? "SLOW (refinement ran)" : "FAST (refinement skipped)";

  console.log(`${status}  ${fixture.name}  [${path}]`);
  console.log(`      clean: ${JSON.stringify(result.cleanTranscript)}`);
  console.log(
    `      quality: ${result.quality.status} (score=${result.quality.score}) reason=${JSON.stringify(result.quality.reviewReason)}`,
  );
  console.log(
    `      gate: signals=[${result.diagnostics.gateSignals.join(",")}]`,
  );
  console.log(
    `      latency: refine=${result.diagnostics.refinementLatencyMs.toFixed(0)}ms ` +
      `quality=${result.diagnostics.qualityLatencyMs.toFixed(0)}ms ` +
      `total=${result.diagnostics.totalLatencyMs.toFixed(0)}ms wall=${wallMs}ms ` +
      `fallback=${result.diagnostics.usedFallback} guardrails=[${result.diagnostics.guardrailsApplied.join(",")}]`,
  );
  for (const f of failures) console.log(`      ✗ ${f}`);
  console.log("");
  return { passed: failures.length === 0, refinementExecuted: result.diagnostics.refinementExecuted as boolean };
}

async function main() {
  console.log(`Evaluating against ${BACKEND_URL} — ${fixtures.length} fixtures\n`);
  let passed = 0;
  let fastPathCount = 0;
  let slowPathCount = 0;
  for (const fixture of fixtures) {
    const outcome = await runFixture(fixture);
    if (outcome.passed) passed++;
    if (outcome.refinementExecuted === true) slowPathCount++;
    if (outcome.refinementExecuted === false) fastPathCount++;
  }
  console.log(`\n${passed}/${fixtures.length} fixtures passed`);
  console.log(`Fast path (refinement skipped): ${fastPathCount} · Slow path (refinement ran): ${slowPathCount}`);
  if (passed !== fixtures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Evaluation script failed:", err);
  process.exitCode = 1;
});
