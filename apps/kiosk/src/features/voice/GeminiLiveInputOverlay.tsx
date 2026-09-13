import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isDarkModeEnabled, isTranscriptionVisible } from "../../config/theme";

export interface GeminiLiveInputOverlayProps {
  subscribeTranscript?: (cb: (delta: string, full: string) => void) => () => void;
  getTranscript?: () => string;
}

/**
 * Temporary debug overlay for Gemini Live input transcription.
 * Proves whether Gemini Live is receiving and transcribing what the patient says.
 * Event-driven: updates immediately on each incoming delta without polling or timers.
 *
 * Positioned on the LEFT side of the screen, underneath a full-viewport masking layer
 * styled according to ARTEQ's theme system (matches var(--bg) in both light and dark mode).
 * The transcription panel remains fully mounted, functional, and actively accumulating coherent updates.
 */
export function GeminiLiveInputOverlay({
  subscribeTranscript,
  getTranscript,
}: GeminiLiveInputOverlayProps) {
  const [transcript, setTranscript] = useState<string>(() => getTranscript?.() || "");
  const [hasReceived, setHasReceived] = useState<boolean>(() => Boolean(getTranscript?.()?.trim()));
  const [showTranscription, setShowTranscription] = useState<boolean>(() => isTranscriptionVisible());

  // Track ARTEQ dark mode state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return (
        document.documentElement.getAttribute("data-theme") === "dark" ||
        isDarkModeEnabled()
      );
    }
    return false;
  });

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const updateTheme = () => {
      const dark =
        document.documentElement.getAttribute("data-theme") === "dark" ||
        isDarkModeEnabled();
      setIsDark(dark);
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const onTranscriptionVisibilityChange = () => {
      setShowTranscription(isTranscriptionVisible());
    };

    window.addEventListener("arteq_show_transcription_changed", onTranscriptionVisibilityChange);
    window.addEventListener("storage", updateTheme);
    window.addEventListener("storage", onTranscriptionVisibilityChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("arteq_show_transcription_changed", onTranscriptionVisibilityChange);
      window.removeEventListener("storage", updateTheme);
      window.removeEventListener("storage", onTranscriptionVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!subscribeTranscript) return;
    const unsubscribe = subscribeTranscript((delta, full) => {
      console.log(`[ARTEQ-TRACE:Overlay] Received transcript update: delta="${delta}", full="${full}"`);
      // Session reset: empty delta and full
      if (!delta && !full) {
        setTranscript("");
        setHasReceived(false);
        return;
      }

      setTranscript((prev) => {
        // Prefer coherent full transcript accumulated by session if present
        let next = full?.trim() ? full : "";

        // If full is empty or not passed, accumulate/update from delta
        if (!next && delta?.trim()) {
          const trimmedDelta = delta.trim();
          if (!prev.trim()) {
            next = trimmedDelta;
          } else if (trimmedDelta.toLowerCase().startsWith(prev.toLowerCase())) {
            // Delta extends previous text (ASR partial update)
            next = trimmedDelta;
          } else if (prev.toLowerCase().startsWith(trimmedDelta.toLowerCase())) {
            // Delta is earlier subset of previous text
            next = prev;
          } else {
            // Discrete phrase/turn delta
            next = `${prev.trim()} ${trimmedDelta}`;
          }
        }

        if (next.trim().length > 0) {
          setHasReceived(true);
        }
        return next;
      });
    });
    return unsubscribe;
  }, [subscribeTranscript]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* 
        Temporary Gemini Live Input Transcription Debug Panel:
        - Lowest z-index (zIndex: 1)
        - Fully mounted, functional, and receiving coherent transcription deltas
        - NO shadow, NO border, NO glow, NO blur, NO visual effects
        - Bounded strictly to the top-left corner under the masking square
      */}
      <aside
        aria-label="Gemini Live Input Debug"
        style={{
          position: "fixed",
          top: "12px",
          left: "12px",
          width: "300px",
          height: "160px",
          zIndex: 1,
          background: "#0f172a",
          border: "none",
          boxShadow: "none",
          outline: "none",
          filter: "none",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          borderRadius: 0,
          padding: "10px 14px",
          color: "#f8fafc",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          pointerEvents: "none",
          userSelect: "none",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            marginBottom: "8px",
            borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
            paddingBottom: "6px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#94a3b8",
            }}
          >
            Gemini Live Input
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: hasReceived ? "#10b981" : "#f59e0b",
              background: hasReceived ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
              padding: "2px 8px",
              borderRadius: "9999px",
              border: hasReceived ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(245, 158, 11, 0.35)",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: hasReceived ? "#10b981" : "#f59e0b",
                boxShadow: "none",
              }}
            />
            {hasReceived ? "Gemini Live: RECEIVING" : "Gemini Live: WAITING FOR INPUT"}
          </span>
        </div>
        <div
          style={{
            fontSize: "13px",
            lineHeight: "1.45",
            color: transcript.trim() ? "#f1f5f9" : "#64748b",
            fontStyle: transcript.trim() ? "normal" : "italic",
            wordBreak: "break-word",
            minHeight: "22px",
            maxHeight: "100px",
            overflowY: "auto",
          }}
        >
          {transcript.trim() ? `“${transcript.trim()}”` : "Waiting for speech..."}
        </div>
      </aside>

      {/* 
        Full-viewport masking layer:
        - Layer order:
            Main ARTEQ UI (highest z-index: 10)
              ↑
            Full-viewport masking layer (lower z-index: 2)
              ↑
            Temporary Gemini transcription (lowest z-index: 1)
        - Automatically matches ARTEQ background color (var(--bg)) in both Light and Dark mode
        - Covers the full kiosk viewport (width: 100vw, height: 100vh) without causing scroll
        - When toggle is OFF: opacity is 1 (fully opaque, completely covering transcription)
        - When toggle is ON: opacity is 0 (fully transparent, exposing transcription underneath)
        - NO shadow, NO border, NO glow, NO gradient, NO blur, NO visual effects
        - pointerEvents: none so it never obstructs touches, clicks, or any normal ARTEQ UI
      */}
      <div
        aria-hidden="true"
        className="gemini-live-cover"
        data-testid="gemini-live-cover"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "var(--bg)",
          opacity: showTranscription ? 0 : 1,
          zIndex: 2,
          boxShadow: "none",
          border: "none",
          outline: "none",
          filter: "none",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          borderRadius: 0,
          margin: 0,
          padding: 0,
          pointerEvents: "none",
          boxSizing: "border-box",
          transition: "opacity 150ms ease",
        }}
      />
    </>,
    document.body
  );
}
