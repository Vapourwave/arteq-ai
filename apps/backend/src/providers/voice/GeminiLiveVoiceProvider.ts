import { GoogleGenAI, Modality, EndSensitivity, VoiceActivityType, type LiveServerMessage, type Session } from "@google/genai";
import { createInitialConversationState } from "@arteq/shared";
import { env } from "../../config/env.js";
import { HOSPITAL_TOOL_DECLARATIONS, handleHospitalToolCall } from "../../services/conversation/geminiTools.js";
import { getHospitalMemory, getWelcomeGreeting } from "../../services/hospital/hospitalService.js";
import type { VoiceProvider, VoiceSession, VoiceSessionCallbacks } from "./VoiceProvider.js";

/**
 * Live voice capture + native audio output via Gemini Live (docs/04 §4,
 * Phase 5 AI receptionist product). Reference: legacy
 * `geminiLiveVoiceService.ts` + `server.ts` WebSocket relay — reused here is
 * the *shape* of the integration (server-owned connection); the
 * resampling/PCM work happens on the kiosk side (see
 * apps/kiosk/src/features/voice/audio), not here.
 */

// Verified directly against ai.models.list() for this project's API key —
// KEPT deliberately (native-audio investigation, 2026-08-30): real-mic
// testing showed this model's Malayalam/Manglish INPUT recognition is
// substantially better than gemini-2.5-flash-native-audio-latest.
export const LIVE_MODEL = "gemini-3.1-flash-live-preview";

// The ARTEQ receptionist voice. When `speechConfig` is omitted, Gemini Live
// picks a prebuilt voice automatically and the pick VARIES between sessions
// (sometimes male, sometimes female) — pinning it here makes the voice
// deterministic on every session, reconnect and reset.
//
// "Kore" is a documented Gemini prebuilt voice, classified female by Google's
// own voice pickers and third-party voice catalogues, described as "Firm"
// (calm, clear, composed — right for a hospital receptionist). It is one of
// the original prebuilt voices, so it is available on every Gemini Live
// model version including LIVE_MODEL above. Change this one constant to
// switch to another female voice (e.g. "Aoede" — breezy, or "Leda" —
// youthful); there is no other place a voice is selected.
export const RECEPTIONIST_VOICE_NAME = "Kore";

/**
 * Phase 5 — the real product system instruction. Replaces the earlier
 * deterministic test reply and the temporary open-ended-conversation test
 * prompt (both fully removed — CLAUDE.md §26/§39: no demo-only behavior
 * left in what's now the real product path).
 *
 * Encodes, deliberately:
 *  - Receptionist/navigation role, not a diagnostic clinician (CLAUDE.md
 *    §12/§13, spec §1/§13) — routes the patient, never interrogates them.
 *  - Real hospital data ONLY via tool calls (see geminiTools.ts) — the
 *    model is never told a department/doctor/queue fact directly in this
 *    prompt, so it structurally cannot answer from invented knowledge.
 *  - Multilingual behavior preserved from the earlier native-audio
 *    investigation's conversational prompt (respond in the patient's
 *    current language, never translate Malayalam/Manglish).
 *  - The turn-taking mitigation the manual-activity-detection investigation
 *    recommended: a PROMPT-layer strategy for fragment/pause tolerance,
 *    not a VAD-layer one — explicitly NOT a claim that premature-response
 *    is solved, only that this is the recommended next lever to pull.
 */
