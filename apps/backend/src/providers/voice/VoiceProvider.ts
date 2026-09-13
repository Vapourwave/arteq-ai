import type { ConversationState } from "@arteq/shared";

/**
 * Provider-agnostic contract for a live voice/transcription session
 * (CLAUDE.md §8, docs/02 §6 "AI Provider Abstraction"). The backend's
 * WebSocket handler talks only to this interface — swapping Gemini Live
 * for another provider later should not require touching the WS handler
 * or the kiosk at all.
 */
export interface VoiceSessionCallbacks {
  onTranscriptDelta(text: string): void;
  /** The provider's own turn boundary — NOT the same as the app-controlled
   * recording session (docs/04 §9). Purely informational for now. */
  onTurnComplete(): void;
  onError(message: string): void;
  onClose(): void;
  /** One chunk of the assistant's native spoken reply audio (base64 PCM16
   * at ASSISTANT_AUDIO_CONTRACT's rate — see packages/shared/voiceProtocol).
   * Only fires when the provider's session requests AUDIO response
   * modality; a transcription-only provider/config never calls this. */
  onAssistantAudioChunk(base64Pcm: string): void;
  /** Text of what the assistant is saying, in parallel with the audio
   * chunks above (the provider's own output-audio transcription). Kept
   * fully separate from onTranscriptDelta (patient speech) so the two
   * streams are never conflated. */
  onAssistantTranscriptDelta(text: string): void;
  /** The assistant's reply turn finished — distinct from onTurnComplete,
   * which is the provider's general turn-boundary signal; this specifically
   * tells the caller "no more audio/text is coming for this reply." */
  onAssistantTurnComplete(): void;
  /** The patient started speaking again while the assistant was still
   * generating/playing a reply — the caller must stop and flush any queued
   * playback immediately (barge-in). */
  onInterrupted(): void;
  /** The authoritative hospital-navigation state changed as a result of a
   * real Gemini Live tool call (department/doctor lookup, selection,
   * ticket generation) — see services/conversation/. Never fired for
   * anything the model merely SAID; only for real backend-confirmed state
   * changes (CLAUDE.md §5.2). */
  onConversationStateUpdate(state: ConversationState): void;
}

export interface VoiceSession {
  /** Push one chunk of 16kHz mono 16-bit PCM audio (base64-encoded). */
  sendAudioChunk(base64Pcm16: string): void;
  /** Ask the provider to end the current input turn and close the session. */
  stop(): void;
  /** Trigger the initial welcome greeting spoken natively by the assistant. */
  triggerGreeting?(): void;
  /** Update Gemini Live with current interactive UI state without triggering turn. */
  updateUIState?(stateId: string, summary: string): void;
}

export interface VoiceProvider {
  readonly name: string;
  isConfigured(): boolean;
  startSession(callbacks: VoiceSessionCallbacks): Promise<VoiceSession>;
}
