import { useCallback, useEffect, useRef, useState } from "react";
import { createInitialConversationState, type ConversationState } from "@arteq/shared";
import { DepartmentDoctorPanel, type TouchStage } from "./DepartmentDoctorPanel";
import { LiveTranscript } from "./LiveTranscript";
import { VoiceOrb } from "./VoiceOrb";
import { describePatientUnderstanding } from "./patientUnderstanding";
import { type VoiceSessionResult } from "./useVoiceSession";
import type { AttentionState } from "../presence/useAttentionController";
import { GeminiLiveInputOverlay } from "./GeminiLiveInputOverlay";
import { describeUIState } from "./uiStateDescriptions";

const CONVERSATION_STATE_POLL_MS = 200;
const VOICE_ACTIVITY_RMS_THRESHOLD = 0.02;

// Patient-facing phase — tracks connection and speaking/listening state.
type VoicePhase = "connecting" | "welcoming" | "listening" | "speaking" | "blocked";

function deriveStageOnChange(prevStage: TouchStage, prevState: ConversationState, nextState: ConversationState): TouchStage {
  if (nextState.selectedDoctor && nextState.selectedDoctor.id !== prevState.selectedDoctor?.id) {
    return { kind: "doctor-confirm", doctorId: nextState.selectedDoctor.id, doctorName: nextState.selectedDoctor.name };
  }
  
  if (nextState.selectedDepartment && nextState.selectedDepartment.id !== prevState.selectedDepartment?.id) {
    return { kind: "doctors" };
  }

  if (nextState.doctorsShown.length > 0 && prevState.doctorsShown.length === 0) {
    if (prevStage.kind === "idle" || prevStage.kind === "departments") {
      return { kind: "doctors" };
    }
  }

  if (nextState.departmentsShown.length > 0 && prevState.departmentsShown.length === 0) {
    if (prevStage.kind === "idle") {
      return { kind: "departments" };
    }
  }

  return prevStage;
}

