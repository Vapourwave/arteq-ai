import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialConversationState,
  type ConversationState,
  type TranscriptProcessingResult,
} from "@arteq/shared";
import type { KioskState } from "./kioskState";
import { useInactivityReset } from "./useInactivityReset";
import { StillTherePrompt } from "./StillTherePrompt";
import { SHOW_DEV_TOOLS } from "../config/demo";
import { createPresenceDetector } from "../features/presence/createPresenceDetector";
import type { DevelopmentPresenceDetector } from "../features/presence/DevelopmentPresenceDetector";
import { IdleView } from "../features/idle/IdleView";
import { WelcomeView } from "../features/welcome/WelcomeView";
import { VoiceView } from "../features/voice/VoiceView";
import { ProcessingView } from "../features/processing/ProcessingView";
import { CompleteView } from "../features/complete/CompleteView";
import { TicketView } from "../features/ticket/TicketView";
import { ReceptionistHandoffView } from "../features/receptionist/ReceptionistHandoffView";
import { TTSTestView } from "../features/ttsTest/TTSTestView";
import { AdminView } from "../features/admin/AdminView";
import { useAttentionController, type AttentionState } from "../features/presence/useAttentionController";
import { useVoiceSession } from "../features/voice/useVoiceSession";

/**
 * The single owner of session state (docs/02 §24: one shell, one view per
 * state — NOT one giant component holding every workflow's JSX, which is
 * what the legacy PatientKioskWorkflow.tsx did across 1700+ lines and 8
 * steps). Each state below renders its own small, focused view component.
 */
