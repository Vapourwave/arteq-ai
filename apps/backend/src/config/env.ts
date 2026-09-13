/**
 * Central place where the backend reads process.env. Nothing outside this
 * module should touch process.env directly — this is the one seam that
 * would need to change if secrets ever moved to a vault/secrets manager.
 *
 * Local dev only: load apps/backend/.env (gitignored) into process.env
 * using Node's built-in loader. A real deployment should set environment
 * variables directly (docs/06 §31-32 configuration/environment separation)
 * rather than shipping a .env file — this call is a no-op there if the file
 * doesn't exist.
 */
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // No .env file present — fine in production, expected until configured
  // locally.
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

export const env = {
  port: Number(optional("PORT") ?? 8787),
  geminiApiKey: optional("GEMINI_API_KEY"),
  sarvamApiKey: optional("SARVAM_API_KEY"),
  /** Experimental TTS provider under test (see providers/tts/FishTTSProvider.ts)
   * — not part of the real patient pipeline yet, dev-only smoke test. */
  fishApiKey: optional("FISH_API_KEY"),
  /** Origin the kiosk is served from — needed for CORS on the REST endpoints
   * (the voice WebSocket doesn't need this; browsers don't apply CORS to
   * WS). Found via real browser testing: the kiosk's fetch() to
   * /api/transcript/process failed with "TypeError: Failed to fetch" while
   * the same request succeeded fine from Node — the standard signature of a
   * missing CORS header, not a server-logic bug. */
  kioskOrigin: optional("KIOSK_ORIGIN") ?? "http://localhost:5173",

  // --- Phone channel (docs/07). Optional: unset = phone channel dormant,
  // everything else runs normally. ---
  /** Twilio account auth token — used ONLY to verify the inbound webhook
   * signature (telephony/twilioSignature.ts). When unset the webhook is
   * served but not signature-verified (a startup warning is logged). */
  twilioAuthToken: optional("TWILIO_AUTH_TOKEN"),
  /** Public host (no scheme) the phone webhook + media WS are reachable at
   * — a tunnel host in dev (e.g. "xxxx.ngrok-free.app"), the real domain in
   * prod. Needed to build the `wss://…/api/phone/media` URL in the TwiML. */
  phonePublicHost: optional("PHONE_PUBLIC_HOST"),
  /** Shared secret passed as a Twilio `<Parameter>` on the media stream and
   * checked when the stream starts — the Media Streams WS has no per-message
   * provider signature, so this is how an unsolicited WS connection is
   * rejected (docs/07 §Security). */
  phoneStreamSharedSecret: optional("PHONE_STREAM_SHARED_SECRET"),

  // --- Twilio Verify (Section 4) -------------------------------------------
  twilioAccountSid: optional("TWILIO_ACCOUNT_SID"),
  twilioVerifyServiceSid: optional("TWILIO_VERIFY_SERVICE_SID"),

  // --- Firebase Patient Backend (Section 5) -------------------------------
  firebaseProjectId: optional("FIREBASE_PROJECT_ID"),
  firebaseClientEmail: optional("FIREBASE_CLIENT_EMAIL"),
  firebasePrivateKey: optional("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n"),
};

export const hasGeminiCredentials = Boolean(env.geminiApiKey);
export const hasSarvamCredentials = Boolean(env.sarvamApiKey);
export const hasFishCredentials = Boolean(env.fishApiKey);
/** The phone channel can answer calls end-to-end once it has both a voice
 * brain (Gemini) and a public host for Twilio to reach the media socket. */
export const hasPhoneChannelConfig = Boolean(env.geminiApiKey && env.phonePublicHost);

/** Twilio Verify is configured for real SMS OTP */
export const hasTwilioVerifyConfig = Boolean(
  env.twilioAccountSid && env.twilioAuthToken && env.twilioVerifyServiceSid,
);

/** Firebase Firestore is configured for persistent patient records */
export const hasFirebaseConfig = Boolean(
  env.firebaseProjectId && (env.firebasePrivateKey || process.env.GOOGLE_APPLICATION_CREDENTIALS),
);
