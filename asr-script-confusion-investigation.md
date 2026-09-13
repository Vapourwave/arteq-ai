# ASR Script-Confusion Investigation Notes

**Status:** Open / unmitigated at the ASR layer. Not a regression introduced by
Phase 4's conditional-refinement or duplicate-repetition gate work — this
predates both and is tracked separately from them.

**Scope:** Gemini Live's raw speech-to-text output for this project's kiosk
sometimes renders Malayalam speech in the wrong Unicode script (most often
Tamil), or otherwise substitutes cross-language content, before any of this
project's own refinement/quality-guard code ever sees the text. This file is
the running record of real, captured evidence for that behavior — not
speculation, and not something to be "fixed" by making the Phase 4 gates more
aggressive about language (see "Why this isn't fixed by the gate" below).

---

## Root cause (established)

A dedicated 6-stage diagnostic trace (raw Gemini Live output → aggregation →
refinement input → refinement output → quality guard → final) was run earlier
in this project specifically to determine whether an observed Malayalam/
Manglish quality regression originated in Gemini Live's ASR or in this
project's own refinement prompt. The trace isolated the fault to **Gemini
Live's raw ASR / language-identification stage**, before any of this
project's refinement code runs. It is not caused by, and is not fixable by
editing, the refinement prompt or the deterministic gate.

## Mitigations investigated and their outcomes

- **`AudioTranscriptionConfig.languageCodes` (`ml-IN`, `en-IN`) as a hint to
  Gemini Live** — exists in the SDK's types and official docs, but confirmed
  via a real API error on this project's exact surface (Gemini Developer
  API, non-Vertex) to be unsupported: *"languageCodes parameter is not
  supported in Gemini API."* Implemented, verified broken against the real
  API, and reverted. Not to be re-attempted without new evidence that this
  API surface has changed.
- **Confidence/quality signal from the Live API** — SDK type inspection
  confirmed Gemini Live's `Transcription` type exposes no confidence score
  field. No lever available here.
- **Conservative refinement prompt (kept)** — rewritten to never translate
  Malayalam/Manglish into another language, never invent content, and
  explicitly preserve Manglish/Malayalam/English/code-switching rather than
  "fixing" it. This reduces *refinement's own* contribution to the problem
  but cannot correct what the ASR already mis-transcribed.
- **VAD tuning** — flagged as an untested hypothesis; explicitly deferred,
  out of scope for all work done so far.

## Why this isn't fixed by the Phase 4 gate

The deterministic `assessRawTranscript` gate's `unexpected_script` signal
(CJK, Hangul, Devanagari, Thai, Cyrillic, Arabic, **Tamil**) exists precisely
because Tamil is the specific script this project has observed Gemini Live
substituting for Malayalam under uncertainty. The gate can only ever
**route contaminated text to refinement so the quality guard can catch it**
— it cannot correct the ASR's script choice, and it was explicitly designed
never to attempt language classification or correction (CLAUDE.md's
closed-world/no-brittle-heuristics constraints). So this remains an
ASR-layer limitation with a downstream safety net, not a solved problem.

---

## Real captured evidence log

### Earlier investigation (pre-dates this session's conditional-refinement work)
Real captured contamination fixtures collected during the original
regression investigation, still used as real fixtures in
`rawTranscriptAssessment.test.ts` and `eval-transcript-refinement.ts`:
- A Hindi/Devanagari fragment appended to otherwise-clean English content
  (`"...I want to see a dentist. याद है?"`).
- A 4-segment Tamil/Hindi/Spanish multi-language contamination case.
- A 3-segment Japanese/CJK contamination case.

### 2026-08-27 — real-mic test, Malayalam→English→Hindi (no script confusion observed)
User-confirmed speech: Malayalam, then English, then Hindi. Gemini Live
rendered **each language in its own correct script** this time — Malayalam
in Malayalam script, English in English, Hindi in Devanagari. No Tamil
substitution occurred in this run. Gate correctly fired `unexpected_script`
on the genuine Devanagari content; refinement preserved all three languages
verbatim. Noted here as a negative data point — the failure mode is
intermittent, not deterministic.

