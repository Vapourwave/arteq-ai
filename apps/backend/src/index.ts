import http from "node:http";
import express from "express";
import { env, hasFishCredentials, hasGeminiCredentials, hasPhoneChannelConfig } from "./config/env.js";
import { GeminiLiveVoiceProvider } from "./providers/voice/GeminiLiveVoiceProvider.js";
import { attachVoiceSocket } from "./ws/voiceSocket.js";
import { attachPhoneSocket } from "./ws/phoneSocket.js";
import { attachPhoneRoutes } from "./routes/phone.js";
import { attachTranscriptRoutes } from "./routes/transcript.js";
import { GeminiTranscriptRefinementProvider } from "./services/refinement/GeminiTranscriptRefinementProvider.js";
import { attachTTSRoutes } from "./routes/tts.js";
import { attachAdminRoutes } from "./routes/admin.js";
import { FishTTSProvider } from "./providers/tts/FishTTSProvider.js";
import { ReservedTTSProvider } from "./providers/tts/ReservedTTSProvider.js";

const app = express();
app.use(express.json());

// CORS for the REST endpoints — the kiosk (localhost:5173) and backend
// (localhost:8787) are different origins. The voice WebSocket doesn't need
// this (browsers don't apply CORS to WS), but plain fetch() calls do.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", env.kioskOrigin);
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    voiceProviderConfigured: hasGeminiCredentials,
    // EXPERIMENTAL — Fish S2 Pro TTS evaluation, dev visibility only.
    fishTtsConfigured: hasFishCredentials,
    // Phone channel (docs/07) — code-complete; needs a public host + Twilio
    // number to actually answer calls.
    phoneChannelConfigured: hasPhoneChannelConfig,
  });
});

const server = http.createServer(app);

// One VoiceProvider instance, shared by every channel — the kiosk WS
// (/api/live) and the phone WS (/api/phone/media) are two transports on the
// same receptionist brain (CLAUDE.md §8).
const voiceProvider = new GeminiLiveVoiceProvider();
attachVoiceSocket(server, voiceProvider);
attachPhoneSocket(server, voiceProvider);
attachPhoneRoutes(app);

const refinementProvider = new GeminiTranscriptRefinementProvider();
attachTranscriptRoutes(app, refinementProvider);
attachAdminRoutes(app);

// EXPERIMENTAL — Fish S2 Pro TTS evaluation, dev-only test harness. Not
// part of the real patient pipeline (see routes/tts.ts docstring).
attachTTSRoutes(app, {
  current: new ReservedTTSProvider(),
  fish: new FishTTSProvider(),
});

server.listen(env.port, () => {
  console.log(`[arteq-backend] listening on http://localhost:${env.port}`);
  console.log(`[arteq-backend] voice websocket at ws://localhost:${env.port}/api/live`);
  console.log(`[arteq-backend] phone webhook at POST http://localhost:${env.port}/api/phone/incoming-call`);
  console.log(`[arteq-backend] phone media websocket at ws://localhost:${env.port}/api/phone/media`);
  if (!hasGeminiCredentials) {
    console.warn(
      "[arteq-backend] GEMINI_API_KEY is not set — voice sessions will fail " +
        "with PROVIDER_UNAVAILABLE until it is configured in apps/backend/.env",
    );
  }
  if (!env.phonePublicHost) {
    console.warn(
      "[arteq-backend] PHONE_PUBLIC_HOST is not set — the phone channel will " +
        "answer but cannot start a media stream until it is configured (docs/07).",
    );
  }
});
