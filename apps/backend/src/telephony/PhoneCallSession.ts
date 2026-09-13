import type { VoiceProvider, VoiceSession } from "../providers/voice/VoiceProvider.js";
import { TelephonyAudioAdapter } from "./TelephonyAudioAdapter.js";
import type { PhoneCallMeta, PhoneVoiceTransport } from "./PhoneVoiceTransport.js";

/**
 * Bridges ONE real phone call to the shared receptionist voice core.
 *
 * This is a transport/adaptation layer only (CLAUDE.md §8, task brief): it
 * contains no hospital business logic. It wires a provider-agnostic
 * PhoneVoiceTransport (Twilio today) to the exact same VoiceProvider the
 * kiosk uses (GeminiLiveVoiceProvider), routing audio through the
 * TelephonyAudioAdapter so the core only ever sees linear PCM16 at its own
 * contract rates — never µ-law, never 8 kHz, never a streamSid.
 *
 * ARTEQ stays ONE receptionist brain: the phone channel is a second mouth/
 * ear on the same VoiceProvider + conversation-state + grounding stack, not
 * a separate assistant.
 *
 * Vertical-slice scope (deliberately): answer, hear the caller, speak back,
 * support barge-in, clean up on hangup. No OP ticket / doctor / department
 * workflow is driven from here yet — those tool calls already exist in the
 * core and will light up for phone unchanged once this slice is proven on
 * real telephony.
 */

export interface PhoneCallSessionOptions {
  /** If set, the call is rejected unless the transport reports a matching
   * `secret` custom parameter (see docs/07 §Security — the Media Streams WS
   * has no per-message provider signature, so the stream URL carries a
   * shared secret instead). */
  expectedStreamSecret?: string;
  /** Structured, non-sensitive operational logging (CLAUDE.md §25). */
  log?: (event: string, detail?: Record<string, unknown>) => void;
}

export class PhoneCallSession {
  private readonly adapter = new TelephonyAudioAdapter();
  private voiceSession: VoiceSession | null = null;
  private tornDown = false;
  private callId = "unknown";

  constructor(
    private readonly transport: PhoneVoiceTransport,
    private readonly provider: VoiceProvider,
    private readonly options: PhoneCallSessionOptions = {},
  ) {}

  private log(event: string, detail?: Record<string, unknown>): void {
    (this.options.log ?? defaultLog)(event, detail);
  }

  /** Start consuming the transport. Safe to call exactly once. */
  begin(): void {
    if (!this.provider.isConfigured()) {
      this.log("PHONE_CALL_REJECTED", { reason: "voice_provider_unconfigured" });
      this.transport.close();
      return;
    }

    this.transport.start({
      onStart: (meta) => void this.handleStart(meta),
      onCallerAudio: (muLawBase64) => this.handleCallerAudio(muLawBase64),
      onDtmf: (digit) => this.log("PHONE_CALL_DTMF", { callId: this.callId, digit }),
      onStop: () => {
        this.log("PHONE_CALL_HANGUP", { callId: this.callId });
        this.teardown();
      },
      onClose: () => this.teardown(),
      onError: (message) => this.log("PHONE_TRANSPORT_ERROR", { message }),
    });
  }

  private async handleStart(meta: PhoneCallMeta): Promise<void> {
    this.callId = meta.callId;

    const { expectedStreamSecret } = this.options;
    if (expectedStreamSecret) {
      if (meta.customParameters.secret !== expectedStreamSecret) {
        this.log("PHONE_CALL_REJECTED", { callId: this.callId, reason: "bad_stream_secret" });
        this.transport.close();
        return;
      }
    } else {
      this.log("PHONE_STREAM_SECRET_UNSET", { callId: this.callId });
    }

    this.log("PHONE_CALL_STARTED", { callId: this.callId, streamId: meta.streamId });

    try {
      this.voiceSession = await this.provider.startSession({
        onTranscriptDelta: (text) => {
          // CLAUDE.md §25 — never log the patient's words, only that speech
          // is being recognised.
          this.log("PHONE_CALLER_SPEECH", { callId: this.callId, chars: text.length });
        },
        onTurnComplete: () => {},
        onAssistantAudioChunk: (base64Pcm) => {
          if (this.tornDown) return;
          this.transport.sendCallerAudio(this.adapter.coreChunkToCaller(base64Pcm));
        },
        onAssistantTranscriptDelta: () => {},
        onAssistantTurnComplete: () => {
          this.log("PHONE_ASSISTANT_TURN_COMPLETE", { callId: this.callId });
        },
        onInterrupted: () => {
          // Barge-in: caller talked over the assistant. Reset the outbound
          // resampler tail and flush everything already queued at Twilio.
          this.adapter.resetOutbound();
          this.transport.clearCallerAudio();
          this.log("PHONE_ASSISTANT_INTERRUPTED", { callId: this.callId });
        },
        onConversationStateUpdate: (state) => {
          // Hospital-navigation facts only — safe to log (CLAUDE.md §25).
          this.log("PHONE_CONVERSATION_STATE", {
            callId: this.callId,
            department: state.selectedDepartment?.name ?? null,
            doctor: state.selectedDoctor?.name ?? null,
            hasTicket: Boolean(state.ticket),
          });
        },
        onError: (message) => {
          this.log("PHONE_VOICE_PROVIDER_ERROR", { callId: this.callId, message });
          this.teardown();
        },
        onClose: () => this.teardown(),
      });
      if (this.tornDown) {
        // Caller hung up while the provider session was still connecting.
        this.voiceSession.stop();
        this.voiceSession = null;
        return;
      }
      this.log("PHONE_VOICE_SESSION_READY", { callId: this.callId });
    } catch (err) {
      this.log("PHONE_VOICE_PROVIDER_START_FAILED", {
        callId: this.callId,
        message: err instanceof Error ? err.message : String(err),
      });
      this.teardown();
    }
  }

  private handleCallerAudio(muLawBase64: string): void {
    if (this.tornDown || !this.voiceSession) return;
    this.voiceSession.sendAudioChunk(this.adapter.callerFrameToCore(muLawBase64));
  }

  /** Idempotent: stops the voice session and closes the transport. */
  private teardown(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.log("PHONE_CALL_ENDED", { callId: this.callId });
    try {
      this.voiceSession?.stop();
    } catch {
      // provider already gone
    }
    this.voiceSession = null;
    this.transport.close();
  }
}

function defaultLog(event: string, detail?: Record<string, unknown>): void {
  if (detail) console.log(`[phone] ${event}`, detail);
  else console.log(`[phone] ${event}`);
}