(A separate, earlier set of console-log entries in the same browser tab that
session — containing Tamil/Spanish/Hindi-looking content — was explicitly
**not** attributed to the user's speech, since the user had not confirmed
producing it. Excluded from this log as unverified.)

### 2026-08-28 — real-mic test, Malayalam substituted with Tamil script (NEW finding)
User-confirmed speech: **"I said english and malayalam."** Raw transcript
captured by Gemini Live:

    I have have tooth pain. எனக்கு எனக்கு நல்ல நல்ல பல்லு வேதனை எடுக்கின்றது.

The English portion transcribed correctly (with a genuine spoken repetition,
"have have" — unrelated to this file, see the duplicate-repetition gate
work). **The Malayalam portion was rendered entirely in Tamil script**, not
Malayalam script — a direct, user-confirmed, real occurrence of exactly the
substitution pattern the `unexpected_script` signal was designed around.

Pipeline behavior on this input (diagnostics captured from the live run):
- Gate signals: `["unexpected_script", "duplicate_adjacent_token"]`
- `refinementExecuted: true`, `refinementLatencyMs: 3782.9`
- Refinement's cleaned output: `"I have tooth pain. எனக்கு நல்ல பல்ல⟡ு வேதனை எடுக்கின்றது."`
  — it correctly collapsed the spoken repetitions, but the Tamil-script
  content was **left as Tamil script**, not corrected to Malayalam (expected
  and correct per the conservative refinement prompt — refinement is
  explicitly forbidden from reinterpreting/translating script, only from
  removing genuine artifacts).
- **New sub-finding:** the refined output additionally contains a corrupted
  character in place of a Tamil vowel sign (rendered above as `⟡` — visually
  a stray/garbled glyph, not valid Tamil). This was not present in the raw
  transcript's rendering and appears to have been introduced during
  refinement's handling of the Tamil-script text.
- `qualityLatencyMs: 9288.6`, `totalLatencyMs: 13071.7`, `usedFallback: false`
- Quality guard correctly caught the corruption and returned a non-CLEAR
  verdict: *"The refined transcript contains mixed-script character
  corruption in the Tamil text."* Nothing was silently passed through as
  CLEAR.

**Why this finding matters:** it's the first time in this project that a
single real, user-confirmed capture demonstrates the full chain in one
run — genuine Malayalam speech, ASR substituting Tamil script, the gate
correctly escalating on it, refinement correctly declining to "fix" the
script, and the quality guard correctly catching a knock-on character
corruption. It also surfaces a **new, previously undocumented sub-issue**:
refinement may introduce character-level corruption when processing
Tamil-script ASR output specifically — this has not been investigated
further and has only been observed once.

---

### 2026-08-28 — reproducibility check: character corruption IS reproducible (~38%), and NOT always caught by the quality guard

Follow-up investigation: the exact real raw transcript captured above was
replayed against the running backend's real `POST /api/transcript/process`
endpoint (real Gemini calls, no mocking) **8 times in a row, unchanged
input** (`segmentCount=2`), via a temporary throwaway script — not added to
the repo, no production code touched.

Result: **3 of 8 runs (37.5%) reproduced the same corrupted character.**
The corruption is precise and consistent when it occurs: the vowel sign in
"பல்லு" (should be the Tamil vowel sign, U+0BC1) is substituted with the
**Malayalam** vowel sign U+0D41 — visually near-identical, but a literal
wrong-Unicode-block character mixed into an otherwise-Tamil word. This is
not random noise; it is the same specific substitution every time it
occurs.