export function KioskShell() {
  const [state, setState] = useState<KioskState>("idle");
  const [rawTranscript, setRawTranscript] = useState("");
  const [segmentCount, setSegmentCount] = useState(1);
  const [processingResult, setProcessingResult] = useState<TranscriptProcessingResult | null>(null);
  // Phase 5 — set only when a voice session ends with a real, backend-
  // generated OP ticket (see the "listening" branch below); drives the
  // "ticket" state, kept fully separate from the older refinement result.
  const [conversationState, setConversationState] = useState<ConversationState>(
    createInitialConversationState(),
  );
  // EXPERIMENTAL, dev-only — deliberately NOT a KioskState value: this is a
  // side tool for evaluating Fish S2 Pro, not a step in the documented
  // patient journey, so it doesn't belong in that state machine's meaning.
  const [showTTSTest, setShowTTSTest] = useState(false);

  const [interactionLatch, setInteractionLatch] = useState(false);
  // Tracks the previous attention state so we can detect the genuine
  // non-attentive → attentive EDGE rather than reacting to the level.
  // Using a ref (not state) so updating it never causes a re-render of its own.
  const prevAttentionRef = useRef<AttentionState>("no_face");

  // Prevent StrictMode double-invocation from launching two concurrent connections.
  const attentionHandledRef = useRef<boolean>(false);

  const { detector, mode } = useMemo(() => createPresenceDetector(), []);
  const detectorRef = useRef(detector);
  
  const { attentionState, isCameraActive } = useAttentionController();

  const voiceSession = useVoiceSession();
  const { reset: resetVoiceSession, start: startVoiceSession, isSpeaking, isAssistantSpeaking, setMuted } = voiceSession;

  const lastActiveTimestampRef = useRef<number>(Date.now());

  const handleManualStart = useCallback(() => {
    attentionHandledRef.current = true;
    setInteractionLatch(true);
    startVoiceSession();
    setMuted(false);
    lastActiveTimestampRef.current = Date.now();
    setState("listening");
  }, [startVoiceSession, setMuted]);

  useEffect(() => {
    // Only use the old motion detector if we're in development mode (touch/mouse simulation)
    if (mode === "development") {
      detectorRef.current.start(handleManualStart);
      return () => detectorRef.current.stop();
    }
  }, [mode, handleManualStart]);

  // Handle auto-greeting via Attention Controller — EDGE-TRIGGERED.
  //
  // IMPORTANT: this effect intentionally fires only on the genuine transition
  // from a non-attentive state → "attentive". It does NOT fire if the face
  // is already attentive when Stop is pressed (which is the bug this fixes).
  //
  // Why edge, not level:
  //   resetToIdle() used to clear interactionLatch unconditionally. If the
  //   face was still in "attentive" when Stop fired, the level check would
  //   immediately re-trigger a new greeting on the very next React render —
  //   causing Gemini to greet even with no new attention episode and even
  //   when the camera reported no face shortly after. See bug report:
  //   "Stop → reconnect → greeting with no face".
  useEffect(() => {
    const prevAttention = prevAttentionRef.current;
    prevAttentionRef.current = attentionState;

    const isNewAttentionEdge = prevAttention !== "attentive" && attentionState === "attentive";
    if (state === "idle" && isNewAttentionEdge && !interactionLatch) {
      if (attentionHandledRef.current) return;
      attentionHandledRef.current = true;

      console.log(`[ARTEQ-LIVE-FLOW] ${Date.now()} ATTENTION_EDGE state=${state} attention=${attentionState}`);
      setInteractionLatch(true);
      startVoiceSession();
      lastActiveTimestampRef.current = Date.now();
      setState("listening");
    }
  }, [state, attentionState, interactionLatch, startVoiceSession]);

  // Reset the interaction latch ONLY when attention is genuinely lost and
  // the kiosk is idle. This is the only safe moment to arm the system for
  // the next patient — pressing Stop while the face is still present must
  // NOT reset the latch (which would allow an immediate re-greeting).
  useEffect(() => {
    if (state === "idle" && attentionState === "no_face") {
      setInteractionLatch(false);
      attentionHandledRef.current = false;
    }
  }, [state, attentionState]);


  const resetToIdle = useCallback(() => {
    // Session reset: clear all transient state (docs/02 §22, docs/05 §32).
    // Every future patient/OTP/routing/token field must be cleared here too.
    resetVoiceSession();
    setRawTranscript("");
    setSegmentCount(1);
    setProcessingResult(null);
    setConversationState(createInitialConversationState());
    // NOTE: interactionLatch is deliberately NOT reset here.
    // Resetting it unconditionally was the root cause of the
    // "Stop → reconnect → greeting with no face" bug: if the face is still
    // present when Stop fires, clearing the latch immediately re-arms the
    // level-based attention check, which then instantly restarts the
    // interaction and triggers a new greeting.
    //
    // The latch is now reset only by the dedicated no_face effect above,
    // which fires only after the patient has genuinely left the frame.
    setState("idle");
  }, [resetVoiceSession]);

  // Public-kiosk inactivity guard (docs/03 §30, CLAUDE.md §23): a patient
  // who walks away must never leave their session (transcript, selected
  // department/doctor, ticket — and, later, identity) sitting on screen for
  // the next person. Active on every state except idle.
  const { promptVisible, confirmPresence, notePatientActivity } = useInactivityReset({
    enabled: state !== "idle" && !showTTSTest,
    onReset: resetToIdle,
  });

  const handleActivity = useCallback(() => {
    lastActiveTimestampRef.current = Date.now();
    notePatientActivity();
  }, [notePatientActivity]);

  // Walk-away cleanup: ONLY if camera is actively tracking, no face is detected,
  // the assistant is NOT currently speaking, and no activity (speech or touch) has occurred for 25s.
  // Never resets while assistant audio is playing mid-sentence.
  useEffect(() => {
    if (state === "idle" || showTTSTest) return;
    if (!isCameraActive) return;

    const intervalId = window.setInterval(() => {
      // Never reset while assistant is actively speaking or queued audio is playing
      if (isSpeaking || isAssistantSpeaking()) {
        lastActiveTimestampRef.current = Date.now();
        return;
      }

      // If face is present or attentive, refresh active timestamp
      if (attentionState !== "no_face") {
        lastActiveTimestampRef.current = Date.now();
        return;
      }

      // If no_face for 25 consecutive seconds with no speech or activity
      const inactiveMs = Date.now() - lastActiveTimestampRef.current;
      if (inactiveMs >= 25000) {
        console.log(`[KioskShell] Walk-away timeout: no face detected and inactive for ${inactiveMs}ms. Resetting to idle.`);
        resetToIdle();
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [state, attentionState, isCameraActive, resetToIdle, showTTSTest, isSpeaking, isAssistantSpeaking]);

  // Presenter panic button (docs/demo-script.md "Reset procedure"): pressing
  // Escape from anywhere fully resets the session to the idle screen — and,
  // because leaving "listening" unmounts VoiceView, its cleanup tears the
  // mic / socket / audio down with it. No on-screen control, so a patient
  // can never trigger it and it never clutters the client-facing UI.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowTTSTest(false);
        resetToIdle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resetToIdle]);

  if (showTTSTest) {
    return (
      <main className="kiosk-shell">
        <TTSTestView onClose={() => setShowTTSTest(false)} />
      </main>
    );
  }

  return (
    <main className="kiosk-shell">
      {state === "idle" && (
        <IdleView
          showManualTrigger={mode === "development"}
          onSimulatePresence={handleManualStart}
          onOpenTTSTest={SHOW_DEV_TOOLS ? () => setShowTTSTest(true) : undefined}
          onOpenAdmin={() => setState("admin")}
        />
      )}
      {state === "welcome" && (
        <div className="premium-enter">
          <WelcomeView
            onSpeak={() => {
              startVoiceSession();
              setMuted(false);
              lastActiveTimestampRef.current = Date.now();
              setState("listening");
            }}
            onAskReceptionist={() => setState("receptionist")}
          />
        </div>
      )}
      {state === "listening" && (
        <div className="premium-enter">
          <VoiceView
            voiceSession={voiceSession}
            attentionState={attentionState}
            onActivity={handleActivity}
            onAskReceptionist={() => setState("receptionist")}
            onCancel={() => setState("welcome")}
          onStop={resetToIdle}
          onFinished={(result) => {
            // Phase 5: a real, backend-confirmed ticket already exists —
            // go straight to the ticket/summary screen. Otherwise, fall
            // back to the original transcript-refinement flow (patient
            // stopped before reaching a ticket, or a session error).
            if (result.conversationState.ticket) {
              setConversationState(result.conversationState);
              setState("ticket");
              return;
            }
            setRawTranscript(result.rawTranscript);
            setSegmentCount(result.segmentCount);
            setState("processing");
          }}
        />
        </div>
      )}
      {state === "processing" && (
        <ProcessingView
          rawTranscript={rawTranscript}
          segmentCount={segmentCount}
          onFinished={(result) => {
            setProcessingResult(result);
            setState("complete");
          }}
        />
      )}
      {state === "complete" && processingResult && (
        <CompleteView result={processingResult} onStartOver={resetToIdle} />
      )}
      {state === "ticket" && (
        <TicketView conversationState={conversationState} onStartOver={resetToIdle} />
      )}
      {state === "receptionist" && (
        <ReceptionistHandoffView onBack={() => setState("welcome")} />
      )}
      {state === "admin" && (
        <AdminView onClose={() => resetToIdle()} />
      )}

      {promptVisible && <StillTherePrompt onConfirm={confirmPresence} />}
    </main>
  );
}
