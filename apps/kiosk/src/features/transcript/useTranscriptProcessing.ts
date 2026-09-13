import { useCallback, useState } from "react";
import type { TranscriptProcessingResult } from "@arteq/shared";

const BACKEND_HTTP_URL = import.meta.env.VITE_BACKEND_HTTP_URL ?? "http://localhost:8787";

export type ProcessingStatus = "idle" | "processing" | "done";

/**
 * Calls the single Phase 4 external endpoint (POST /api/transcript/process
 * — architecture decision D / implementation principle 6). Everything about
 * the two internal LLM calls and deterministic guardrails is invisible from
 * here; this hook only ever sees the assembled TranscriptProcessingResult.
 *
 * Has its own network-level fallback (separate from the backend's own
 * per-stage fallback) in case the backend itself is unreachable — never
 * leaves the patient stuck, never fabricates a CLEAR verdict
 * (CLAUDE.md §11/§24).
 */
export function useTranscriptProcessing() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [result, setResult] = useState<TranscriptProcessingResult | null>(null);

  const process = useCallback(
    async (rawTranscript: string, segmentCount: number): Promise<TranscriptProcessingResult> => {
      setStatus("processing");
      // DIAGNOSTIC (Malayalam/Manglish regression investigation) — the exact
      // final raw transcript (stage 2 output / stage 3 input). This prints
      // the patient's own words, so it is gated to dev builds only and must
      // never reach a deployed kiosk console (CLAUDE.md §25).
      if (import.meta.env.DEV) {
        console.log(
          "[diag][stage2/3 final-raw-sent-to-backend]",
          JSON.stringify(rawTranscript),
          "segmentCount=",
          segmentCount,
        );
      }

      let outcome: TranscriptProcessingResult;
      try {
        const response = await fetch(`${BACKEND_HTTP_URL}/api/transcript/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawTranscript, segmentCount }),
        });
        if (!response.ok) {
          throw new Error(`transcript.process failed with status ${response.status}`);
        }
        outcome = (await response.json()) as TranscriptProcessingResult;
      } catch (err) {
        console.warn("[transcript] client-side request failed, falling back to raw transcript:", err);
        outcome = {
          cleanTranscript: rawTranscript,
          quality: {
            status: "REVIEW",
            score: 0,
            issues: [],
            reviewReason: "Let's make sure I understood you correctly.",
          },
          diagnostics: {
            refinementExecuted: false,
            refinementLatencyMs: 0,
            qualityLatencyMs: 0,
            totalLatencyMs: 0,
            usedFallback: true,
            fallbackLatencyMs: 0,
            guardrailsApplied: ["client_request_failed"],
            gateSignals: [],
          },
        };
      }

      // Diagnostic — measured latency, never content. Dev builds only, to
      // keep a deployed kiosk console quiet (CLAUDE.md §25).
      if (import.meta.env.DEV) {
        console.log("[diag] transcript.process client-received", JSON.stringify(outcome.diagnostics));
      }

      setResult(outcome);
      setStatus("done");
      return outcome;
    },
    [],
  );

  return { status, result, process };
}
