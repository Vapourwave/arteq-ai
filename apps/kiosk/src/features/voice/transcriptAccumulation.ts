/**
 * Pure transcript-accumulation logic, extracted out of useVoiceSession so it
 * can be unit tested without React. This is the direct, evidence-based fix
 * for the natural-pause fragmentation bug found during voice-path testing:
 * Gemini Live can split one utterance-with-a-pause into several separate
 * `transcript_delta` events (five, in the captured evidence). The old code
 * did `transcriptRef.current += text`, gluing them together with nothing —
 * producing "എനിക്ക്എനിക്ക്" (words fused together with no space).
 *
 * Two fixes, both general and content-agnostic (not sentence-specific,
 * per Phase 4 constraint #13):
 *  - segments are joined with a single space, not concatenated raw
 *  - an exact-duplicate segment immediately following the previous one is
 *    dropped (Gemini Live occasionally re-sends the same phrase at a turn
 *    boundary — a cheap, zero-hallucination-risk guardrail applied at the
 *    earliest possible point, before the text ever leaves the browser)
 */
function mergeOverlappingWords(str1: string, str2: string): string | null {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  const maxOverlap = Math.min(words1.length, words2.length);
  for (let len = maxOverlap; len > 0; len--) {
    const slice1 = words1.slice(-len).join(" ").toLowerCase();
    const slice2 = words2.slice(0, len).join(" ").toLowerCase();
    if (slice1 === slice2) {
      return words1.concat(words2.slice(len)).join(" ");
    }
  }
  return null;
}

export function pushTranscriptSegment(segments: readonly string[], text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [...segments];
  const last = segments[segments.length - 1];
  if (last === trimmed) return [...segments];

  if (last) {
    // If incoming text extends the previous segment (e.g. ASR prefix extension: "I want" -> "I want to see")
    if (trimmed.toLowerCase().startsWith(last.toLowerCase())) {
      const next = [...segments];
      next[next.length - 1] = trimmed;
      return next;
    }
    // If incoming text is an earlier prefix or subset already contained in the previous segment
    if (last.toLowerCase().startsWith(trimmed.toLowerCase())) {
      return [...segments];
    }
    // If there is word overlap between the end of last and start of incoming
    const merged = mergeOverlappingWords(last, trimmed);
    if (merged) {
      const next = [...segments];
      next[next.length - 1] = merged;
      return next;
    }
  }

  return [...segments, trimmed];
}

export function joinTranscriptSegments(segments: readonly string[]): string {
  return segments.join(" ");
}
