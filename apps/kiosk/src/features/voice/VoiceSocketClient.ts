import type { ClientVoiceMessage, ConversationState, Patient, ServerVoiceMessage } from "@arteq/shared";

export interface VoiceSocketCallbacks {
  onReady(): void;
  onTranscriptDelta(text: string): void;
  onError(code: string, message: string): void;
  onClosed(): void;
  /** One chunk of the assistant's native spoken reply audio (base64 PCM16
   * — see packages/shared/voiceProtocol ASSISTANT_AUDIO_CONTRACT). */
  onAssistantAudioChunk(base64Pcm: string): void;
  /** Text of what the assistant is saying, parallel to the audio above —
   * kept fully separate from onTranscriptDelta (patient speech). */
  onAssistantTranscriptDelta(text: string): void;
  onAssistantTurnComplete(): void;
  /** Barge-in: the patient started speaking again mid-reply. */
  onInterrupted(): void;
  /** The authoritative hospital-navigation state changed — see
   * packages/shared/hospitalProtocol.ts. Only ever real backend-confirmed
   * data (department/doctor lookups, selections, a generated ticket). */
  onConversationStateUpdate(state: ConversationState): void;
  onOtpSent?(phone: string, success: boolean, message?: string): void;
  onOtpVerified?(phone: string, success: boolean, patient?: Patient, message?: string): void;
}

/**
 * Thin WebSocket wrapper speaking the kiosk<->backend voice protocol
 * (packages/shared/voiceProtocol.ts). No provider-specific knowledge lives
 * here — the kiosk never talks to Gemini directly, only to our own backend
 * (CLAUDE.md §26, docs/02 §5 backend-is-the-trusted-boundary).
 *
 * Plain TS class, no React — mirrors the legacy service's separation of
 * concerns (see architecture assessment §1), which is what let the
 * transcript-accumulation code avoid triggering renders from inside the
 * audio path.
 */
export class VoiceSocketClient {
  private socket: WebSocket | null = null;
  private sentChunkCount = 0;
  private recvAssistantChunkCount = 0;
  private pendingOtpRequestResolver: ((res: { success: boolean; message?: string }) => void) | null = null;
  private pendingOtpVerifyResolver: ((res: { success: boolean; patient?: Patient; message?: string }) => void) | null = null;

  getReadyState(): number {
    return this.socket?.readyState ?? -1;
  }

  connect(url: string, callbacks: VoiceSocketCallbacks): void {
    const socket = new WebSocket(url);
    this.socket = socket;
    this.sentChunkCount = 0;
    this.recvAssistantChunkCount = 0;

    socket.onopen = () => {
      console.log(`[ARTEQ-TRACE:2-VoiceSocketClient] WS OPEN url=${url}`);
    };

    socket.onmessage = (event) => {
      let message: ServerVoiceMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (message.type) {
        case "session_ready":
          console.log(`[ARTEQ-TRACE:2-VoiceSocketClient] SESSION_READY received`);
          callbacks.onReady();
          break;
        case "transcript_delta":
          console.log(`[ARTEQ-TRACE:ClientReceive] Patient transcript_delta: "${message.text}"`);
          callbacks.onTranscriptDelta(message.text);
          break;
        case "error":
          console.error(`[VoiceSocketClient] Server error: [${message.code}] ${message.message}`);
          callbacks.onError(message.code, message.message);
          break;
        case "session_closed":
          console.log(`[VoiceSocketClient] Session closed by server`);
          callbacks.onClosed();
          break;
        case "assistant_audio_chunk":
          this.recvAssistantChunkCount++;
          if (this.recvAssistantChunkCount === 1 || this.recvAssistantChunkCount % 25 === 0) {
            console.log(`[VoiceSocketClient] Assistant audio chunk #${this.recvAssistantChunkCount}, len=${message.base64Pcm.length}`);
          }
          callbacks.onAssistantAudioChunk(message.base64Pcm);
          break;
        case "assistant_transcript_delta":
          console.log(`[VoiceSocketClient] Assistant transcript_delta: "${message.text}"`);
          callbacks.onAssistantTranscriptDelta(message.text);
          break;
        case "assistant_turn_complete":
          console.log(`[VoiceSocketClient] Assistant turn complete`);
          callbacks.onAssistantTurnComplete();
          break;
        case "assistant_interrupted":
          console.log(`[VoiceSocketClient] Assistant interrupted`);
          callbacks.onInterrupted();
          break;
        case "conversation_state_update":
          callbacks.onConversationStateUpdate(message.state);
          break;
        case "otp_sent":
          callbacks.onOtpSent?.(message.phone, message.success, message.message);
          if (this.pendingOtpRequestResolver) {
            this.pendingOtpRequestResolver({ success: message.success, message: message.message });
            this.pendingOtpRequestResolver = null;
          }
          break;
        case "otp_verified":
          callbacks.onOtpVerified?.(message.phone, message.success, message.patient, message.message);
          if (this.pendingOtpVerifyResolver) {
            this.pendingOtpVerifyResolver({
              success: message.success,
              patient: message.patient,
              message: message.message,
            });
            this.pendingOtpVerifyResolver = null;
          }
          break;
      }
    };

    socket.onerror = () => {
      console.log(`[ARTEQ-LIVE-FLOW] ${Date.now()} WS_ERROR`);
      callbacks.onError("SESSION_ERROR", "Voice connection error");
    };

    socket.onclose = () => {
      console.log(`[ARTEQ-LIVE-FLOW] ${Date.now()} WS_CLOSE`);
      callbacks.onClosed();
    };
  }

