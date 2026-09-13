import { useCallback, useRef, useState } from "react";
import { createInitialConversationState, type ConversationState, type Patient } from "@arteq/shared";
import { AudioCapture } from "./audio/AudioCapture";
import { AudioPlayback } from "./audio/AudioPlayback";
import { VoiceSocketClient } from "./VoiceSocketClient";
import { joinTranscriptSegments, pushTranscriptSegment } from "./transcriptAccumulation";

export type VoiceSessionStatus = "idle" | "connecting" | "listening" | "stopping" | "error";

export interface VoiceSessionResult {
  rawTranscript: string;
  /** How many discrete segments were joined to form rawTranscript — passed
   * to the Phase 4 refinement gate as a weak signal, never used alone. */
  segmentCount: number;
  /** The final authoritative navigation state when the session ended —
   * Phase 5: lets KioskShell go straight to the ticket/summary screen when
   * a ticket exists, instead of always routing through the older
   * transcript-refinement flow. */
  conversationState: ConversationState;
}

const BACKEND_WS_URL =
  import.meta.env.VITE_BACKEND_WS_URL ?? "ws://localhost:8787/api/live";

// Flush window after Stop is pressed: gives trailing transcription events a
// chance to arrive before we read the final transcript and tear the session
// down. docs/04 §11 explicitly flags that this duration should be measured
// on real hardware rather than assumed — 350ms is carried over from the
// legacy implementation as a starting point only, not a validated value.
const STOP_FLUSH_MS = 350;

// Ceiling, not a target: stop()/getOPTicket() resolve as soon as
// assistant_turn_complete (or session_closed/an error) arrives, whichever
// is first; this timeout only guards against a reply that never completes
// (real-mic testing showed closing immediately cuts the reply off). Kept
// comfortably above the backend's own PENDING_STOP_SAFETY_TIMEOUT_MS (see
// voiceSocket.ts, raised to 20000ms for the same reason) so the backend's
// real decision always wins the race, not this client-side fallback.
const ASSISTANT_REPLY_WAIT_TIMEOUT_MS = 24000;

// Guard against a session that opens the socket but never reaches "listening"
// (backend up, but the voice provider hangs before sending session_ready, or
// the mic grant never resolves). Without this the kiosk sits on "Connecting…"
// with the Stop button disabled and no way out — a trapped patient on an
// unattended device. On expiry we surface the same patient-facing error path
// as any other connection failure (Try again / Ask a receptionist).
const CONNECT_TIMEOUT_MS = 30000;

/**
 * Owns the lifecycle of one voice session and is the ONLY place that bridges
 * the audio/socket layer into React. Per CLAUDE.md §7 / docs/02 §9, the
 * transcript itself is accumulated in a ref (`transcriptRef`), NOT React
 * state — only coarse status changes (idle/connecting/listening/error) go
 * through useState, because those happen a handful of times per session,
 * not 10x/second like transcript deltas do.
 *
 * The live transcript is exposed via `getTranscript()`, a stable function
 * reading the ref directly — see LiveTranscript.tsx, which polls this
 * instead of subscribing to it, so the parent tree never re-renders on
 * every incoming word. `getConversationState()`, `getInputLevel()`, and
 * `getOutputLevel()` follow the same poll-a-ref pattern (Phase 5) — see
 * DepartmentDoctorPanel.tsx and VoiceOrb.tsx, which poll these on their own
 * timers instead of subscribing.
 *
 * Transcript deltas are accumulated as discrete SEGMENTS (see
 * transcriptAccumulation.ts), not concatenated as one raw string — this is
 * the fix for the natural-pause fragmentation bug (Gemini Live splitting one
 * utterance-with-a-pause into several delta events that used to get glued
 * together with no separator).
 */