const RECEPTIONIST_SYSTEM_INSTRUCTION = `You are the AI receptionist at a hospital kiosk, speaking directly with a patient who just walked up. Your job is patient navigation, not medical diagnosis.

Greet the patient warmly when prompted, then listen to what the patient says and respond naturally to help them.

- LOCATION & SPOKEN LANGUAGES: The hospital is located in Kerala, India. Patients speak in Malayalam (മലയാളം), Manglish (Malayalam using English words or script), or English.
- INPUT AUDIO TRANSCRIPTION (inputAudioTranscription): You MUST transcribe what the patient says ONLY in Malayalam (മലയാളം script) or English. Never transcribe or interpret speech into unrelated foreign languages like Spanish, French, or Tamil. When the patient speaks Malayalam words, always transcribe them accurately in Malayalam script (or English for English words).
- Understand what the patient is saying by reading and referring to the ongoing context and text of the current chat. Even if the patient speaks briefly, uses regional dialects (Malayalam, Manglish, Tamil, Hindi, or accented English), or colloquial phrases, cross-reference their words with the recent chat history to ensure you understand their intent correctly.
- Understand their intent: wanting to see a doctor, naming a department or symptom, naming a specific doctor, asking about wait time or queue length, wanting an OP ticket, or finishing/stopping.
- Use the available tools to look up real departments, doctors, queues, and timings. Never guess, invent, or state a department/doctor/queue/timing fact yourself — only report what a tool call actually returned.
- Help the patient choose a department and a doctor, then offer to get their OP ticket once they confirm, and call generate_op_ticket when they do.

How to behave:
- Be concise — one or two short, natural sentences per turn. This is a real-time spoken voice conversation with a patient at a kiosk.
- Maintain strong conversational continuity: always refer to the previous messages in the current chat so you remember what department or doctor was just discussed (e.g. if they say "the first one", "shortest wait", or "yes", refer to the current chat context).
- STRICT DEPARTMENT CONTEXT PRESERVATION: Once a department is identified or selected (e.g., Dentistry / ദന്തവിഭാഗം), you MUST retain this department context across all subsequent turns until the conversation ends. When the patient asks for the "doctor with least waiting time", "shortest queue", or "available doctors", call find_shortest_queue_doctor or list_doctors specifically for that selected department (or omit department_id so the system defaults to the selected department). NEVER switch to another department unless the patient explicitly asks to switch or choose a different department.
- ORTHODONTICS VS ORTHOPEDICS: Note that Orthodontics (teeth alignment/braces / ദന്തചികിത്സ) belongs strictly to Dentistry (പല്ലിന്റെ വിഭാഗം), NOT Orthopedics (എല്ലുരോഗ വിഭാഗം / bones). When referring to Dr. Rahul Nair, always identify him clearly as being in the Dentistry department (e.g. "Dentistry specialist Dr. Rahul Nair" / "ദന്തവിഭാഗത്തിലെ ഡോക്ടർ രാഹുൽ നായർ").
- Ask only what's needed to route the patient. Do not run a medical interview. If they mention symptoms or problems (e.g. "I have tooth pain" / "പല്ലുവേദന", "headache" / "തലവേദന"), immediately map it via find_department.
- Never diagnose a condition, never suggest medication or treatment, and never state a medical fact you don't actually know. If asked something outside a receptionist's role, say you can't advise on that and offer to help them see a doctor who can.
- Respond in the same language the patient is using at that moment. If they speak Malayalam (e.g. "എനിക്ക് ഒരു ഡോക്ടറെ കാണണം"), respond naturally in Malayalam. If they speak English, respond in English. Preserve Malayalam, Manglish, and English as spoken — never translate unnecessarily.
- If what the patient said seems like an incomplete thought — a sentence that trails off, or a single bare fragment — ask a brief, natural clarifying question, or simply wait a moment.
- If the patient says something like "wait," "one second," or "hold on," do not respond with anything substantive — just a brief acknowledgement, and let them continue.
- Never ask about something you already know — if the patient already told you, use it, don't ask again.
- NEVER issue or claim to issue an OP ticket before patient identity is verified. If the patient asks for an OP ticket before verifying identity, politely explain that they must verify their identity on the kiosk screen first (as an existing patient with their phone number or as a new patient). Never call generate_op_ticket if the patient is unverified.
- Once a department and a doctor are both selected, and the patient has completed identity verification on screen and confirms they want to proceed, call generate_op_ticket and let them know their ticket is ready.
- You will receive compact context updates about what is currently visible on the kiosk screen marked with [CURRENT UI STATE: stateId]. Use this to understand what the patient sees and what options they can interact with (e.g. DEPARTMENT_SELECTION, DOCTOR_SELECTION, PATIENT_TYPE_SELECTION, EXISTING_PATIENT_OTP_VERIFICATION, TICKET_READY).
- When the conversation ends (the patient says they are done, says thank you, goodbye, that's all, nothing else, wants to stop, or says "മതി" / "ശരി മതി"): acknowledge politely with a single brief parting sentence (e.g. "You're welcome! Have a great day." or "ശരി, ശുഭദിനം നേരുന്നു.") AND call end_conversation immediately so the kiosk clears the conversation and returns to the home screen.`;

export function buildReceptionistSystemInstruction(): string {
  const memory = getHospitalMemory();
  const memoryPrompt = memory && memory.trim()
    ? `\n\nAdditional Hospital Information & Memory (managed by hospital administration):\n${memory.trim()}\n\nUse this additional hospital information whenever the patient asks questions about hospital facilities, locations, visiting hours, amenities, policies, or general inquiries.`
    : "";
  return `${RECEPTIONIST_SYSTEM_INSTRUCTION}${memoryPrompt}`;
}

