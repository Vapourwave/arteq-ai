import { useState, useEffect, useRef, useCallback } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

export type AttentionState = "no_face" | "face_present" | "attentive" | "attention_lost";

const DETECTION_INTERVAL_MS = 150;
const DEBOUNCE_MS_FACE = 600; // time face must be present before checking attention
const DEBOUNCE_MS_ATTENTIVE = 300; // time face must be looking forward to become attentive
const DEBOUNCE_MS_ATTENTION_LOST = 800; // grace period before declaring attention_lost

export function useAttentionController() {
  const [attentionState, setAttentionState] = useState<AttentionState>("no_face");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const intervalRef = useRef<number | null>(null);

  const stateRef = useRef<AttentionState>("no_face");
  
  // Timestamps for debouncing logic
  const lastFaceDetectedAt = useRef<number>(0);
  const lastAttentiveAt = useRef<number>(0);
  const lastInattentiveAt = useRef<number>(0);

  const setState = (newState: AttentionState) => {
    if (stateRef.current !== newState) {
      console.log(`[ARTEQ-TRACE:AttentionController] State changed: ${stateRef.current} -> ${newState}`);
      stateRef.current = newState;
      setAttentionState(newState);
    }
  };

  const initCameraAndModel = useCallback(async () => {
    try {
      // 1. Initialize Camera first so the permission prompt appears immediately
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" } });
      streamRef.current = stream;
      
      const video = document.createElement("video");
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      videoRef.current = video;
      setIsCameraActive(true);

      // 2. Initialize MediaPipe
      const wasmFileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm" // Use latest to avoid mismatch
      );
      
      landmarkerRef.current = await FaceLandmarker.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        outputFaceBlendshapes: false,
        runningMode: "VIDEO",
        numFaces: 4
      });

      startDetectionLoop();
    } catch (err) {
      console.warn("[AttentionController] Initialization failed:", err);
      setError("Camera or FaceLandmarker failed to load.");
      setIsCameraActive(false);
    }
  }, []);

  const startDetectionLoop = useCallback(() => {
    if (intervalRef.current !== null) return;

    intervalRef.current = window.setInterval(() => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || video.readyState < 2) return;

      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);

      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        lastFaceDetectedAt.current = now;

        // MULTIPLE FACES: Conservative fallback. Do not automatically greet.
        if (result.faceLandmarks.length > 1) {
          if (stateRef.current !== "face_present") {
            // Force face_present. This prevents auto-greeting (requires 'attentive')
            // and avoids false-positive attention transitions.
            setState("face_present");
          }
          return;
        }
        
        // Compute approximate head yaw using nose and cheek/edge landmarks
        const landmarks = result.faceLandmarks[0];
        const noseTip = landmarks[1];
        const leftEdge = landmarks[234];
        const rightEdge = landmarks[454];

        const distLeft = Math.abs(noseTip.x - leftEdge.x);
        const distRight = Math.abs(noseTip.x - rightEdge.x);
        const yawRatio = distLeft / (distLeft + distRight);

        // A ratio ~0.5 means facing forward. 0.28 to 0.72 accounts for natural head tilt/angles.
        // Extreme values (< 0.25 or > 0.75) indicate the patient has turned their head away.
        const isLookingForward = yawRatio > 0.28 && yawRatio < 0.72;

        if (isLookingForward) {
          lastAttentiveAt.current = now;
          if (stateRef.current === "no_face") {
             // Just spotted a face, wait a bit
             setState("face_present");
          } else if (stateRef.current === "face_present" || stateRef.current === "attention_lost") {
             if (now - lastInattentiveAt.current > DEBOUNCE_MS_ATTENTIVE) {
               setState("attentive");
             }
          }
        } else {
          lastInattentiveAt.current = now;
          if (stateRef.current === "no_face") {
            setState("face_present");
          } else if (stateRef.current === "attentive") {
            // Grace period: require looking away continuously for 800ms before declaring attention_lost.
            // A momentary glance or single frame jitter while talking must never cut off microphone input.
            if (now - lastAttentiveAt.current > DEBOUNCE_MS_ATTENTION_LOST) {
              setState("attention_lost");
            }
          }
        }
      } else {
        // No faces detected in this frame
        if (stateRef.current !== "no_face") {
           // Small debounce before declaring no_face (e.g. blinking or momentary dropout)
           if (now - lastFaceDetectedAt.current > 1500) {
             setState("no_face");
           }
        }
      }

    }, DETECTION_INTERVAL_MS);
  }, []);

  useEffect(() => {
    initCameraAndModel();
    
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
    };
  }, [initCameraAndModel]);

  return {
    attentionState,
    isCameraActive,
    error,
    // Provide a way to manually reset state if needed
    resetState: () => {
      lastFaceDetectedAt.current = 0;
      lastAttentiveAt.current = 0;
      setState("no_face");
    }
  };
}
