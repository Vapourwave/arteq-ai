import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 150;
// Treat the viewport as "at the bottom" within this many px — auto-follow
// stays on while the reader is here, and switches back on the moment they
// scroll back down to it.
const STICK_THRESHOLD_PX = 32;

/**
 * Isolated, self-contained live transcript display.
 *
 * Architectural core of CLAUDE.md §7 / docs/02 §9: instead of the parent
 * pushing every transcript delta down as a prop (which would re-render the
 * whole kiosk tree many times a second and risk starving the audio
 * callback), this component POLLS a getter on its own timer and is the only
 * thing that re-renders when new text arrives.
 *
 * The text lives inside a bounded, internally-scrolling region so a long
 * utterance or a long spoken reply can never grow the screen or push the
 * orb / controls around. New segments fade in individually; existing text
 * stays put. While the reader is at the bottom the newest text is kept in
 * view; if they scroll up to re-read, auto-follow backs off until they
 * return.
 *
 * Segments (not one joined string) are the render unit so only a newly
 * appended segment animates — the paragraph as a whole never re-animates on
 * each rapid ASR delta.
 */
export function LiveTranscript({
  getSegments,
  active,
}: {
  getSegments: () => readonly string[];
  active: boolean;
}) {
  const [segments, setSegments] = useState<readonly string[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // A cheap signature of the current segment list ("<count>|<last segment>")
  // so a no-op poll (Gemini re-sending an identical delta) doesn't churn
  // React state.
  const signatureRef = useRef("");
  // Whether auto-follow is engaged. True while the reader is at the bottom;
  // set false the moment they scroll up, restored when they scroll back.
  const stickToBottomRef = useRef(true);

  const syncFromRef = useCallback(() => {
    const next = getSegments();
    const signature = `${next.length}|${next[next.length - 1] ?? ""}`;
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;
    setSegments(next.slice());
  }, [getSegments]);

  // Reflect which edges have hidden content, so the CSS fades only those —
  // the newest text at the bottom stays fully crisp while the reader is
  // following along.
  const updateFadeState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrolledFromTop = el.scrollTop > 1;
    const scrolledFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight > 1;
    el.toggleAttribute("data-fade-top", scrolledFromTop);
    el.toggleAttribute("data-fade-bottom", scrolledFromBottom);
  }, []);

  useEffect(() => {
    if (!active) return;
    // Fresh region on (re-)activation — an interruption resets the assistant
    // segments to [] mid-session, and a new session clears them entirely.
    signatureRef.current = "";
    stickToBottomRef.current = true;
    setSegments([]);
    syncFromRef();

    const id = window.setInterval(syncFromRef, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, syncFromRef]);

  // After each content change: keep the newest text in view (only if the
  // reader hasn't scrolled away), then recompute the edge-fade state.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      // Instant, not smooth: during rapid streaming a smooth animation would
      // never catch up. The screen itself doesn't move, so this reads as
      // calm "tail-follow", not a page jump.
      el.scrollTop = el.scrollHeight;
    }
    updateFadeState();
  }, [segments, updateFadeState]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= STICK_THRESHOLD_PX;
    updateFadeState();
  }, [updateFadeState]);

  if (!active) return null;

  return (
    <div
      ref={scrollRef}
      className="live-transcript"
      onScroll={handleScroll}
      aria-live="polite"
    >
      {segments.length === 0 ? (
        <span className="transcript-placeholder">…</span>
      ) : (
        segments.map((segment, index) => (
          // Segments only ever append (or the whole list resets to empty), so
          // an index key is stable: existing spans keep their identity and
          // don't re-mount / re-animate; only the new one does.
          <span className="transcript-seg" key={index}>
            {index > 0 ? " " : ""}
            {segment}
          </span>
        ))
      )}
    </div>
  );
}