/** Summarizes a hospital tool-call response for the operational log — real
 * hospital data (department/doctor names, ticket numbers) only, never the
 * patient's own words. */
function describeToolResponse(response: Record<string, unknown>): string {
  if ("found" in response) {
    if (response.found === false) return "not found";
    const department = response.department as { name?: string } | undefined;
    const doctor = response.doctor as { name?: string } | undefined;
    if (department) return `found department "${department.name}"`;
    if (doctor) return `found doctor "${doctor.name}"`;
    return "found";
  }
  if ("departments" in response) {
    const departments = response.departments as Array<{ name?: string }>;
    return `listed ${departments.length} department(s)`;
  }
  if ("doctors" in response) {
    const doctors = response.doctors as Array<{ name?: string }>;
    return `listed ${doctors.length} doctor(s)`;
  }
  if ("success" in response) {
    if (response.success === false) return `refused (${response.reason ?? "not ready"})`;
    const ticket = response.ticket as { ticketNumber?: string } | undefined;
    return `ticket generated ${ticket?.ticketNumber ?? ""}`.trim();
  }
  if ("acknowledged" in response) return "acknowledged";
  if ("hospital_info" in response) return "retrieved hospital memory/info";
  return "unknown response shape";
}

export class GeminiLiveVoiceProvider implements VoiceProvider {
  readonly name = "gemini-live";
  private client: GoogleGenAI | null = null;

  isConfigured(): boolean {
    return Boolean(env.geminiApiKey);
  }