export function useVoiceSession(opts?: { 
  onPlaybackEnd?: () => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}) {
  const onPlaybackEndRef = useRef(opts?.onPlaybackEnd);
  onPlaybackEndRef.current = opts?.onPlaybackEnd;
  const onPlaybackStateChangeRef = useRef(opts?.onPlaybackStateChange);
  onPlaybackStateChangeRef.current = opts?.onPlaybackStateChange;

  const [status, setStatus] = useState<VoiceSessionStatus>("idle");
  const statusRef = useRef<VoiceSessionStatus>("idle");
  const isStartingRef = useRef(false);

  const updateStatus = useCallback((next: VoiceSessionStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Mute is a coarse, rarely-changing UI toggle — fine as real React state,
  // unlike the high-frequency refs below.
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const segmentsRef = useRef<string[]>([]);
  const captureRef = useRef<AudioCapture | null>(null);
  const socketRef = useRef<VoiceSocketClient | null>(null);

  // Assistant's spoken reply — same ref-based, non-React-state discipline as
  // the patient transcript above (CLAUDE.md §7), and deliberately a SEPARATE
  // ref/array so the two speech streams (patient vs. assistant) are never
  // conflated in kiosk state.
  const assistantSegmentsRef = useRef<string[]>([]);
  const playbackRef = useRef<AudioPlayback | null>(null);
  // Set by stop()/getOPTicket() while waiting for the assistant's reply
  // turn to finish; called by onAssistantTurnComplete/onError/onClosed to
  // unblock it early instead of always waiting the full safety timeout.
  const assistantReplyDoneRef = useRef<(() => void) | null>(null);
  // Cleared once the session reaches "listening" (or errors/closes first).
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Phase 5 — authoritative hospital-navigation state, ref-based for the
  // same hot-path reason as the transcript (updates can arrive mid-turn).
  const conversationStateRef = useRef<ConversationState>(createInitialConversationState());
  const lastSentUIStateIdRef = useRef<string | null>(null);

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  const transcriptListenersRef = useRef<Set<(text: string, full: string) => void>>(new Set());
  const subscribeTranscript = useCallback((cb: (text: string, full: string) => void) => {
    transcriptListenersRef.current.add(cb);
    return () => {
      transcriptListenersRef.current.delete(cb);
    };
  }, []);

  const getTranscript = useCallback(() => joinTranscriptSegments(segmentsRef.current), []);
  const getAssistantTranscript = useCallback(
    () => joinTranscriptSegments(assistantSegmentsRef.current),
    [],
  );
  // Segment-level accessors (same ref, no copy) — LiveTranscript renders one
  // element per segment so it can animate only newly-appended segments
  // instead of re-animating the whole paragraph on every ASR delta. Still a
  // poll-a-ref read, never React state (CLAUDE.md §7).
  const getSegments = useCallback((): readonly string[] => segmentsRef.current, []);
  const getAssistantSegments = useCallback(
    (): readonly string[] => assistantSegmentsRef.current,
    [],
  );
  const getConversationState = useCallback(() => conversationStateRef.current, []);
  const getInputLevel = useCallback(() => captureRef.current?.getInputLevel() ?? 0, []);
  const getOutputLevel = useCallback(() => playbackRef.current?.getOutputLevel() ?? 0, []);
  const isAssistantSpeaking = useCallback(() => playbackRef.current?.isPlaying() ?? false, []);

  const start = useCallback(async () => {
    if (isStartingRef.current || statusRef.current === "connecting" || statusRef.current === "listening") {
      console.log(`[ARTEQ-LIVE-FLOW] start() ignored: session is already ${statusRef.current} (isStarting=${isStartingRef.current})`);
      return;
    }
    isStartingRef.current = true;
    console.log(`[ARTEQ-LIVE-FLOW] ${Date.now()} VOICE_START_CALLED status=${statusRef.current}`);

    // Self-idempotent: tear down any prior session's resources before
    // opening a new one (covers the StrictMode mount→unmount→mount cycle
    // and any accidental double-start) — no setState here, that's below.
    socketRef.current?.disconnect();
    captureRef.current?.stop();
    playbackRef.current?.stop();
    clearConnectTimeout();

    segmentsRef.current = [];
    assistantSegmentsRef.current = [];
    conversationStateRef.current = createInitialConversationState();
    transcriptListenersRef.current.forEach((cb) => {
      try { cb("", ""); } catch {}
    });
    setErrorMessage(null);
    isMutedRef.current = false;
    setIsMuted(false);
    updateStatus("connecting");

    const socket = new VoiceSocketClient();
    const capture = new AudioCapture();
    capture.setMuted(false);
    const playback = new AudioPlayback();
    playback.initialize();
    
    socketRef.current = socket;
    captureRef.current = capture;
    playbackRef.current = playback;
    playback.onPlaybackEnd = () => onPlaybackEndRef.current?.();
    playback.onPlaybackStateChange = (isPlaying) => {
      setIsSpeaking(isPlaying);
      onPlaybackStateChangeRef.current?.(isPlaying);
    };

    connectTimeoutRef.current = setTimeout(() => {
      if (socketRef.current !== socket) return;
      console.log(`[ARTEQ-LIVE-FLOW] ${Date.now()} GEMINI_READY_TIMEOUT WebSocketState=${socketRef.current?.getReadyState()} status=${statusRef.current}`);
      connectTimeoutRef.current = null;
      isStartingRef.current = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
      captureRef.current?.stop();
      captureRef.current = null;
      setErrorMessage(
        "Connecting is taking longer than expected. Please try again, or ask a receptionist for help.",
      );
      updateStatus("error");
    }, CONNECT_TIMEOUT_MS);

    console.log(`[ARTEQ-LIVE-FLOW] ${Date.now()} WS_CONNECT_ATTEMPT`);
    socket.connect(BACKEND_WS_URL, {
      onReady: async () => {
        if (socketRef.current !== socket || captureRef.current !== capture) {
          return;
        }
        isStartingRef.current = false;
        console.log(`[ARTEQ-LIVE-FLOW] ${Date.now()} GEMINI_READY`);
        clearConnectTimeout();
        await capture.start({
          onChunk: (base64Pcm16) => {
            if (socketRef.current !== socket) return;
            // Hot path: fires many times per second. Must never call
            // setState here — see module docstring.
            socket.sendAudioChunk(base64Pcm16);
          },
          onError: (reason) => {
            if (socketRef.current !== socket) return;
            console.log(`[ARTEQ-LIVE-FLOW] ${Date.now()} VOICE_ERROR (mic error) reason=${reason}`);
            const message =
              reason === "permission_denied"
                ? "Microphone access was denied. Please allow microphone access and try again."
                : "The microphone isn't available right now.";
            setErrorMessage(message);
            updateStatus("error");
          },
        });
        updateStatus("listening");
      },
      onTranscriptDelta: (text) => {
        if (socketRef.current !== socket) return;
        // Also the hot path on the receiving side — ref only, no setState.
        segmentsRef.current = pushTranscriptSegment(segmentsRef.current, text);
        const full = joinTranscriptSegments(segmentsRef.current);
        transcriptListenersRef.current.forEach((cb) => {
          try {
            cb(text, full);
          } catch (err) {
            console.error("[useVoiceSession] transcript listener error:", err);
          }
        });
      },
      onAssistantAudioChunk: (base64Pcm) => {
        if (socketRef.current !== socket) return;
        // Hot path on the receiving side, same as onTranscriptDelta above —
        // playback scheduling only, never setState.
        playbackRef.current?.enqueueChunk(base64Pcm);
      },
      onAssistantTranscriptDelta: (text) => {
        if (socketRef.current !== socket) return;
        assistantSegmentsRef.current = pushTranscriptSegment(assistantSegmentsRef.current, text);
      },
      onAssistantTurnComplete: () => {
        if (socketRef.current !== socket) return;
        assistantReplyDoneRef.current?.();
      },
      onInterrupted: () => {
        if (socketRef.current !== socket) return;
        // Barge-in: stop and drop any queued assistant audio immediately so
        // it doesn't keep talking over the patient.
        playbackRef.current?.flush();
        assistantSegmentsRef.current = [];
      },
      onConversationStateUpdate: (state) => {
        if (socketRef.current !== socket) return;
        conversationStateRef.current = state;
      },
      onError: (_code, message) => {
        if (socketRef.current !== socket) return;
        isStartingRef.current = false;
        clearConnectTimeout();
        setErrorMessage(message || "I'm having trouble connecting right now.");
        updateStatus("error");
        // An error also means stop() should stop waiting, if it was.
        assistantReplyDoneRef.current?.();
      },
      onClosed: () => {
        if (socketRef.current !== socket) return;
        isStartingRef.current = false;
        clearConnectTimeout();
        captureRef.current?.stop();
        captureRef.current = null;
        updateStatus(statusRef.current === "stopping" || statusRef.current === "idle" ? statusRef.current : "error");
        // The backend closed the session (its own pendingStop safety
        // timeout, or otherwise) — stop() should stop waiting too.
        assistantReplyDoneRef.current?.();
      },
    });
  }, [clearConnectTimeout, updateStatus]);

  /** Shared finalize/wait logic for both stop() and getOPTicket() — the
   * only difference between them is which client message is sent first. */
  const waitForCloseAndFinalize = useCallback((): Promise<VoiceSessionResult> => {
    updateStatus("stopping");
    captureRef.current?.stop();
    clearConnectTimeout();

    return new Promise((resolve) => {
      let settled = false;
      const finalize = () => {
        if (settled) return;
        settled = true;
        isStartingRef.current = false;
        assistantReplyDoneRef.current = null;
        socketRef.current?.disconnect();
        socketRef.current = null;
        playbackRef.current?.stop();
        playbackRef.current = null;
        updateStatus("idle");
        resolve({
          rawTranscript: joinTranscriptSegments(segmentsRef.current),
          segmentCount: segmentsRef.current.length,
          conversationState: conversationStateRef.current,
        });
      };

      const safetyTimeout = window.setTimeout(finalize, ASSISTANT_REPLY_WAIT_TIMEOUT_MS);
      assistantReplyDoneRef.current = () => {
        window.clearTimeout(safetyTimeout);
        // Keep the original short flush window as a floor, in case this
        // fires unusually fast, so trailing transcript deltas still have a
        // moment to land before we read the final transcript.
        window.setTimeout(finalize, STOP_FLUSH_MS);
      };
    });
  }, [clearConnectTimeout, updateStatus]);

  const stop = useCallback((): Promise<VoiceSessionResult> => {
    socketRef.current?.stop();
    return waitForCloseAndFinalize();
  }, [waitForCloseAndFinalize]);

  /** Phase 5 — the patient pressed "Get OP Ticket" (only ever shown once
   * conversationState.readyForTicket is true). Same wait/finalize path as
   * stop(), but tells the backend explicitly so it can deterministically
   * generate a ticket if the conversation hadn't already produced one via
   * a Gemini tool call. */
  const getOPTicket = useCallback((): Promise<VoiceSessionResult> => {
    socketRef.current?.requestOPTicket();
    return waitForCloseAndFinalize();
  }, [waitForCloseAndFinalize]);

  const setMuted = useCallback((muted: boolean) => {
    console.log(`[useVoiceSession] setMuted(${muted})`);
    isMutedRef.current = muted;
    captureRef.current?.setMuted(muted);
    setIsMuted(muted);
  }, []);

  /** Touch fallback (CLAUDE.md §20) — tapping a department/doctor card
   * dispatches through the same backend logic voice selection uses; the
   * next conversation_state_update carries the real, backend-confirmed
   * result back into conversationStateRef. */
  const selectDepartment = useCallback((departmentId: string) => {
    socketRef.current?.selectDepartment(departmentId);
  }, []);

  const selectDoctor = useCallback((doctorId: string) => {
    socketRef.current?.selectDoctor(doctorId);
  }, []);

  const verifyPatient = useCallback((name: string, phone: string) => {
    socketRef.current?.verifyPatient(name, phone);
  }, []);

  const registerPatient = useCallback((name: string, phone: string, address?: string, idPhotoRef?: string) => {
    socketRef.current?.registerPatient(name, phone, address, idPhotoRef);
  }, []);

  const requestOTP = useCallback(async (phone: string): Promise<{ success: boolean; message?: string }> => {
    if (!socketRef.current) return { success: false, message: "Socket not connected" };
    return socketRef.current.requestOTP(phone);
  }, []);

  const verifyOTP = useCallback(async (phone: string, code: string): Promise<{ success: boolean; patient?: Patient; message?: string }> => {
    if (!socketRef.current) return { success: false, message: "Socket not connected" };
    return socketRef.current.verifyOTP(phone, code);
  }, []);

  const sendUIStateUpdate = useCallback((stateId: string, summary: string) => {
    if (lastSentUIStateIdRef.current === stateId) return;
    lastSentUIStateIdRef.current = stateId;
    socketRef.current?.sendUIStateUpdate(stateId, summary);
  }, []);

  const clearDepartmentSelection = useCallback(() => {
    conversationStateRef.current = {
      ...conversationStateRef.current,
      selectedDepartment: null,
      selectedDoctor: null,
      doctorsShown: [],
    };
  }, []);

  const reset = useCallback(() => {
    // Session reset (CLAUDE.md §23): every audio subsystem — capture AND
    // playback — must be torn down here, same as the transcript state.
    isStartingRef.current = false;
    clearConnectTimeout();
    captureRef.current?.stop();
    socketRef.current?.disconnect();
    playbackRef.current?.stop();
    captureRef.current = null;
    socketRef.current = null;
    playbackRef.current = null;
    segmentsRef.current = [];
    assistantSegmentsRef.current = [];
    assistantReplyDoneRef.current = null;
    lastSentUIStateIdRef.current = null;
    conversationStateRef.current = createInitialConversationState();
    transcriptListenersRef.current.forEach((cb) => {
      try { cb("", ""); } catch {}
    });
    setErrorMessage(null);
    isMutedRef.current = false;
    setIsMuted(false);
    updateStatus("idle");
  }, [clearConnectTimeout, updateStatus]);


  return {
    status,
    errorMessage,
    isMuted,
    start,
    stop,
    getOPTicket,
    isAssistantSpeaking,
    isSpeaking,
    setMuted,
    selectDepartment,
    selectDoctor,
    clearDepartmentSelection,
    verifyPatient,
    registerPatient,
    requestOTP,
    verifyOTP,
    sendUIStateUpdate,
    reset,
    getTranscript,
    getAssistantTranscript,
    getSegments,
    getAssistantSegments,
    getConversationState,
    getInputLevel,
    getOutputLevel,
    subscribeTranscript,
  };
}
