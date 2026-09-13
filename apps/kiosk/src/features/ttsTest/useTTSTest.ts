import { useCallback, useRef, useState } from "react";
import type { TTSProviderId } from "@arteq/shared";

const BACKEND_HTTP_URL = import.meta.env.VITE_BACKEND_HTTP_URL ?? "http://localhost:8787";

export type TTSTestStatus = "idle" | "requesting" | "playing" | "error";

export interface TTSTestLatency {
  /** Time from request start until the first response bytes arrived —
   * the real streaming-latency indicator (reflects the provider's actual
   * time-to-first-audio-chunk over the network, not full-download time). */
  timeToFirstByteMs: number;
  /** Time from request start until the full audio was downloaded and a
   * playable Blob was ready. NOTE: this dev harness plays back via a
   * buffered <audio> element, not true progressive/MediaSource streaming
   * playback — see TTSTestView.tsx docstring and the evaluation report's
   * "known limitations" for why, and what a true-streaming follow-up would
   * involve. */
  timeToPlayableMs: number;
}

/**
 * EXPERIMENTAL — drives the Fish S2 Pro TTS dev test harness. Calls the
 * backend's dev-only POST /api/tts/test (routes/tts.ts), which streams
 * audio straight from whichever provider is selected. Not part of the real
 * patient voice pipeline (see useTTSTest usage in TTSTestView.tsx).
 */
export function useTTSTest() {
  const [status, setStatus] = useState<TTSTestStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latency, setLatency] = useState<TTSTestLatency | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const play = useCallback(async (text: string, provider: TTSProviderId) => {
    setStatus("requesting");
    setErrorMessage(null);
    setLatency(null);

    // Clean up any previous playback's object URL before starting a new one.
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const startedAt = performance.now();
    try {
      const response = await fetch(`${BACKEND_HTTP_URL}/api/tts/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, provider }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `TTS test request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let timeToFirstByteMs: number | null = null;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (timeToFirstByteMs === null) {
          timeToFirstByteMs = performance.now() - startedAt;
        }
        if (value) chunks.push(value);
      }

      const contentType = response.headers.get("Content-Type") ?? "audio/mpeg";
      const blob = new Blob(chunks as BlobPart[], { type: contentType });
      const timeToPlayableMs = performance.now() - startedAt;
      setLatency({ timeToFirstByteMs: timeToFirstByteMs ?? timeToPlayableMs, timeToPlayableMs });

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      setStatus("playing");
      await audio.play();
      audio.onended = () => setStatus("idle");
    } catch (err) {
      console.error("[tts-test] play() failed:", err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  return { status, errorMessage, latency, play };
}
