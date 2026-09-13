import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import fs from "node:fs";
import { WebSocketServer, type WebSocket } from "ws";
import {
  createInitialConversationState,
  type ClientVoiceMessage,
  type ConversationState,
  type ServerVoiceMessage,
} from "@arteq/shared";
import type { VoiceProvider, VoiceSession } from "../providers/voice/VoiceProvider.js";
import { assessAssistantResponse } from "../services/grounding/assessAssistantResponse.js";
import { applyTicketGenerated } from "../services/conversation/conversationState.js";
import { handleHospitalToolCall } from "../services/conversation/geminiTools.js";
import { generateOPTicket } from "../services/hospital/ticketService.js";
import {
  findPatientByNameAndPhone,
  findPatientByPhone,
  registerPatient,
} from "../services/hospital/patientService.js";
import {
  checkVerificationCode,
  sendVerificationCode,
} from "../services/auth/twilioVerifyService.js";

/** Turns the currently-known-real hospital facts (departments/doctors that
 * have actually been looked up via a tool call) into knownFacts strings for
 * the grounding layer — closes the loop between "AI proposes, backend
 * decides" and the safety layer: once real data exists, the grounding
 * check can actually verify claims against it instead of flagging every
 * specific-sounding statement as unbacked. */
function knownFactsFromConversationState(state: ConversationState): string[] {
  const facts: string[] = [];
  for (const doctor of state.doctorsShown) {
    facts.push(`Doctor: ${doctor.name}, ${doctor.specialization}, ${doctor.availableTimings}`);
  }
  for (const department of state.departmentsShown) {
    facts.push(`Department: ${department.name}`);
  }
  if (state.ticket) {
    facts.push(`Ticket: ${state.ticket.ticketNumber}, ${state.ticket.departmentName}, ${state.ticket.doctorName}`);
  }
  return facts;
}

/**
 * Owns the /api/live upgrade path. This is the one place in the backend
 * that speaks the kiosk<->backend voice protocol (packages/shared) and
 * bridges it to whichever VoiceProvider is configured. The kiosk never
 * talks to Gemini directly — see docs/02 §6 provider abstraction and
 * CLAUDE.md §26 (secrets stay server-side).
 */
export function attachVoiceSocket(
  server: { on(event: "upgrade", listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): void },
  provider: VoiceProvider,
) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/api/live") return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleConnection(ws, provider);
    });
  });
}

