/**
 * EXPERIMENTAL — Fish Audio S2 Pro TTS evaluation (see
 * apps/backend/src/providers/tts). This is a dev-only smoke-test contract
 * for POST /api/tts/test, NOT part of the real patient voice pipeline —
 * there is no AI-response-generation stage yet for a real TTS call to sit
 * behind (see asr-script-confusion-investigation.md-adjacent findings from
 * the codebase inspection that preceded this integration).
 *
 * The response to /api/tts/test is raw streamed audio bytes, not JSON —
 * only the request has a structured shape worth sharing between backend
 * and kiosk.
 */

/** Every TTS provider id the dev test harness can address. "current" is a
 * reserved/unimplemented slot (mirrors SARVAM_API_KEY's existing reserved
 * status) — selecting it reports a clear "not implemented" error rather
 * than silently doing nothing. */
export type TTSProviderId = "current" | "fish";

export interface TTSTestRequest {
  text: string;
  provider: TTSProviderId;
}
