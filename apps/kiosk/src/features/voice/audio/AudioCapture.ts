import { PcmResampler, float32ToPcm16, pcm16ToBase64 } from "./PcmResampler";

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 2048;

export type AudioCaptureErrorReason = "permission_denied" | "unsupported" | "unknown";

export interface AudioCaptureCallbacks {
  onChunk(base64Pcm16: string): void;
  onError(reason: AudioCaptureErrorReason, error: unknown): void;
}

/**
 * Direct, naked microphone capture.
 * Captures microphone audio, converts Float32 to 16-bit 16kHz mono PCM,
 * and passes base64 chunks immediately to caller.
 */
export class AudioCapture {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private silentSink: GainNode | null = null;
  private resampler: PcmResampler | null = null;
  private muted = false;
  private inputLevel = 0;
  private isRunning = false;

  get runtimeSampleRate(): number | null {
    return this.audioContext?.sampleRate ?? null;
  }

  setMuted(muted: boolean): void {
    if (this.muted !== muted) {
      console.log(`[ARTEQ-TRACE:1-AudioCapture] setMuted: ${this.muted} -> ${muted} (mic is now ${muted ? "MUTED" : "ACTIVE"})`);
      this.muted = muted;
    }
  }

  getInputLevel(): number {
    return this.inputLevel;
  }

  async start(callbacks: AudioCaptureCallbacks): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    if (!navigator.mediaDevices?.getUserMedia) {
      this.isRunning = false;
      callbacks.onError("unsupported", new Error("getUserMedia is not available"));
      return;
    }

    let stream: MediaStream;
    try {
      // Use standard kiosk capture constraints: echoCancellation active to prevent
      // speaker loopback, autoGainControl active to normalize mic levels, and
      // noiseSuppression active to eliminate computer fan buzz and 50/60Hz electrical interference.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      this.isRunning = false;
      console.error("[ARTEQ-TRACE:1-AudioCapture] Mic permission DENIED or failed:", err);
      callbacks.onError("permission_denied", err);
      return;
    }

    if (!this.isRunning) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;

    const audioTracks = this.stream.getAudioTracks();
    console.log("[ARTEQ-TRACE:1-AudioCapture] Mic permission GRANTED. Active tracks:", audioTracks.map((t) => ({
      label: t.label,
      enabled: t.enabled,
      readyState: t.readyState,
      muted: t.muted,
    })));

    // Fresh AudioContext per capture session at native hardware rate (docs/04 §6, §7).
    // Never force sampleRate: 16000 here — Chrome's internal downsampler on MediaStreamAudioSourceNode
    // causes severe attenuation and distortion on Windows. Let AudioContext run at native hardware rate
    // (e.g. 48kHz / 44.1kHz) and use PcmResampler to cleanly downsample Float32 audio to 16kHz PCM.
    const AudioContextCtor = window.AudioContext ?? (window as any).webkitAudioContext;
    this.audioContext = new AudioContextCtor();
    if (this.audioContext.state === "suspended") {
      void this.audioContext.resume().catch(() => {});
    }

    const actualRate = this.audioContext.sampleRate;
    this.resampler = actualRate === TARGET_SAMPLE_RATE ? null : new PcmResampler(actualRate, TARGET_SAMPLE_RATE);

    console.log("[ARTEQ-TRACE:1-AudioCapture] AudioContext running:", {
      state: this.audioContext.state,
      hardwareSampleRate: actualRate,
      targetSampleRate: TARGET_SAMPLE_RATE,
      bufferSize: BUFFER_SIZE,
      hasResampler: Boolean(this.resampler),
      trackLabel: audioTracks[0]?.label,
    });

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 2.0; // 2.0x clean digital boost with noiseSuppression active
    this.processor = this.audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let chunkCount = 0;
    let mutedDropCount = 0;
    this.processor.onaudioprocess = (event) => {
      if (!this.isRunning) return;
      if (this.muted) {
        this.inputLevel = 0;
        mutedDropCount++;
        if (mutedDropCount === 1 || mutedDropCount % 50 === 0) {
          console.log(`[ARTEQ-TRACE:1-AudioCapture] Mic is MUTED (attention) - dropping incoming audio chunks (#${mutedDropCount})`);
        }
        return;
      }
      mutedDropCount = 0;
      const input = event.inputBuffer.getChannelData(0);

      // Compute RMS amplitude & max sample for VoiceOrb and diagnostic verification
      let sumSquares = 0;
      let maxAmp = 0;
      let nonZeroCount = 0;
      for (let i = 0; i < input.length; i++) {
        const val = input[i];
        const abs = Math.abs(val);
        sumSquares += val * val;
        if (abs > maxAmp) maxAmp = abs;
        if (abs > 0.0001) nonZeroCount++;
      }
      this.inputLevel = Math.sqrt(sumSquares / input.length);

      const samples = this.resampler ? this.resampler.process(input) : input;
      if (samples.length === 0) return;

      chunkCount++;
      if (chunkCount === 1 || chunkCount % 25 === 0 || this.inputLevel > 0.015) {
        console.log(`[ARTEQ-TRACE:1-AudioCapture] chunk #${chunkCount} (rms=${this.inputLevel.toFixed(4)}, maxAmp=${maxAmp.toFixed(4)}, nonZero=${nonZeroCount}/${input.length}, resampled=${samples.length})`);
      }

      const pcm16 = float32ToPcm16(samples);
      const b64 = pcm16ToBase64(pcm16);
      callbacks.onChunk(b64);
    };

    this.source.connect(this.gainNode);
    this.gainNode.connect(this.processor);
    this.silentSink = this.audioContext.createGain();
    this.silentSink.gain.value = 0;
    this.processor.connect(this.silentSink);
    this.silentSink.connect(this.audioContext.destination);
  }

  stop(): void {
    this.isRunning = false;
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.silentSink) {
      this.silentSink.disconnect();
      this.silentSink = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.resampler = null;
    this.muted = false;
    this.inputLevel = 0;
  }
}