**More serious sub-finding: the quality guard did not catch it every time.**
Of the 3 corrupted runs:
- 2 were correctly flagged non-CLEAR (`REVIEW`, with reasons independently
  describing the same phenomenon: *"a character rendering artifact
  combining Tamil letters with Malayalam vowel signs"* and *"corrupted text
  with mixed Tamil and Malayalam script characters"*).
- **1 was marked `CLEAR`** despite containing the identical corrupted
  character — meaning the safety net is not 100% reliable against this
  specific artifact. This is the first confirmed instance in this project
  of the quality guard missing a real, verifiable defect.

Distinct outputs observed across the 8 runs: only 2 — the correct Tamil
rendering, and the one specific corrupted variant. No other corruption
pattern appeared.

No code was changed to run this check. This finding is reported as-is,
without a fix, per the investigation-only scope of this task.

### 2026-08-28 — root cause of why the quality guard misses it sometimes

Investigated by reading the actual quality-guard implementation
(`GeminiTranscriptRefinementProvider.ts`) and the deterministic guardrails
(`guardrails.ts`) that wrap it. No code was changed — this is a root-cause
read, not a fix.

**Finding 1 — there is no deterministic backstop for this specific defect
class at all.** The deterministic guardrails (`checkLengthRatio`,
`checkScriptPreserved`, `checkNotEmpty`) run unconditionally after the LLM
quality call and can only ever push the verdict toward *more* caution — but
none of them are capable of catching this defect:
- `checkScriptPreserved` only fires when the **raw** transcript contains
  Malayalam script (`rawHasMalayalam`) and the **clean** transcript has lost
  it entirely. It checks one direction only — loss of legitimate Malayalam
  content. In this defect, the raw transcript contains *no* Malayalam-block
  characters at all (it's Tamil throughout, per the ASR substitution); the
  single stray Malayalam vowel sign is *introduced* into the clean output by
  refinement. `checkScriptPreserved` was never designed to detect a
  script character being *introduced* where the raw had none — it is
  structurally blind to this specific defect, not merely tuned
  conservatively.
- `checkLengthRatio` only measures overall length ratio — a one-character
  substitution changes nothing here.
- `checkNotEmpty` is irrelevant (output is non-empty).

So this defect class has **zero deterministic safety net**. Whether it gets
caught depends entirely on one non-deterministic LLM call.

**Finding 2 — the quality-guard prompt never names this defect class.** The
`QUALITY_SYSTEM_INSTRUCTION` prompt's flag list is:
`obvious speech-recognition artifacts`, `important information ... lost`,
`unresolved contradictions`, `unresolved self-corrections`, `incomplete`,
or `the text is severely corrupted`. Nothing in this list explicitly asks
the model to check for a single out-of-place Unicode character/wrong
writing-system glyph embedded inside an otherwise-coherent word. The
closest applicable criterion — "severely corrupted" — sets a bar this
defect doesn't naturally clear: the sentence remains grammatically
complete, meaningful, and fluent-reading; only one combining vowel sign is
from the wrong Unicode block. This is a **character-level/script-identity**
check, categorically different from the **semantic/coherence** checks the
rest of the prompt is built around, and the prompt has no instruction
directing the model to perform that categorically different kind of check.

**Finding 3 — the model demonstrably CAN perceive it, just not reliably.**
When the guard did catch it, its own `reviewReason` text explicitly named
the exact phenomenon (*"combining Tamil letters with Malayalam vowel
signs"*, *"mixed Tamil and Malayalam script characters"*) — proving the
model is capable of this specific character-level comparison when it
attends to it. The failure is not "the model doesn't understand the
concept"; it's that noticing one swapped glyph inside otherwise-fluent text
is not consistently attended to, unlike missing/duplicated words or
contradictions, which are far more salient at the semantic level the prompt
is oriented around. `temperature: 0.1` (low but non-zero) permits exactly
this kind of run-to-run variance in what the model happens to notice.

**Conclusion:** the quality guard misses this defect ~1 in 3 times because
(a) no deterministic guardrail is even capable of catching it — the defect
is entirely outside what any existing guardrail checks for, and (b) the
LLM-based check's own prompt never explicitly names "character-level
script-identity corruption" as something to look for, so catching it is
incidental to the model's semantic-coherence reasoning rather than a
reliably-triggered check. This is a **prompt/guardrail coverage gap**, not
a model reliability fluke unrelated to instructions.

### 2026-08-30 — new finding: garbled/wrong-script transcript did NOT mean the model misunderstood the speech

During real-mic testing of open-ended native-audio conversation (native-audio
vertical slice follow-up investigation), a new instance of script confusion
was captured and user-confirmed: the patient spoke Malayalam (answering
"how long has the pain lasted?"), and Gemini Live's `inputTranscription`
rendered it as garbled Japanese/CJK-adjacent text:

    え、でる、アンジュさんい。

This is a **new script pairing** for this issue — prior captures were
Malayalam→Tamil or Malayalam→Hindi/Devanagari substitution; this is the
first captured Malayalam→Japanese-script instance.

**The significant new part:** despite the completely garbled transcript
text, the assistant's actual spoken reply was coherent and directly
responsive to the real content of what was said — it replied
"അഞ്ചു ദിവസമായിട്ട് പല്ലുവേദന ഉണ്ടല്ലേ?" ("So it's been 5 days with the
tooth pain?"), correctly reflecting a "5 days" duration answer that bears
no resemblance to the garbled Japanese-looking transcript text. The user
directly confirmed this: *"the transcript was showing a japanese something
but the voice model clearly understood what i said... no matter what the
transcript reads the model clearly understands what user is saying."*

**Why this matters:** it indicates the `inputTranscription` text stream and
the model's actual audio-based comprehension are not the same thing and can
diverge — the transcription artifact may be a **display/text-layer bug**
that doesn't necessarily indicate the model's real-time conversational
understanding was also wrong. This is genuinely good news for the spoken
conversation experience itself, but does **not** resolve the underlying
problem for anything that depends on the TEXT transcript downstream (the
existing Phase 4 refinement/quality-guard pipeline, any future medical
record text, routing, or patient-identity capture all still only ever see
the corrupted transcript, not the model's better internal understanding) —
this remains a real, unmitigated problem for every text-dependent use of
the transcript, even though it may matter less for the live spoken
back-and-forth itself. Not yet investigated: whether this decoupling
(bad transcript, good comprehension) holds up as a general pattern or was
specific to this one capture — only one instance has been observed so far.

## Open questions / not yet investigated

1. ~~Is the character corruption a one-off or reproducible?~~ **Answered
   2026-08-28: reproducible, ~38% of runs on identical input, always the
   same specific Tamil→Malayalam vowel-sign substitution.**
2. ~~Why does the quality guard catch this defect only 2 out of 3 times it
   occurs?~~ **Answered 2026-08-28: no deterministic guardrail is capable of
   catching it (structural gap in `checkScriptPreserved`'s one-directional
   design), and the quality-guard LLM prompt never explicitly names this
   character-level defect class, so catching it is incidental rather than
   reliable. See above.**
3. Is there any correlation between which Malayalam phrases/words trigger
   the Tamil script substitution in the first place (the ASR-level issue)?
   Not enough real captures exist yet to look for a pattern.
4. VAD tuning remains an untested hypothesis for reducing ASR-level
   confusion generally — still explicitly out of scope until separately
   authorized.
5. **Not yet decided:** whether to close this gap with (a) a new
   deterministic guardrail that checks for characters from a
   script/Unicode-block inconsistent with the dominant script of the
   surrounding word/text, (b) an explicit addition to the quality-guard
   prompt naming this defect class, (c) both, or (d) leave as-is pending
   more real evidence. No implementation has been proposed or approved yet.

## Explicitly not done as part of maintaining this file
No production code was changed to create or update this document. No new
gate signal, prompt change, model change, or configuration change was made.
This is a documentation-only update recording real evidence.
