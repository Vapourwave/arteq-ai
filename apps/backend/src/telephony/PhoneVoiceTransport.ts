/**
 * Provider-agnostic contract for a real phone call's media transport
 * (CLAUDE.md §8 provider abstraction, applied to telephony).
 *
 * PhoneCallSession talks ONLY to this interface. Twilio Media Streams is
 * the first implementation (TwilioMediaStreamTransport); Plivo / Exotel /
 * Teler expose an almost identical bidirectional µ-law-8k WebSocket and
 * would each be another implementation of this same interface — no change
 * to PhoneCallSession or anything above it. See docs/07.
 *
 * The audio units here are still telephony units (base64 µ-law @ 8 kHz):
 * the transport is the raw wire, the TelephonyAudioAdapter is the codec/
 * rate boundary, and PhoneCallSession sits above both.
 */

export interface PhoneCallMeta {
  /** Provider's stream identifier — required on every outbound frame. */
  streamId: string;
  /** Provider's call identifier — for correlation/logging only. */
  callId: string;
  /** Whatever custom parameters the provider passed on stream start
   * (Twilio `<Parameter>`), used here for the shared-secret check. */
  customParameters: Record<string, string>;
}

export interface PhoneVoiceTransportCallbacks {
  /** The media stream is established; the call is live. */
  onStart(meta: PhoneCallMeta): void;
  /** One inbound media frame from the caller — base64 µ-law @ 8 kHz. */
  onCallerAudio(muLawBase64: string): void;
  /** Caller pressed a touch-tone key. Not used by the vertical slice
   * beyond logging, but surfaced so an IVR layer can be added later
   * without touching the transport. */
  onDtmf(digit: string): void;
  /** The provider signalled the stream stopped (caller hung up, or the
   * call leg ended). */
  onStop(): void;
  /** The underlying socket closed (clean or not) — always fires exactly
   * once, after onStop if a stop was received. */
  onClose(): void;
  /** Transport-level error (bad frame, socket error). Informational; the
   * session treats a following onClose as the real teardown trigger. */
  onError(message: string): void;
}

export interface PhoneVoiceTransport {
  /** Begin consuming the socket. Callbacks may fire synchronously after. */
  start(callbacks: PhoneVoiceTransportCallbacks): void;
  /** Send one outbound media frame to the caller — base64 µ-law @ 8 kHz. */
  sendCallerAudio(muLawBase64: string): void;
  /** Barge-in / playback cancellation: discard everything already sent to
   * the provider but not yet played to the caller. */
  clearCallerAudio(): void;
  /** Close the call leg / socket from our side. Idempotent. */
  close(): void;
}
