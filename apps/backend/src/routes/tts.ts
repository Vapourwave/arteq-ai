import type { Express } from "express";
import type { TTSProviderId, TTSTestRequest } from "@arteq/shared";
import type { TTSProvider } from "../providers/tts/TTSProvider.js";

/**
 * EXPERIMENTAL, dev-only smoke-test endpoint for the Fish S2 Pro TTS
 * evaluation. NOT part of the real patient pipeline — there is no
 * AI-response-generation stage yet for a real TTS call to sit behind (see
 * the codebase inspection that preceded this integration). This exists
 * purely so the kiosk's dev-gated TTS test screen (and/or a standalone
 * verification script) can play canned test utterances through a real
 * provider and observe latency/quality, mirroring how
 * eval-transcript-refinement.ts is a separate, opt-in real-API check.
 *
 * Streams the provider's audio straight through to the response instead of
 * buffering it — preserves whatever time-to-first-byte benefit the
 * provider's own streaming response offers.
 */
export function attachTTSRoutes(app: Express, providers: Record<TTSProviderId, TTSProvider>) {
  app.post("/api/tts/test", async (req, res) => {
    const body = req.body as Partial<TTSTestRequest> | undefined;
    const text = body?.text;
    const providerId = body?.provider;

    if (typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "Missing or invalid text." });
      return;
    }
    if (providerId !== "current" && providerId !== "fish") {
      res.status(400).json({ error: 'Invalid provider — expected "current" or "fish".' });
      return;
    }

    const provider = providers[providerId];
    if (!provider.isConfigured()) {
      res.status(503).json({
        error: `TTS provider "${provider.name}" is not configured.`,
      });
      return;
    }

    const startedAt = performance.now();
    try {
      const { contentType, audioStream } = await provider.synthesize(text);
      const timeToFirstResponseMs = performance.now() - startedAt;
      console.log(
        `[diag] tts.test provider=${provider.name} textLength=${text.length} timeToFirstResponseMs=${timeToFirstResponseMs.toFixed(0)}`,
      );
      res.setHeader("Content-Type", contentType);
      audioStream.on("error", (err) => {
        console.error(`[tts] audio stream error from provider ${provider.name}:`, err);
        if (!res.headersSent) {
          res.status(502).json({ error: "TTS provider stream failed." });
        } else {
          res.destroy();
        }
      });
      audioStream.pipe(res);
    } catch (err) {
      // Never crash the process, never fabricate success (CLAUDE.md §11) —
      // visible in dev logs, reported as a clear error to the caller.
      console.error(`[tts] synthesize() failed for provider ${provider.name}:`, err);
      res.status(502).json({
        error: `TTS synthesis failed via provider "${provider.name}".`,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
