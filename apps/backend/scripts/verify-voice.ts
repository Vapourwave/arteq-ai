/**
 * Voice-consistency verification (run: `npm run verify:voice --workspace apps/backend`).
 *
 * Opens N *fresh* Gemini Live sessions with the exact speechConfig the
 * receptionist uses (imported from GeminiLiveVoiceProvider — single source of
 * truth), asks each one to speak a short fixed line, and:
 *   - writes each session's audio to a .wav you can listen to
 *   - estimates the fundamental frequency (F0 / pitch) of each so the result
 *     is an objective "same voice", not "sounds similar" — female speech F0
 *     is typically ~165–255 Hz, adult male ~85–155 Hz.
 *
 * This exercises the real SDK + real config + real Gemini across many
 * sessions, which is what "don't stop at configured" asks for.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { ASSISTANT_AUDIO_CONTRACT } from "@arteq/shared";
import { env } from "../src/config/env.js";
import { LIVE_MODEL, RECEPTIONIST_VOICE_NAME } from "../src/providers/voice/GeminiLiveVoiceProvider.js";

const SESSIONS = Number(process.env.SESSIONS ?? 5);
const PROMPT =
  "Please say exactly: Hello, welcome to the hospital. How can I help you today?";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "scratch", "voice-verify");
const SAMPLE_RATE = ASSISTANT_AUDIO_CONTRACT.sampleRateHz; // 24000

if (!env.geminiApiKey) {
  console.error("GEMINI_API_KEY is not set (apps/backend/.env) — cannot verify.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });

function pcm16ToFloat(buf: Buffer): Float32Array {
  const out = new Float32Array(Math.floor(buf.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
  return out;
}

/** Autocorrelation F0 of one 40ms frame, searching 70–350 Hz, with an
 * octave-error guard (prefer the lowest lag whose correlation is within 15%
 * of the peak — kills the "picked the 2nd harmonic" mistake). */
function frameF0(seg: Float32Array): number | null {
  let energy = 0;
  for (let i = 0; i < seg.length; i++) energy += seg[i] * seg[i];
  if (energy < 1e-4) return null; // silence
  const minLag = Math.floor(SAMPLE_RATE / 350);
  const maxLag = Math.floor(SAMPLE_RATE / 70);
  const corr: number[] = [];
  let peak = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i + lag < seg.length; i++) c += seg[i] * seg[i + lag];
    corr[lag] = c;
    if (c > peak) peak = c;
  }
  if (peak <= 0) return null;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (corr[lag] >= 0.85 * peak) return SAMPLE_RATE / lag;
  }
  return null;
}

/** Median voiced-frame F0 over the whole clip. */
function estimateF0Hz(samples: Float32Array): number | null {
  const frame = Math.floor(SAMPLE_RATE * 0.04);
  const hop = frame >> 1;
  const values: number[] = [];
  for (let start = 0; start + frame <= samples.length; start += hop) {
    const f = frameF0(samples.subarray(start, start + frame));
    if (f && f >= 70 && f <= 350) values.push(f);
  }
  if (values.length < 5) return null;
  values.sort((a, b) => a - b);
  return Math.round(values[values.length >> 1]);
}

function toWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

interface SessionResult {
  index: number;
  chunks: number;
  audioMs: number;
  transcript: string;
  f0: number | null;
  wavPath: string;
}

async function runSession(index: number): Promise<SessionResult> {
  const audio: Buffer[] = [];
  let transcript = "";

  const done = new Promise<void>((resolve, reject) => {
    const failTimer = setTimeout(
      () => reject(new Error(`session ${index}: timed out with no turnComplete`)),
      30_000,
    );

    ai.live
      .connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          // EXACT same shape the receptionist provider sends.
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: RECEPTIONIST_VOICE_NAME },
            },
          },
        },
        callbacks: {
          onopen: () => {},
          onmessage: (m: LiveServerMessage) => {
            if (m.data) audio.push(Buffer.from(m.data, "base64"));
            const t = m.serverContent?.outputTranscription?.text;
            if (t) transcript += t;
            if (m.serverContent?.turnComplete) {
              clearTimeout(failTimer);
              resolve();
            }
          },
          onerror: (e) => {
            clearTimeout(failTimer);
            reject(new Error(`session ${index}: ${e?.message ?? "connection error"}`));
          },
          onclose: () => {},
        },
      })
      .then((session: Session) => {
        session.sendClientContent({ turns: PROMPT, turnComplete: true });
        // close once the turn is done (or the timeout rejected)
        void done.finally(() => session.close());
      })
      .catch((e) => {
        clearTimeout(failTimer);
        reject(e as Error);
      });
  });

  await done;

  const pcm = Buffer.concat(audio);
  const wavPath = join(OUT_DIR, `voice-session-${index}.wav`);
  writeFileSync(wavPath, toWav(pcm, SAMPLE_RATE));
  return {
    index,
    chunks: audio.length,
    audioMs: Math.round((pcm.length / 2 / SAMPLE_RATE) * 1000),
    transcript: transcript.trim(),
    f0: estimateF0Hz(pcm16ToFloat(pcm)),
    wavPath,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(
    `Verifying voice consistency: ${SESSIONS} fresh sessions, model=${LIVE_MODEL}, voice=${RECEPTIONIST_VOICE_NAME}\n`,
  );
  const results = [];
  for (let i = 1; i <= SESSIONS; i++) {
    process.stdout.write(`  session ${i} … `);
    try {
      const r = await runSession(i);
      results.push(r);
      console.log(
        `ok  chunks=${r.chunks} audio=${r.audioMs}ms F0≈${r.f0 ?? "?"}Hz  "${r.transcript}"`,
      );
    } catch (e) {
      console.log(`FAILED — ${(e as Error).message}`);
    }
  }

  const f0s = results.map((r) => r.f0).filter((v): v is number => v != null);
  console.log(`\n${results.length}/${SESSIONS} sessions produced audio.`);
  if (f0s.length) {
    const min = Math.min(...f0s);
    const max = Math.max(...f0s);
    const mean = Math.round(f0s.reduce((a, b) => a + b, 0) / f0s.length);
    console.log(`F0 estimates: ${f0s.join(", ")} Hz  (mean ${mean}, spread ${max - min})`);
    console.log(
      `Range check: ${min >= 155 ? "all in the typical female range (≥155 Hz)" : "some below 155 Hz — inspect the wavs"}`,
    );
  }
  console.log(`WAV files: ${OUT_DIR}`);
}

void main();
