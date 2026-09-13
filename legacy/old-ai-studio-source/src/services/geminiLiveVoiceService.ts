export type LiveVoiceCallbacks = {
  onTranscription: (text: string) => void;
  onError: (error: string) => void;
  onClose: () => void;
};

export class GeminiLiveVoiceService {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isListening: boolean = false;
  private callbacks: LiveVoiceCallbacks;
  private resampleRemainder: number = 0;
  private lastInputSample: number = 0;

  constructor(callbacks: LiveVoiceCallbacks) {
    this.callbacks = callbacks;
  }

  static isSupported(): boolean {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && AudioContextClass);
  }

  private pcmToBase64(pcmData: Float32Array): string {
    const buffer = new ArrayBuffer(pcmData.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < pcmData.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, pcmData[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, s, true);
    }
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private resampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
    if (inputSampleRate === 16000 || !inputSampleRate || input.length === 0) {
      return input;
    }
    const ratio = inputSampleRate / 16000;
    let pos = this.resampleRemainder;
    const outputSamples: number[] = [];

    while (pos < input.length) {
      const index = Math.floor(pos);
      const fraction = pos - index;
      
      const sampleCurr = input[index];
      const sampleNext = (index + 1 < input.length) ? input[index + 1] : input[index];

      outputSamples.push(sampleCurr * (1 - fraction) + sampleNext * fraction);
      pos += ratio;
    }

    this.resampleRemainder = pos - input.length;
    this.lastInputSample = input[input.length - 1] || 0;

    return new Float32Array(outputSamples);
  }

  async start() {
    if (this.isListening) return;
    
    try {
      this.isListening = true;
      this.resampleRemainder = 0;
      this.lastInputSample = 0;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.stream = stream;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/live`;
      this.ws = new WebSocket(wsUrl);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 16000 });

      const actualSampleRate = this.audioCtx.sampleRate;
      console.log('[VOICE AUDIO]', {
        requestedSampleRate: 16000,
        actualSampleRate,
        outputSampleRate: 16000,
      });

      this.source = this.audioCtx.createMediaStreamSource(stream);
      this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

      this.source.connect(this.processor);
      this.processor.connect(this.audioCtx.destination);

      let logCounter = 0;
      this.processor.onaudioprocess = (e) => {
        if (!this.isListening || this.ws?.readyState !== WebSocket.OPEN) return;
        const rawInput = e.inputBuffer.getChannelData(0);
        const actualRate = this.audioCtx?.sampleRate || 16000;
        const resampled = this.resampleTo16k(rawInput, actualRate);

        logCounter++;
        if (logCounter % 20 === 1) {
          console.log('[VOICE AUDIO]', {
            requestedSampleRate: 16000,
            actualSampleRate: actualRate,
            outputSampleRate: 16000,
            inputSamples: rawInput.length,
            outputSamples: resampled.length,
          });
        }

        const base64 = this.pcmToBase64(resampled);
        this.ws.send(JSON.stringify({ audio: base64 }));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.error) {
            this.callbacks.onError(msg.error);
            this.stop();
            return;
          }

          if (msg.serverContent?.inputTranscription) {
            const text = msg.serverContent.inputTranscription.text;
            if (text) {
              console.log('[Gemini Live Input Transcription]', text);
              this.callbacks.onTranscription(text);
            }
          }
        } catch (e) {
          console.error('Error parsing live WS message', e);
        }
      };

      this.ws.onerror = () => {
        this.callbacks.onError('Voice service temporarily unavailable. You can type the request instead.');
        this.stop();
      };
      
      this.ws.onclose = () => {
        this.stop();
        this.callbacks.onClose();
      };

    } catch (err: any) {
      console.warn('Microphone access failed:', err);
      this.stop();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.callbacks.onError("Microphone access was denied. You can type the patient's request instead.");
      } else {
        this.callbacks.onError("Could not access microphone. Please check permissions or type the request instead.");
      }
    }
  }

  stop() {
    this.isListening = false;
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