  private send(message: ClientVoiceMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  sendAudioChunk(base64Pcm16: string): void {
    this.sentChunkCount++;
    const wsState = this.socket?.readyState ?? -1;
    if (this.sentChunkCount === 1 || this.sentChunkCount % 25 === 0) {
      console.log(`[ARTEQ-TRACE:2-VoiceSocketClient] Sending audio chunk #${this.sentChunkCount} (${base64Pcm16.length} b64 chars, wsState=${wsState})`);
    }
    this.send({ type: "audio_chunk", base64Pcm16 });
  }

  stop(): void {
    this.send({ type: "stop" });
  }

  /** Phase 5 — the patient pressed "Get OP Ticket". */
  requestOPTicket(): void {
    this.send({ type: "get_op_ticket" });
  }

  /** Touch fallback (CLAUDE.md §20) — the patient tapped a department card
   * instead of naming it aloud. */
  selectDepartment(departmentId: string): void {
    this.send({ type: "select_department", departmentId });
  }

  /** Touch fallback (CLAUDE.md §20) — the patient tapped a doctor card
   * instead of naming it aloud. */
  selectDoctor(doctorId: string): void {
    this.send({ type: "select_doctor", doctorId });
  }

  // Phase 6: Identity Verification
  verifyPatient(name: string, phone: string): void {
    this.send({ type: "verify_patient", name, phone });
  }

  registerPatient(name: string, phone: string, address?: string, idPhotoRef?: string): void {
    this.send({ type: "register_patient", name, phone, address, idPhotoRef });
  }

  requestOTP(phone: string): Promise<{ success: boolean; message?: string }> {
    this.send({ type: "request_otp", phone });
    return new Promise((resolve) => {
      this.pendingOtpRequestResolver = resolve;
      setTimeout(() => {
        if (this.pendingOtpRequestResolver === resolve) {
          this.pendingOtpRequestResolver = null;
          resolve({ success: false, message: "Request timed out" });
        }
      }, 10000);
    });
  }

  verifyOTP(phone: string, code: string): Promise<{ success: boolean; patient?: Patient; message?: string }> {
    this.send({ type: "verify_otp", phone, code });
    return new Promise((resolve) => {
      this.pendingOtpVerifyResolver = resolve;
      setTimeout(() => {
        if (this.pendingOtpVerifyResolver === resolve) {
          this.pendingOtpVerifyResolver = null;
          resolve({ success: false, message: "Verification timed out" });
        }
      }, 10000);
    });
  }

  sendUIStateUpdate(stateId: string, summary: string): void {
    this.send({ type: "ui_state_update", stateId, summary });
  }

  disconnect(): void {
    this.pendingOtpRequestResolver = null;
    this.pendingOtpVerifyResolver = null;
    // Detach handlers before closing: a socket closed while still CONNECTING
    // can still fire a late onerror/onclose, which would otherwise reach the
    // hook and flip a freshly-restarted session into an error state (the
    // StrictMode mount→unmount→mount cycle makes this reachable in dev).
    // Callers of disconnect() are always in a teardown path and don't rely
    // on onClosed firing afterwards.
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      this.socket.close();
    }
    this.socket = null;
  }
}