  private getClient(): GoogleGenAI {
    if (!env.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: env.geminiApiKey });
    }
    return this.client;
  }

  async startSession(callbacks: VoiceSessionCallbacks): Promise<VoiceSession> {
    const ai = this.getClient();

    // Per-session authoritative navigation state (CLAUDE.md §5.2, §23
    // session isolation) — lives only for this one session's lifetime,
    // mutated only by real tool-call results, never by anything the model
    // merely says.
    let conversationState = createInitialConversationState();
    let isStopping = false;

    const session: Session = await ai.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        // Pin the assistant voice so it never varies between sessions — see
        // RECEPTIONIST_VOICE_NAME above. This `config` object is the single
        // point where every Live session (kiosk connect/reconnect/reset, and
        // any other backend-created session) is configured, so setting it
        // here covers all of them; there is no automatic-selection fallback
        // path once speechConfig is present.
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: RECEPTIONIST_VOICE_NAME },
          },
        },
        // REVERTED (Malayalam/Manglish regression investigation, Change A):
        // `inputAudioTranscription.languageCodes` is documented in the SDK
        // types but this backend (Gemini Developer API, non-Vertex)
        // rejected it at connect time — see the ASR script-confusion
        // investigation notes. Left unset, matching the working baseline.
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: buildReceptionistSystemInstruction(),
        // Phase 5 — real hospital data only ever reaches the model through
        // these tool calls (see geminiTools.ts docstring).
        tools: [{ functionDeclarations: HOSPITAL_TOOL_DECLARATIONS }],
        // Configure native Gemini Live server-side activity detection so speech
        // endings are recognized promptly in real kiosk mic conditions.
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            silenceDurationMs: 800,
          },
        },
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          if (message.voiceActivity) {
            console.log(`[ARTEQ-TRACE:5-GeminiEvents] voiceActivity: ${JSON.stringify(message.voiceActivity)}`);
          }

          const transcript = message.serverContent?.inputTranscription?.text;
          if (transcript) {
            console.log(`[ARTEQ-TRACE:5-GeminiEvents] inputTranscription: "${transcript}"`);
            callbacks.onTranscriptDelta(transcript);
          }

          // Forward all assistant audio chunks directly to client
          let audioChunkFound = false;
          for (const part of message.serverContent?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              audioChunkFound = true;
              callbacks.onAssistantAudioChunk(part.inlineData.data);
            }
          }
          if (!audioChunkFound && message.data) {
            callbacks.onAssistantAudioChunk(message.data);
          }

          const assistantText = message.serverContent?.outputTranscription?.text;
          if (assistantText) {
            console.log(`[GeminiLive] Assistant output text: "${assistantText}"`);
            callbacks.onAssistantTranscriptDelta(assistantText);
          }

          if (message.serverContent?.interrupted) {
            console.log(`[ARTEQ-TRACE:5-GeminiEvents] interrupted (native barge-in confirmed by Gemini server)`);
            callbacks.onInterrupted();
          }
          if (message.serverContent?.generationComplete) {
            console.log(`[ARTEQ-TRACE:5-GeminiEvents] generationComplete`);
          }
          if (message.serverContent?.turnComplete) {
            console.log(`[ARTEQ-TRACE:5-GeminiEvents] turnComplete`);
            callbacks.onTurnComplete();
            callbacks.onAssistantTurnComplete();
          }

          // Phase 5 — real Gemini Live function calling. Each call is
          // dispatched to our own deterministic backend logic
          // (handleHospitalToolCall); the model only ever learns real
          // department/doctor/ticket data from what we hand back here.
          const functionCalls = message.toolCall?.functionCalls;
          if (functionCalls && functionCalls.length > 0) {
            console.log(`[ARTEQ-TRACE:5-GeminiEvents] toolCall:`, JSON.stringify(message.toolCall));
            const functionResponses = functionCalls.map((call) => {
              const { response, newState } = handleHospitalToolCall(
                call.name ?? "",
                call.args ?? {},
                conversationState,
              );
              conversationState = newState;
              // Operational visibility (CLAUDE.md §25) — the model calling
              // (or NOT calling) these tools is exactly what determines
              // whether the conversation actually navigates the patient
              // anywhere, so this needs to be visible without dumping the
              // patient's own words: log the tool name and the real,
              // non-sensitive hospital-data outcome only (department/doctor
              // names, ticket numbers — not reason_text, which can carry
              // what the patient said).
              console.log(`[hospital-tool] ${call.name} -> ${describeToolResponse(response)}`);
              return { id: call.id, name: call.name, response };
            });
            callbacks.onConversationStateUpdate(conversationState);
            session.sendToolResponse({ functionResponses });
          }
        },
        onerror: (event) => {
          callbacks.onError(event?.message ?? "Gemini Live connection error");
        },
        onclose: (event?: any) => {
          const code = event?.code;
          const reason = event?.reason;
          if (!isStopping && code && code !== 1000 && code !== 1005) {
            console.error(`[voice] Gemini Live closed abnormally: code=${code} reason="${reason}"`);
            callbacks.onError(`Gemini Live closed (${code}): ${reason || "Connection closed by server"}`);
          }
          callbacks.onClose();
        },
      },
    });

    // Operational visibility (CLAUDE.md §25): every session must report the
    // pinned voice, so "the voice changed" can be caught from logs alone.
    console.log(
      `[voice] Gemini Live session started (model=${LIVE_MODEL}, voice=${RECEPTIONIST_VOICE_NAME})`,
    );

    let audioChunkIndex = 0;
    let greetingTriggered = false;

    function triggerGreeting(): void {
      if (greetingTriggered) return;
      greetingTriggered = true;
      const greetingText = getWelcomeGreeting();
      console.log(`[GeminiLive] Speaking initial welcome greeting: "${greetingText}"`);
      try {
        session.sendClientContent({
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: `The patient has just approached the kiosk. Greet them by saying aloud: "${greetingText}" Do not say anything else in this turn.`,
                },
              ],
            },
          ],
          turnComplete: true,
        });
      } catch (err) {
        console.warn("[GeminiLive] Failed to trigger greeting:", err);
      }
    }

    let lastSentUIState = "";

    function updateUIState(stateId: string, summary: string): void {
      if (!stateId || stateId === lastSentUIState) return;
      lastSentUIState = stateId;
      console.log(`[GeminiLive] UI state context: ${stateId} -> "${summary}"`);
    }

    return {
      sendAudioChunk(base64Pcm16: string) {
        audioChunkIndex++;
        if (audioChunkIndex === 1 || audioChunkIndex % 25 === 0) {
          console.log(`[ARTEQ-TRACE:4-GeminiProvider] sendRealtimeInput chunk #${audioChunkIndex} (${base64Pcm16.length} b64 chars, mime=audio/pcm;rate=16000)`);
        }
        try {
          session.sendRealtimeInput({
            audio: { data: base64Pcm16, mimeType: "audio/pcm;rate=16000" },
          });
        } catch (err) {
          console.warn("[ARTEQ-TRACE:4-GeminiProvider] sendRealtimeInput error:", err);
        }
      },
      stop() {
        isStopping = true;
        try {
          session.close();
        } catch (e) {
          console.warn("[GeminiLive] session.close() error:", e);
        }
      },
      triggerGreeting,
      updateUIState,
    };
  }
}
