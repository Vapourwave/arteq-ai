import type { ConversationState, Patient } from "./hospitalProtocol.js";

/**
 * ARTEQ AI — Kiosk <-> Backend voice WebSocket contract.
 *
 * This is ARTEQ's own application-level protocol, not the provider's
 * (e.g. Gemini Live) wire format. The backend owns the provider connection;
 * the kiosk only ever speaks this contract. This keeps the voice provider
 * swappable without touching the kiosk client.
 */

/** Sent by the kiosk to the backend. */
export type ClientVoiceMessage =
  | { type: "audio_chunk"; base64Pcm16: string }
  | { type: "stop" }
  /** The patient pressed "Get OP Ticket" (only shown once
   * ConversationState.readyForTicket is true — see hospitalProtocol.ts).
   * Distinct from generic `stop` so the backend can deterministically
   * finalize a ticket (using the already-selected department/doctor) if
   * the conversation hadn't already produced one via a Gemini tool call,
   * without needing the model to say anything more. */
  | { type: "get_op_ticket" }
  /** Touch fallback (CLAUDE.md §20): the patient tapped a department/doctor
   * card instead of naming it aloud. Handled by the exact same
   * deterministic backend logic a voice-driven tool call uses (see
   * services/conversation/geminiTools.ts) — touch and voice selection are
   * two input paths into one real state change, never two parallel
   * mechanisms. */
  | { type: "select_department"; departmentId: string }
  | { type: "select_doctor"; doctorId: string }
  // Phase 6: Identity verification
  | { type: "verify_patient"; name: string; phone: string }
  | { type: "register_patient"; name: string; phone: string; address?: string; idPhotoRef?: string }
  | { type: "request_otp"; phone: string }
  | { type: "verify_otp"; phone: string; code: string }
  | { type: "ui_state_update"; stateId: string; summary: string }
  | { type: "trigger_greeting" };

/** Sent by the backend to the kiosk. */
export type ServerVoiceMessage =
  | { type: "session_ready" }
  | { type: "transcript_delta"; text: string }
  | { type: "session_closed" }
  | { type: "error"; code: VoiceErrorCode; message: string }
  /** One chunk of the assistant's spoken reply audio (native Gemini Live
   * audio output — see docs/04 §31/§32, GeminiLiveVoiceProvider.ts). Base64
   * PCM16 at ASSISTANT_AUDIO_CONTRACT's sample rate, NOT the 16kHz capture
   * rate — playback is a deliberately separate audio subsystem in the
   * kiosk, never sharing an AudioContext with capture. */
  | { type: "assistant_audio_chunk"; base64Pcm: string }
  /** Text of what the assistant said, delivered in parallel with the audio
   * chunks above (Gemini Live's outputAudioTranscription) — kept as its own
   * message type, never merged with transcript_delta, so the patient's and
   * assistant's speech streams are never conflated in kiosk state. */
  | { type: "assistant_transcript_delta"; text: string }
  /** The provider's turn boundary for the assistant's reply — signals the
   * kiosk it has heard everything for this turn (docs/04 §9/§32). */
  | { type: "assistant_turn_complete" }
  /** The patient started speaking again while the assistant was still
   * generating/playing audio (Gemini Live's serverContent.interrupted) —
   * the kiosk must stop and flush any queued playback immediately so the
   * assistant doesn't keep talking over the patient. */
  | { type: "assistant_interrupted" }
  /** The authoritative navigation state changed (a department/doctor lookup
   * happened via a real Gemini Live tool call, a selection was made, a
   * ticket was issued, etc.) — see packages/shared/hospitalProtocol.ts.
   * Sent after every real backend-confirmed change, never guessed
   * client-side; the kiosk only ever renders what this message carries. */
  | { type: "conversation_state_update"; state: ConversationState }
  | { type: "otp_sent"; phone: string; success: boolean; message?: string }
  | { type: "otp_verified"; phone: string; success: boolean; patient?: Patient; message?: string };

export type VoiceErrorCode =
  | "MIC_PERMISSION_DENIED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_CONNECTION_FAILED"
  | "SESSION_ERROR";

/** Required audio contract for outbound (patient -> backend) PCM chunks
 * (see docs/04 §6-7). */
export const VOICE_AUDIO_CONTRACT = {
  sampleRateHz: 16000,
  bitDepth: 16,
  channels: 1,
  encoding: "pcm_signed_le" as const,
};

/** Audio contract for inbound (assistant -> kiosk) native-audio playback.
 * Confirmed from real Gemini Live API response metadata (mimeType
 * "audio/pcm;rate=24000"), not assumed from documentation — deliberately a
 * different rate than VOICE_AUDIO_CONTRACT, so playback must use its own
 * AudioContext, never the capture one. */
export const ASSISTANT_AUDIO_CONTRACT = {
  sampleRateHz: 24000,
  bitDepth: 16,
  channels: 1,
  encoding: "pcm_signed_le" as const,
};
