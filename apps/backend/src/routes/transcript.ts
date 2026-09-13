import type { Express } from "express";
import type { TranscriptProcessRequest } from "@arteq/shared";
import { processTranscript } from "../services/refinement/processTranscript.js";
import type { TranscriptRefinementProvider } from "../services/refinement/TranscriptRefinementProvider.js";

/**
 * The single external endpoint for Phase 4 (architecture decision D /
 * implementation principle 6). Everything about the two internal LLM calls
 * and the deterministic guardrails wrapping them is invisible from here —
 * the kiosk only ever sees the assembled TranscriptProcessingResult.
 */
export function attachTranscriptRoutes(app: Express, provider: TranscriptRefinementProvider) {
  app.post("/api/transcript/process", async (req, res) => {
    const body = req.body as Partial<TranscriptProcessRequest> | undefined;
    const rawTranscript = body?.rawTranscript;
    const segmentCount =
      typeof body?.segmentCount === "number" && body.segmentCount > 0 ? body.segmentCount : 1;

    if (typeof rawTranscript !== "string") {
      res.status(400).json({ error: "Missing or invalid rawTranscript." });
      return;
    }

    if (!provider.isConfigured()) {
      res.status(503).json({ error: "Transcript refinement provider is not configured." });
      return;
    }

    const result = await processTranscript(provider, rawTranscript, segmentCount);
    console.log(
      `[diag] transcript.process refinementExecuted=${result.diagnostics.refinementExecuted} ` +
        `gateSignals=[${result.diagnostics.gateSignals.join(",")}] ` +
        `refinementMs=${result.diagnostics.refinementLatencyMs.toFixed(0)} ` +
        `qualityMs=${result.diagnostics.qualityLatencyMs.toFixed(0)} ` +
        `totalMs=${result.diagnostics.totalLatencyMs.toFixed(0)} ` +
        `fallback=${result.diagnostics.usedFallback} ` +
        `guardrails=[${result.diagnostics.guardrailsApplied.join(",")}]`,
    );
    res.json(result);
  });
}
