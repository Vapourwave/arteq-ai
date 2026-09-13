/**
 * Pure, deterministic gate deciding whether the (comparatively expensive)
 * refinement LLM call is worth running for this raw transcript.
 *
 * This is NOT a correctness or semantic check — quality guard remains
 * mandatory for every non-empty transcript regardless of what this
 * function decides (Phase 4 latency architecture). Its only job is:
 * "is there structural evidence that cleanup is warranted?"
 *
 * Explicitly does NOT:
 *  - classify or identify language
 *  - score grammar/fluency
 *  - reject anything
 *  - use dictionary/word-list matching
 * If nothing here fires, that means no evidence was found — not that the
 * content was judged correct. When genuinely uncertain, this must lean
 * toward requesting refinement, never toward skipping it.
 */

export interface RawTranscriptAssessment {
  needsRefinement: boolean;
  signals: string[];
}

/**
 * Unicode ranges with no plausible connection to Malayalam, Manglish
 * (Latin script), or English: CJK Unified Ideographs, Hiragana, Katakana,
 * Hangul, Devanagari, Thai, Cyrillic, Arabic, and Tamil. Tamil is included
 * deliberately — it's the specific script Gemini Live's raw ASR has been
 * observed (real captured evidence) to substitute for Malayalam under
 * uncertainty. Its presence here is treated as UNCERTAINTY about the raw
 * transcript, not as a rejection of the content — presence only ever
 * requests a refinement pass, never a rejection, and Malayalam script and
 * Latin script (English/Manglish/code-switching) are never flagged by this
 * pattern, so legitimate multilingual/code-switched speech is unaffected.
 */
const UNEXPECTED_SCRIPT_PATTERN =
  // CJK ideographs | Hiragana+Katakana | Hangul | Devanagari | Thai | Cyrillic | Arabic | Tamil
  /[一-鿿぀-ヿ가-힯ऀ-ॿ฀-๿Ѐ-ӿ؀-ۿ஀-௿]/;

/** Fragmentation signals only apply once there are enough segments that a
 * pattern is meaningful — a normal two-part sentence must never trigger this. */
const MIN_SEGMENTS_FOR_FRAGMENTATION_SIGNAL = 3;

/** Conservative: only a genuinely low average segment length looks like ASR
 * noise (short, disconnected fragments) rather than real clauses/sentences.
 * A long, clean, naturally multi-segment utterance has segments well above
 * this — deliberately set low to avoid false positives on legitimate
 * longer speech (see Phase 4 latency architecture test 5/6). */
const SHORT_SEGMENT_AVERAGE_THRESHOLD = 15;

/**
 * Unicode-aware edge trim: strips leading/trailing punctuation and
 * separator characters (categories P* and Z*) only. Deliberately does NOT
 * touch combining marks (Mn/Mc) — Malayalam words routinely end in a
 * virama/chandrakkala combining mark, and stripping it would corrupt the
 * string being compared for duplication, causing false negatives.
 */
const EDGE_PUNCTUATION_PATTERN = /^[\p{P}\p{Z}]+|[\p{P}\p{Z}]+$/gu;

/** Below this, an immediately-repeated block is too short to be confident
 * evidence of a mechanical ASR repetition artifact rather than coincidental
 * structure inside a normal word — conservative per "when ambiguous, prefer
 * not triggering this signal" for the glued/no-separator case specifically. */
const MIN_REPEATED_BLOCK_LENGTH = 3;

/** Lowercases (a no-op for scripts without case, e.g. Malayalam) and trims
 * edge punctuation/whitespace so "dentist." and "dentist" compare equal, and
 * "I"/"i" compare equal, without altering the token's internal structure. */
function normalizeToken(token: string): string {
  return token.replace(EDGE_PUNCTUATION_PATTERN, "").toLowerCase();
}

/**
 * Detects an exact, whitespace-separated adjacent duplicate token — e.g.
 * "I I want to see a dentist", "have have tooth pain", "എനിക്ക് എനിക്ക്".
 * Purely structural (string equality after normalization) — no language
 * awareness, no dictionary, no minimum length beyond "non-empty", because a
 * single-token exact adjacent repeat (even "I I") is itself the mechanical
 * artifact pattern being detected, not a judgment about the word's meaning.
 */
function hasAdjacentWhitespaceDuplicate(tokens: string[]): boolean {
  for (let i = 1; i < tokens.length; i++) {
    const previous = normalizeToken(tokens[i - 1]);
    const current = normalizeToken(tokens[i]);
    if (previous.length > 0 && previous === current) {
      return true;
    }
  }
  return false;
}

/**
 * Detects an immediately concatenated duplicate with no separator at all —
 * e.g. "എനിക്ക്എനിക്ക്", or a duplicate glued onto other text like
 * "uhഎനിക്ക്എനിക്ക്". Exact-match only (no fuzzy/edit-distance matching,
 * per instruction): scans each whitespace-delimited token for any
 * contiguous block of at least MIN_REPEATED_BLOCK_LENGTH characters that is
 * immediately followed by an identical copy of itself. Bounded/cheap: token
 * lengths in a spoken utterance are small, so the nested scan is trivial in
 * practice despite worst-case O(n^2).
 */
function hasGluedDuplicate(token: string): boolean {
  const core = normalizeToken(token);
  const length = core.length;
  for (let start = 0; start + 2 * MIN_REPEATED_BLOCK_LENGTH <= length; start++) {
    for (let blockLength = MIN_REPEATED_BLOCK_LENGTH; start + 2 * blockLength <= length; blockLength++) {
      const firstBlock = core.slice(start, start + blockLength);
      const secondBlock = core.slice(start + blockLength, start + 2 * blockLength);
      if (firstBlock === secondBlock) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The duplicate-repetition gate signal. Deterministic, synchronous, pure,
 * language-independent, and non-semantic: it only ever asks "is there an
 * exact, immediate repetition of the same text", never what language that
 * text is in, whether it is grammatically correct, or whether it makes
 * sense. Non-adjacent repeated words (e.g. the same word used twice in
 * different parts of a sentence) are never flagged — only adjacency/gluing
 * counts as evidence of a mechanical ASR artifact.
 */
function hasDuplicateAdjacentToken(trimmed: string): boolean {
  const tokens = trimmed.split(/\s+/).filter((token) => token.length > 0);
  if (hasAdjacentWhitespaceDuplicate(tokens)) {
    return true;
  }
  return tokens.some(hasGluedDuplicate);
}

export function assessRawTranscript(
  rawTranscript: string,
  segmentCount: number,
): RawTranscriptAssessment {
  const signals: string[] = [];
  const trimmed = rawTranscript.trim();

  if (UNEXPECTED_SCRIPT_PATTERN.test(trimmed)) {
    signals.push("unexpected_script");
  }

  if (segmentCount >= MIN_SEGMENTS_FOR_FRAGMENTATION_SIGNAL) {
    const averageSegmentLength = trimmed.length / segmentCount;
    if (averageSegmentLength < SHORT_SEGMENT_AVERAGE_THRESHOLD) {
      signals.push("fragmented_short_segments");
    }
  }

  if (hasDuplicateAdjacentToken(trimmed)) {
    signals.push("duplicate_adjacent_token");
  }

  return { needsRefinement: signals.length > 0, signals };
}
