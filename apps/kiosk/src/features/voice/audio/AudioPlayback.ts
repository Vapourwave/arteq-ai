import { ASSISTANT_AUDIO_CONTRACT } from "@arteq/shared";

let globalPlaybackContext: AudioContext | null = null;

export class AudioPlayback {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private scheduledSources: AudioBufferSourceNode[] = [];
  public onPlaybackEnd: (() => void) | null = null;
  public onPlaybackStateChange: ((isPlaying: boolean) => void) | null = null;
  private outputLevel = 0;
  private leftoverByte: number | null = null;

  getOutputLevel(): number {
    return this.outputLevel;
  }

  isPlaying(): boolean {
    return this.scheduledSources.length > 0;
  }

  private ensureContext(): AudioContext {
    if (!globalPlaybackContext || globalPlaybackContext.state === "closed") {
      const AudioContextCtor = window.AudioContext ?? (window as any).webkitAudioContext;
      globalPlaybackContext = new AudioContextCtor();
    }
    this.context = globalPlaybackContext;
    return this.context;
  }

  initialize(): void {
    const context = this.ensureContext();
    if (context.state === "suspended") {
      void context.resume().catch((e) => console.warn("[AudioPlayback] initialize resume failed:", e));
    }
  }

  enqueueChunk(base64Pcm: string, onEnded?: (() => void) | null): void {
    const context = this.ensureContext();
    if (context.state === "suspended") {
      void context.resume().catch((e) => console.warn("Lazy resume failed:", e));
    }
    
    const bytes = base64ToUint8(base64Pcm);
    const float32 = this.pcm16ToFloat32(bytes);
    
    if (float32.length === 0) return;

    const isNewStream = this.scheduledSources.length === 0 || this.nextStartTime <= context.currentTime;

    // Apply 2ms micro-smoothing (half-cosine ramp) to the onset of a new speech burst/turn.
    // This transitions smoothly from 0.0V silence to the signal amplitude, eliminating the
    // instantaneous DAC step discontinuity and speaker-cone impulse that produced the beep/click/pop.
    if (isNewStream) {
      const rampLen = Math.min(48, float32.length); // 48 samples = 2ms at 24kHz
      for (let i = 0; i < rampLen; i++) {
        const ramp = 0.5 * (1 - Math.cos((Math.PI * i) / rampLen));
        float32[i] *= ramp;
      }
    }

    let sumSquares = 0;
    for (let i = 0; i < float32.length; i++) sumSquares += float32[i] * float32[i];
    this.outputLevel = Math.sqrt(sumSquares / float32.length);

    const buffer = context.createBuffer(1, float32.length, ASSISTANT_AUDIO_CONTRACT.sampleRateHz);
    buffer.copyToChannel(float32 as Float32Array<ArrayBuffer>, 0);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    // On a new response turn, provide a 10ms lookahead so Web Audio's real-time rendering
    // thread begins playback cleanly at frame 0 rather than dropping frames mid-quantum.
    // Subsequent chunks within the turn stream seamlessly at nextStartTime with zero gap.
    const startAt = isNewStream ? context.currentTime + 0.01 : this.nextStartTime;
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.scheduledSources.push(source);
    
    if (this.scheduledSources.length === 1 && this.onPlaybackStateChange) {
      this.onPlaybackStateChange(true);
    }

    source.onended = () => {
      this.scheduledSources = this.scheduledSources.filter((s) => s !== source);
      if (this.scheduledSources.length === 0) {
        if (this.onPlaybackEnd) this.onPlaybackEnd();
        if (this.onPlaybackStateChange) this.onPlaybackStateChange(false);
      }
      onEnded?.();
    };
  }

  flush(): void {
    const wasPlaying = this.scheduledSources.length > 0;
    for (const source of this.scheduledSources) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // Already stopped/ended
      }
    }
    this.scheduledSources = [];
    this.outputLevel = 0;
    this.leftoverByte = null;
    if (this.context) {
      this.nextStartTime = this.context.currentTime;
    }
    if (wasPlaying) {
      this.onPlaybackEnd?.();
    }
    this.onPlaybackStateChange?.(false);
  }

  stop(): void {
    this.flush();
    this.context = null;
  }

  private pcm16ToFloat32(bytes: Uint8Array): Float32Array {
    let fullBytes = bytes;
    if (this.leftoverByte !== null) {
      fullBytes = new Uint8Array(bytes.length + 1);
      fullBytes[0] = this.leftoverByte;
      fullBytes.set(bytes, 1);
      this.leftoverByte = null;
    }
    
    const isOdd = fullBytes.length % 2 !== 0;
    const safeLength = isOdd ? fullBytes.length - 1 : fullBytes.length;
    
    if (isOdd) {
      this.leftoverByte = fullBytes[fullBytes.length - 1];
    }

    const sampleCount = safeLength / 2;
    const out = new Float32Array(sampleCount);
    const view = new DataView(fullBytes.buffer, fullBytes.byteOffset, safeLength);
    
    for (let i = 0; i < sampleCount; i++) {
      out[i] = view.getInt16(i * 2, true) / 32768;
    }
    return out;
  }
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