export function VoiceView({
  voiceSession,
  onFinished,
  onAskReceptionist,
  onCancel,
  onStop,
  onActivity,
  attentionState,
}: {
  voiceSession: any; // We could type this as ReturnType<typeof useVoiceSession> if imported, but we'll destructure directly
  onFinished: (result: VoiceSessionResult) => void;
  onAskReceptionist: () => void;
  onCancel: () => void;
  onStop: () => void;
  onActivity?: () => void;
  attentionState?: AttentionState;
}) {
  const {
    status,
    errorMessage,
    isMuted,
    stop,
    reset,
    getOPTicket,
    setMuted,
    selectDepartment,
    selectDoctor,
    clearDepartmentSelection,
    getSegments,
    getAssistantSegments,
    getConversationState,
    getInputLevel,
    getOutputLevel,
    isAssistantSpeaking,
    verifyPatient,
    registerPatient,
    requestOTP,
    verifyOTP,
    sendUIStateUpdate,
    subscribeTranscript,
    getTranscript,
  } = voiceSession;

  const [conversationState, setConversationState] = useState<ConversationState>(
    createInitialConversationState(),
  );
  const [touchStage, setTouchStage] = useState<TouchStage>({ kind: "idle" });
  const [identityStep, setIdentityStep] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<VoicePhase>("connecting");
  const slideDirectionRef = useRef<"forward" | "back">("forward");

  const lastPatientSegCountRef = useRef(0);
  const lastAssistantSegCountRef = useRef(0);
  const wantsToEndRef = useRef(false);
  const endTimerRef = useRef<number | null>(null);
  const ticketAutoNavRef = useRef(false);
  const ticketTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // When VoiceView unmounts, we ONLY clean up UI-specific state.
    // The transport session is intentionally NOT stopped or reset here
    // because KioskShell is the single authoritative owner of the session lifecycle.
    return () => {
      setTouchStage({ kind: "idle" });
      if (endTimerRef.current !== null) {
        window.clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }
      if (ticketTimerRef.current !== null) {
        window.clearTimeout(ticketTimerRef.current);
        ticketTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    lastPatientSegCountRef.current = 0;
    lastAssistantSegCountRef.current = 0;
    wantsToEndRef.current = false;
    ticketAutoNavRef.current = false;

    const id = window.setInterval(() => {
      const next = getConversationState();
      setConversationState((prev) => {
        if (next !== prev) {
          setTouchStage((prevStage) => deriveStageOnChange(prevStage, prev, next));
        }
        return next;
      });

      const speaking = isAssistantSpeaking();

      // Check if conversation should end and clear
      if (next.wantsToEnd && !wantsToEndRef.current) {
        wantsToEndRef.current = true;
      }

      if (wantsToEndRef.current && !speaking && endTimerRef.current === null) {
        endTimerRef.current = window.setTimeout(() => {
          console.log("[VoiceView] Conversation ended. Clearing session to idle.");
          reset();
          onStop();
        }, 1200);
      }

      // Check if ticket was generated and assistant finished speaking
      if (next.ticket && !ticketAutoNavRef.current && !wantsToEndRef.current) {
        ticketAutoNavRef.current = true;
      }

      if (ticketAutoNavRef.current && !speaking && ticketTimerRef.current === null && !wantsToEndRef.current) {
        ticketTimerRef.current = window.setTimeout(() => {
          console.log("[VoiceView] Ticket ready. Transitioning to TicketView.");
          onFinished({
            rawTranscript: voiceSession.getTranscript(),
            segmentCount: voiceSession.getSegments().length,
            conversationState: next,
          });
        }, 1500);
      }

      // Only report activity once the patient is actually in LISTENING phase —
      // audio during welcoming/greeting is the assistant speaking, not the patient.
      const patientSegs = getSegments().length;
      const assistantSegs = getAssistantSegments().length;
      const segmentsGrew =
        patientSegs > lastPatientSegCountRef.current ||
        assistantSegs > lastAssistantSegCountRef.current;
      lastPatientSegCountRef.current = patientSegs;
      lastAssistantSegCountRef.current = assistantSegs;

      const patientEngaged =
        speaking || segmentsGrew || getInputLevel() > VOICE_ACTIVITY_RMS_THRESHOLD;

      if (patientEngaged) onActivity?.();
      
      // Phase is driven directly by transport status and audio playback.
      // When Gemini Live is connecting, show "connecting".
      // Once Gemini is connected (status === "listening"), show "Speaking…" while Gemini plays audio,
      // and "I'm listening…" when Gemini is listening to the patient.
      setPhase(() => {
        if (status === "connecting" || status !== "listening") return "connecting";
        return speaking ? "speaking" : "listening";
      });
      
    }, CONVERSATION_STATE_POLL_MS);

    return () => {
      window.clearInterval(id);
      if (endTimerRef.current !== null) {
        window.clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }
      if (ticketTimerRef.current !== null) {
        window.clearTimeout(ticketTimerRef.current);
        ticketTimerRef.current = null;
      }
    };
  }, [
    getConversationState,
    isAssistantSpeaking,
    getSegments,
    getAssistantSegments,
    getInputLevel,
    onActivity,
    status,
    reset,
    onStop,
    onFinished,
    voiceSession,
  ]);

  // Phase 6: Push compact UI state descriptions to Gemini Live on changes
  useEffect(() => {
    const uiState = describeUIState({
      touchStageKind: touchStage.kind,
      patientFlowState: conversationState.patientFlowState,
      identityStep,
      departmentName: conversationState.selectedDepartment?.name,
      doctorName: conversationState.selectedDoctor?.name,
      readyForTicket: conversationState.readyForTicket,
    });
    sendUIStateUpdate?.(uiState.stateId, uiState.summary);
  }, [
    touchStage.kind,
    conversationState.patientFlowState,
    identityStep,
    conversationState.selectedDepartment?.name,
    conversationState.selectedDoctor?.name,
    conversationState.readyForTicket,
    sendUIStateUpdate,
  ]);

  const handleStop = () => {
    reset();
    onStop();
  };

  const handleGetTicket = async () => {
    const result = await getOPTicket();
    onFinished(result);
  };

  const handleAskReceptionist = () => {
    reset();
    onAskReceptionist();
  };

  const handleRetry = () => {
    reset();
    onCancel();
  };

  const handleSelectDepartment = (deptId: string) => {
    const dept = conversationState.departmentsShown.find(d => d.id === deptId);
    if (!dept) return;
    slideDirectionRef.current = "forward";
    setTouchStage({ kind: "doctors" });
    selectDepartment(dept.id);
    onActivity?.();
  };

  const handleConfirmDepartment = () => {
    slideDirectionRef.current = "forward";
    setTouchStage({ kind: "doctors" });
    const deptId = conversationState.selectedDepartment?.id;
    if (deptId) {
      selectDepartment(deptId);
    }
    onActivity?.();
  };

  useEffect(() => {
    if (
      touchStage.kind === "doctors" &&
      conversationState.doctorsShown.length === 0 &&
      conversationState.selectedDepartment
    ) {
      selectDepartment(conversationState.selectedDepartment.id);
    }
  }, [
    touchStage.kind,
    conversationState.doctorsShown.length,
    conversationState.selectedDepartment,
    selectDepartment,
  ]);

  const handleSelectDoctor = (doctorId: string) => {
    const doc = conversationState.doctorsShown.find(d => d.id === doctorId);
    if (!doc) return;
    slideDirectionRef.current = "forward";
    setTouchStage({ kind: "doctor-confirm", doctorId: doc.id, doctorName: doc.name });
    selectDoctor(doc.id);
    onActivity?.();
  };

  const handleConfirmDoctor = () => {
    slideDirectionRef.current = "forward";
    setTouchStage({ kind: "ready" });
    onActivity?.();
  };

  const handleBack = () => {
    slideDirectionRef.current = "back";
    setTouchStage((prev) => {
      if (prev.kind === "dept-confirm") return { kind: "departments" };
      if (prev.kind === "doctors") {
        clearDepartmentSelection?.();
        setConversationState((prevState) => ({
          ...prevState,
          selectedDepartment: null,
          selectedDoctor: null,
          doctorsShown: [],
        }));
        return { kind: "departments" };
      }
      if (prev.kind === "doctor-confirm") return { kind: "doctors" };
      if (prev.kind === "ready" && conversationState.selectedDoctor) {
        return { kind: "doctor-confirm", doctorId: conversationState.selectedDoctor.id, doctorName: conversationState.selectedDoctor.name };
      }
      return prev;
    });
    onActivity?.();
  };

  const isReadyForTicket = conversationState.readyForTicket && !conversationState.ticket && touchStage.kind === "ready" && conversationState.patientFlowState === "verified";
  // Stop must always be reachable — the old `status !== "listening"` gate
  // disabled it for the full 15-second connect timeout, trapping patients.
  const controlsDisabled = status === "stopping";

  const phaseLabel =
    phase === "blocked"
      ? "Playback blocked (autoplay policy)"
      : status === "connecting" || phase === "connecting"
      ? "Connecting\u2026"
      : phase === "speaking"
      ? "Speaking\u2026"
      : "I'm listening\u2026";

  const understanding = describePatientUnderstanding(conversationState);

  const getDisplayedSegments = useCallback((): readonly string[] => {
    return getAssistantSegments();
  }, [getAssistantSegments]);

  return (
    <div className="screen screen-voice">
      <GeminiLiveInputOverlay
        subscribeTranscript={subscribeTranscript}
        getTranscript={getTranscript}
      />
      {status === "error" ? (
        <>
          <h1>I'm having trouble connecting right now</h1>
          <p className="hint">
            {errorMessage ?? "Please try again, or ask a receptionist for help."}
          </p>
          <div className="voice-controls">
            <button className="primary-action" onClick={handleRetry}>
              Try again
            </button>
            <button className="secondary-action" onClick={handleAskReceptionist}>
              Ask a receptionist
            </button>
          </div>
        </>
      ) : phase === "blocked" ? (
        <>
          <h1 style={{ color: "var(--danger, red)" }}>[ARTEQ-LIVE-FLOW] AUDIO_PLAYBACK_BLOCKED</h1>
          <p className="hint">
            The browser autoplay policy blocked AudioContext.resume() because this was triggered automatically without a user gesture.
            <br /><br />
            <strong>For testing:</strong> Please click anywhere on the page and then stand in front of the camera, or launch Chrome with <code>--autoplay-policy=no-user-gesture-required</code>.
          </p>
          <div className="voice-controls">
            <button className="primary-action" onClick={handleStop}>
              Stop & Return Home
            </button>
          </div>
        </>
      ) : (
        <>
          <VoiceOrb
            status={status}
            phase={phase}
            getInputLevel={getInputLevel}
            getOutputLevel={getOutputLevel}
            isAssistantSpeaking={isAssistantSpeaking}
          />
          <p className="listening-indicator" data-status={status} data-phase={phase} aria-live="polite">
            {phaseLabel}
          </p>
          <div className="transcript-stack">
            {understanding && (
              <p className="patient-understanding" key={understanding} aria-live="polite">
                {understanding}
              </p>
            )}
            <LiveTranscript
              getSegments={getDisplayedSegments}
              active={status === "listening" || status === "stopping"}
            />
          </div>

          <DepartmentDoctorPanel
            stage={touchStage}
            conversationState={conversationState}
            onSelectDepartment={handleSelectDepartment}
            onSelectDoctor={handleSelectDoctor}
            onConfirmDepartment={handleConfirmDepartment}
            onConfirmDoctor={handleConfirmDoctor}
            onBack={handleBack}
            slideDirection={slideDirectionRef.current}
            requestOTP={requestOTP}
            verifyOTP={verifyOTP}
            registerPatient={registerPatient}
            onIdentityStepChange={setIdentityStep}
          />

          <div className="voice-controls">
            <button
              className="iridescent mute-button icon-button mic-btn"
              type="button"
              title={isMuted ? "Unmute microphone" : "Mute microphone"}
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              data-muted={isMuted}
              disabled={controlsDisabled}
              onClick={() => setMuted(!isMuted)}
              aria-pressed={isMuted}
            >
              {isMuted ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              )}
              <span className="mute-indicator"></span>
              <span className="drop-shadow"></span>
            </button>
            <button
              className="iridescent stop-btn"
              onClick={isReadyForTicket ? handleGetTicket : handleStop}
              disabled={controlsDisabled}
            >
              {isReadyForTicket ? "Get OP Ticket" : "Stop"}
              <span className="drop-shadow"></span>
            </button>
            {isReadyForTicket && (
              <button className="iridescent secondary-action" onClick={handleStop} disabled={controlsDisabled}>
                End without a ticket
                <span className="drop-shadow"></span>
              </button>
            )}
          </div>

          <button className="link-action" type="button" onClick={handleAskReceptionist}>
            Ask a receptionist
          </button>
        </>
      )}
    </div>
  );
}
