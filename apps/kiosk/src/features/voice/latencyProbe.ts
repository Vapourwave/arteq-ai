/**
 * ARTEQ — Development-Only Latency Probe
 *
 * Instruments the voice pipeline with sub-millisecond timestamps to identify
 * where latency is actually occurring. All methods are DEVELOPMENT-ONLY and
 * should be stripped (or gated behind import.meta.env.DEV) before production.
 *
 * DO NOT modify audio formats, VAD, Gemini model, or production behavior.
 * This file is measurement infrastructure only.
 */

export interface LatencySnapshot {
  utteranceId: number;
  label: string;
}

export function probeT0_captureChunk(): void {}
export function probeT1_socketSend(): void {}
export function probeT2_assistantChunkReceived(): void {}
export function probeT3_playbackScheduled(): void {}
export function probeResetUtterance(): void {}
export function printLatencySummary(): void {}

export interface ConnectionLatencySnapshot {}

export function probeConnectionT_Attention(): void {}
export function probeConnectionT_ConnectStart(): void {}
export function probeConnectionT_WSOpen(): void {}
export function probeConnectionT_GeminiReady(): void {}
export function probeConnectionT_GreetingRequest(): void {}
export function probeConnectionT_FirstGreetingAudio(): void {}
export function probeConnectionT_GreetingPlayback(): void {}