function send(ws: WebSocket, message: ServerVoiceMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

let activeClientWs: WebSocket | null = null;
let activeLiveSession: VoiceSession | null = null;
let activeSessionCleanup: (() => void) | null = null;

async function handleConnection(ws: WebSocket, provider: VoiceProvider) {
  if (!provider.isConfigured()) {
    send(ws, {
      type: "error",
      code: "PROVIDER_UNAVAILABLE",
      message: "Voice provider is not configured on the server.",
    });
    ws.close();
    return;
  }

  // Enforce single active connection: cleanly stop prior session if another connection arrives
  if (activeClientWs && activeClientWs !== ws) {
    console.log("[voiceSocket] New connection arrived — terminating prior active WebSocket and Gemini session");
    activeSessionCleanup?.();
    try {
      activeLiveSession?.stop();
    } catch (e) {
      console.warn("[voiceSocket] Error stopping prior session:", e);
    }
    try {
      activeClientWs.close(1000, "Superseded by new connection");
    } catch (e) {
      console.warn("[voiceSocket] Error closing prior socket:", e);
    }
    activeLiveSession = null;
    activeClientWs = null;
    activeSessionCleanup = null;
  }
  activeClientWs = ws;

  let isSessionActive = true;
  activeSessionCleanup = () => {
    isSessionActive = false;
  };

  // DEV: Unique session ID helps prove the Gemini session is persistent
  // across turns rather than reconnecting per-utterance.
  const devSessionId = `sess-${Date.now().toString(36)}`;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[ARTEQ-LATENCY-BACKEND] *** NEW WS CONNECTION *** sessionId=${devSessionId}`);
  }

  let session: VoiceSession | null = null;

  // Accumulates the assistant's spoken reply TEXT for the current turn only
  // (never audio bytes) so the grounding layer (services/grounding/) can
  // assess the whole reply once it's complete — see assessAssistantResponse's
  // docstring for why this can only run after the turn, not before/during
  // real-time audio playback. Reset on every assistant_turn_complete.
  let assistantTurnTextBuffer = "";
  // Latest authoritative navigation state.
  let latestConversationState: ConversationState | null = null;
  let inAudioChunkCount = 0;
  let assistantAudioChunkCount = 0;

  // NEW (native-audio vertical slice bug fix, discovered via real-mic
  // testing): the kiosk's "Stop" button used to close the Gemini Live
  // session immediately on the client's `stop` message. That was correct
  // when this provider only ever transcribed (nothing to wait for), but
  // with native audio output enabled, closing the session immediately cuts
  // it off before the model has any chance to generate and stream its
  // spoken reply — real-mic testing confirmed input transcription worked
  // but no assistant audio ever arrived, because the session was already
  // gone. Fix: on `stop`, stop accepting the PATIENT's further input but
  // keep the session open until the assistant's reply turn completes (or a
  // safety timeout elapses, in case no reply ever comes) before actually
  // closing it.
  let pendingStop = false;
  let pendingStopTimeout: ReturnType<typeof setTimeout> | null = null;
  // Whether the assistant is CURRENTLY mid-reply (audio/transcript streaming
  // for a turn that hasn't completed). Set on the first chunk of a turn,
  // cleared on turn-complete / interruption. Used so that pressing Stop
  // AFTER the assistant has already finished speaking closes the session
  // right away instead of sitting through the full safety timeout — that
  // dead wait was the single worst piece of dead air in the kiosk flow.
  let assistantTurnInProgress = false;
  // Phase 5 real-mic testing (2026-08-31): a reply that involves chained
  // tool calls (e.g. find_department -> list_doctors -> select_doctor ->
  // generate_op_ticket, all before the model speaks a word) routinely took
  // longer than the original 10s to produce a turnComplete — logs showed
  // this firing on nearly every session, including ones where the ticket
  // itself had already been generated correctly. Raised to give multi-tool
  // turns realistic room; still just a safety ceiling; the happy path
  // always resolves earlier via the real onAssistantTurnComplete event.
  const PENDING_STOP_SAFETY_TIMEOUT_MS = 20000;

  function finalizeStopIfPending() {
    if (!pendingStop) return;
    pendingStop = false;
    if (pendingStopTimeout) {
      clearTimeout(pendingStopTimeout);
      pendingStopTimeout = null;
    }
    session?.stop();
  }

  function beginPendingStop() {
    pendingStop = true;
    // If the assistant isn't currently mid-reply, there is nothing to wait
    // for — close now rather than making the patient watch a frozen screen
    // for the full safety timeout.
    if (!assistantTurnInProgress) {
      finalizeStopIfPending();
      return;
    }
    // Otherwise give the model a chance to finish generating/streaming its
    // spoken reply first (see pendingStop docstring above). If that reply
    // never completes, the safety timeout force-closes so the session can
    // never leak indefinitely.
    pendingStopTimeout = setTimeout(() => {
      console.warn("[voice] assistant reply timed out — closing session without one");
      finalizeStopIfPending();
    }, PENDING_STOP_SAFETY_TIMEOUT_MS);
  }

  try {
    session = await provider.startSession({
      onTranscriptDelta: (text) => {
        if (!isSessionActive || activeClientWs !== ws) return;
        console.log(`[voiceSocket] Relaying patient transcript to kiosk: "${text}"`);
        send(ws, { type: "transcript_delta", text });
      },
      onTurnComplete: () => {
        if (!isSessionActive || activeClientWs !== ws) return;
        // Provider-level turn boundary only (docs/04 §9). The app-controlled
        // recording session continues until the kiosk explicitly stops.
      },
      onAssistantAudioChunk: (base64Pcm) => {
        if (!isSessionActive || activeClientWs !== ws) return;
        assistantTurnInProgress = true;
        assistantAudioChunkCount++;
        if (assistantAudioChunkCount === 1 || assistantAudioChunkCount % 50 === 0) {
          console.log(`[voiceSocket] Forwarding assistant audio chunk #${assistantAudioChunkCount} (${base64Pcm.length} b64 chars)`);
        }
        send(ws, { type: "assistant_audio_chunk", base64Pcm });
      },
      onAssistantTranscriptDelta: (text) => {
        if (!isSessionActive || activeClientWs !== ws) return;
        assistantTurnInProgress = true;
        assistantTurnTextBuffer += text;
        send(ws, { type: "assistant_transcript_delta", text });
      },
      onAssistantTurnComplete: () => {
        if (!isSessionActive || activeClientWs !== ws) return;
        console.log(`[voiceSocket] Assistant turn complete`);
        const knownFacts = latestConversationState
          ? knownFactsFromConversationState(latestConversationState)
          : [];
        const assessment = assessAssistantResponse(assistantTurnTextBuffer, knownFacts);
        if (assessment.status !== "CLEAR") {
          console.warn(
            `[grounding] assistant response flagged for review: [${assessment.reasons.join(",")}]`,
          );
        }
        assistantTurnTextBuffer = "";
        assistantTurnInProgress = false;
        send(ws, { type: "assistant_turn_complete" });
        finalizeStopIfPending();
      },
      onInterrupted: () => {
        if (!isSessionActive || activeClientWs !== ws) return;
        console.log(`[voiceSocket] Assistant interrupted`);
        assistantTurnTextBuffer = "";
        assistantTurnInProgress = false;
        send(ws, { type: "assistant_interrupted" });
      },
      onConversationStateUpdate: (state) => {
        if (!isSessionActive || activeClientWs !== ws) return;
        latestConversationState = state;
        send(ws, { type: "conversation_state_update", state });
      },
      onError: (message) => {
        if (!isSessionActive || activeClientWs !== ws) return;
        send(ws, { type: "error", code: "SESSION_ERROR", message });
      },
      onClose: () => {
        if (!isSessionActive || activeClientWs !== ws) return;
        send(ws, { type: "session_closed" });
      },
    });
    if (!isSessionActive || activeClientWs !== ws) {
      console.log("[voiceSocket] Client disconnected or superseded while Gemini Live was connecting — stopping orphaned session immediately");
      session.stop();
      return;
    }
    activeLiveSession = session;
  } catch (err) {
    if (!isSessionActive || activeClientWs !== ws) return;
    send(ws, {
      type: "error",
      code: "PROVIDER_CONNECTION_FAILED",
      message: err instanceof Error ? err.message : "Failed to start voice session",
    });
    ws.close();
    return;
  }

  send(ws, { type: "session_ready" });
  session.triggerGreeting?.();

  ws.on("message", async (raw) => {
    if (!isSessionActive || activeClientWs !== ws || !session) return;
    let message: ClientVoiceMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (message.type === "audio_chunk") {
      inAudioChunkCount++;
      const buf = Buffer.from(message.base64Pcm16, "base64");
      
      // Save first 150 chunks (~3 seconds) to a WAV file for diagnosis
      if (inAudioChunkCount === 1) {
        (globalThis as any).__debugPcmChunks = [];
      }
      if ((globalThis as any).__debugPcmChunks && (globalThis as any).__debugPcmChunks.length < 150) {
        (globalThis as any).__debugPcmChunks.push(buf);
        if ((globalThis as any).__debugPcmChunks.length === 150) {
          try {
            const allPcm = Buffer.concat((globalThis as any).__debugPcmChunks);
            const wavHeader = Buffer.alloc(44);
            wavHeader.write("RIFF", 0);
            wavHeader.writeUInt32LE(36 + allPcm.length, 4);
            wavHeader.write("WAVE", 8);
            wavHeader.write("fmt ", 12);
            wavHeader.writeUInt32LE(16, 16);
            wavHeader.writeUInt16LE(1, 20); // PCM
            wavHeader.writeUInt16LE(1, 22); // mono
            wavHeader.writeUInt32LE(16000, 24); // 16kHz
            wavHeader.writeUInt32LE(32000, 28); // byte rate
            wavHeader.writeUInt16LE(2, 32); // block align
            wavHeader.writeUInt16LE(16, 34); // bits per sample
            wavHeader.write("data", 36);
            wavHeader.writeUInt32LE(allPcm.length, 40);
            const savePath = fs.existsSync("scratch") ? "scratch/kiosk_mic_debug.wav" : "apps/backend/scratch/kiosk_mic_debug.wav";
            fs.writeFileSync(savePath, Buffer.concat([wavHeader, allPcm]));
            console.log(`[voiceSocket] *** SAVED ${savePath} (${allPcm.length} bytes, ${(allPcm.length / 32000).toFixed(2)}s) ***`);
          } catch (e) {
            console.error("[voiceSocket] Error saving debug wav:", e);
          }
        }
      }

      if (inAudioChunkCount === 1 || inAudioChunkCount % 25 === 0) {
        let sumSq = 0;
        let max = 0;
        const numSamples = buf.length / 2;
        for (let i = 0; i < numSamples; i++) {
          const s = Math.abs(buf.readInt16LE(i * 2) / 32768);
          if (s > max) max = s;
          sumSq += s * s;
        }
        const rms = Math.sqrt(sumSq / Math.max(1, numSamples));
        console.log(`[ARTEQ-TRACE:3-BackendWS] Chunk #${inAudioChunkCount} (${buf.length} bytes, rms=${rms.toFixed(4)}, max=${max.toFixed(4)})`);
      }
      session.sendAudioChunk(message.base64Pcm16);
    } else if (message.type === "stop") {
      beginPendingStop();
    } else if (message.type === "get_op_ticket") {
      // Deterministic ticket authorization: patient MUST be verified
      if (latestConversationState?.readyForTicket && !latestConversationState.ticket) {
        if (latestConversationState.patientFlowState !== "verified" || !latestConversationState.patientRecord) {
          console.warn("[voiceSocket] get_op_ticket rejected: patient not verified");
          latestConversationState.patientFlowState = "choice";
          send(ws, { type: "conversation_state_update", state: latestConversationState });
          send(ws, {
            type: "error",
            code: "SESSION_ERROR",
            message: "Patient identity must be verified before an OP ticket can be issued.",
          });
        } else {
          const { selectedDepartment, selectedDoctor } = latestConversationState;
          if (selectedDepartment && selectedDoctor) {
            const ticket = generateOPTicket({
              patient: latestConversationState.patientRecord,
              departmentName: selectedDepartment.name,
              doctorName: selectedDoctor.name,
              estimatedWaitMinutes: selectedDoctor.estimatedWaitMinutes,
            });
            latestConversationState = applyTicketGenerated(latestConversationState, ticket);
            send(ws, { type: "conversation_state_update", state: latestConversationState });
          }
        }
      }
      beginPendingStop();
    } else if (message.type === "request_otp") {
      const { phone } = message;
      const patient = await findPatientByPhone(phone);
      if (!patient) {
        send(ws, {
          type: "otp_sent",
          phone,
          success: false,
          message: "No registered patient found with this phone number. Please register as a new patient.",
        });
      } else {
        const result = await sendVerificationCode(phone);
        send(ws, {
          type: "otp_sent",
          phone,
          success: result.success,
          message: result.message,
        });
      }
    } else if (message.type === "verify_otp") {
      const { phone, code } = message;
      const checkResult = await checkVerificationCode(phone, code);
      if (checkResult.verified) {
        const patient = await findPatientByPhone(phone);
        if (patient && latestConversationState) {
          latestConversationState.patientRecord = patient;
          latestConversationState.patientFlowState = "verified";
          send(ws, { type: "conversation_state_update", state: latestConversationState });
          send(ws, { type: "otp_verified", phone, success: true, patient });
        } else {
          send(ws, {
            type: "otp_verified",
            phone,
            success: false,
            message: "Patient record could not be loaded after verification.",
          });
        }
      } else {
        send(ws, {
          type: "otp_verified",
          phone,
          success: false,
          message: checkResult.message ?? "Invalid or expired OTP code.",
        });
      }
    } else if (message.type === "ui_state_update") {
      if (latestConversationState) {
        latestConversationState.currentUIState = { stateId: message.stateId, summary: message.summary };
      }
      session.updateUIState?.(message.stateId, message.summary);
    } else if (message.type === "trigger_greeting") {
      session.triggerGreeting?.();
    } else if (message.type === "select_department" || message.type === "select_doctor") {
      // Touch fallback (CLAUDE.md §20): the patient tapped a department/
      // doctor card instead of naming it aloud. Dispatched through the
      // EXACT SAME deterministic backend logic a voice-driven Gemini tool
      // call uses — touch and voice are two input paths into one real
      // state change, never a parallel selection mechanism.
      const toolArgs =
        message.type === "select_department"
          ? { department_id: message.departmentId }
          : { doctor_id: message.doctorId };
      let { newState } = handleHospitalToolCall(
        message.type,
        toolArgs,
        latestConversationState ?? createInitialConversationState(),
      );
      
      // BUG 1 FIX: When a patient touches a department, they shouldn't need to speak 
      // again to fetch doctors. Automatically run the list_doctors tool logic to 
      // populate the deterministic doctor list in the exact same state update.
      if (message.type === "select_department" && newState.selectedDepartment) {
        const selectedDeptId = newState.selectedDepartment.id;
        if (newState.departmentsShown.length === 0) {
          newState = handleHospitalToolCall("list_departments", {}, newState).newState;
        }
        const listOutcome = handleHospitalToolCall(
          "list_doctors",
          { department_id: selectedDeptId },
          newState
        );
        newState = listOutcome.newState;
      }
      
      latestConversationState = newState;
      send(ws, { type: "conversation_state_update", state: latestConversationState });
    } else if (message.type === "verify_patient") {
      const patient = await findPatientByNameAndPhone(message.name, message.phone);
      if (latestConversationState) {
        if (patient) {
          latestConversationState.patientRecord = patient;
          latestConversationState.patientFlowState = "verified";
        } else {
          latestConversationState.patientRecord = null;
        }
        send(ws, { type: "conversation_state_update", state: latestConversationState });
      }
    } else if (message.type === "register_patient") {
      const patient = await registerPatient({
        name: message.name,
        phone: message.phone,
        address: message.address,
        idPhotoRef: message.idPhotoRef,
      });
      if (latestConversationState) {
        latestConversationState.patientRecord = patient;
        latestConversationState.patientFlowState = "verified";
        send(ws, { type: "conversation_state_update", state: latestConversationState });
      }
    }
  });

  ws.on("close", () => {
    isSessionActive = false;
    if (activeClientWs === ws) {
      activeClientWs = null;
      activeLiveSession = null;
      activeSessionCleanup = null;
    }
    session?.stop();
  });
}
