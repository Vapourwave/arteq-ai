import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../../config/env.js";
import type {
  QualityOutcome,
  RefineOutcome,
  TranscriptRefinementProvider,
} from "./TranscriptRefinementProvider.js";

/**
 * Verified directly against ai.models.list() for this project's API key
 * (same diligence as the Gemini Live model fix — see the audio/
 * transcription boundary investigation). "gemini-3.6-flash" is also the
 * exact model the legacy refinement/quality-guard implementation used
 * successfully in production use, which is why it's preferred here over
 * a newer-but-unproven candidate (e.g. gemini-3.7-flash is also available
 * and could be swapped in later — this is one constant, not scattered
 * throughout the codebase, per CLAUDE.md §10).
 */
const REFINEMENT_MODEL = "gemini-3.6-flash";

/**
 * Adapted from the legacy transcript-refinement prompt (server.ts), which
 * the Phase 4 architecture assessment identified as directly portable —
 * trimmed per that assessment (E): dropped the Tamil/Hindi mention since
 * it's outside ARTEQ's documented language scope (Malayalam/Manglish/
 * English — docs/04 §14) while keeping general multilingual tolerance.
 *
 * Change B (Malayalam/Manglish regression investigation): rewritten to be
 * explicitly, strictly conservative about language. Real-mic testing showed
 * Gemini Live's raw ASR can itself hallucinate Hindi/Tamil/Spanish content
 * under acoustic uncertainty (see Change A) — this rewrite's job is to make
 * sure refinement never COMPOUNDS that by confidently translating or
 * "correcting" unfamiliar Malayalam/Manglish into a different language, and
 * to keep the artifact-removal rule scoped to topical irrelevance (what was
 * actually needed to clean the captured contamination) rather than to
 * unfamiliarity of language/script — the two are different judgments and
 * only the former is safe to act on. Deliberately does NOT encode "script X
 * = invalid": ARTEQ may support more languages later, and this component
 * must never reject a patient for speaking a language it doesn't recognize.
 */
const REFINEMENT_SYSTEM_INSTRUCTION = `You are a multilingual speech-transcript cleanup component for a hospital kiosk receptionist application.

Your only task is to clean a noisy speech transcript while preserving its exact meaning. Be STRICTLY CONSERVATIVE: when in doubt, preserve the original text rather than guessing.

The transcript may contain Malayalam, Manglish (Malayalam spoken/typed in Latin characters), English, and code-switching between these, along with repetitions, false starts, and speech-recognition errors. The raw transcript may also be a concatenation of several separate speech-recognition segments recorded around a pause, joined with spaces — the seams between segments can contain recognition artifacts or fragments unrelated to the surrounding request.

Rules:
1. Preserve meaning exactly.
2. Never translate or reinterpret Malayalam or Manglish into Hindi, Tamil, or any other language merely because the text looks unfamiliar or you are uncertain how to interpret it — preserve the original language's content as given.
3. Never invent words, phrases, or details to make an uncertain or ambiguous transcript sound more fluent, complete, or medically plausible.
4. Treat Latin-script Malayalam (Manglish) as legitimate input, not as a transcription error to "correct" into another language.
5. Preserve genuine Malayalam-script text exactly.
6. Preserve legitimate English/Malayalam code-switching — do not force mixed-language speech into a single language.
7. Resolve explicit self-corrections in favor of the final corrected statement.
8. Only correct obvious transcription, spelling, or punctuation artifacts, and only when the intended meaning is reasonably clear from context. Do not "correct" ambiguous or unfamiliar text into a confident guess.
9. Remove obvious speech-recognition artifacts ONLY when they are clearly unrelated in topic to a hospital kiosk request (for example, a fragment with no plausible connection to the surrounding request). Do not remove content merely because it is in an unfamiliar language or script — that is a different judgment, and removal is for clearly disconnected noise, not for content you are simply unsure how to interpret.
10. If the raw transcript is ambiguous or appears corrupted, prefer preserving the raw content over confidently rewriting it into something fluent-sounding.
11. Preserve names, numbers, dates, duration, location, laterality, severity, uncertainty, and other stated details.
12. Never diagnose.
13. Never infer a medical condition.
14. Never add information.
15. Never remove medically relevant information.
16. Never convert uncertainty into certainty.
17. Do not turn a patient's description into a diagnosis.
18. Keep the output concise and faithful to the original speech.
19. If the same word or short phrase appears immediately duplicated at a segment seam (e.g. from two recognition segments joined together), collapse it to a single occurrence — this is a transcription artifact, not repeated speech.

You are a linguistic cleanup component, not a medical reasoning system. ARTEQ may support additional languages in the future — never reject, flag, or discard content merely because it is not Malayalam.`;

/**
 * Adapted from the legacy quality-guard prompt — reused near-verbatim per
 * the Phase 4 assessment (D), since it already matches docs/02 §11 /
 * docs/04 §12's CLEAR/REVIEW/INSUFFICIENT triad.
 */
const QUALITY_SYSTEM_INSTRUCTION = `You are a transcript quality assessment component for a hospital kiosk receptionist application.

Evaluate whether a cleaned speech transcript is sufficiently reliable to show to the patient and use for the next step of the conversation.

You are NOT a medical reasoning system.

Do not diagnose.
Do not interpret symptoms.
Do not recommend treatment.
Do not reconstruct missing speech.
Do not invent words.
Do not choose a department.
Do not choose a doctor.

Compare the raw transcript and the cleaned transcript.

Flag the transcript if:
- obvious speech-recognition artifacts are present,
- important information appears to have been lost,
- unresolved contradictions remain,
- self-corrections remain unresolved,
- the transcript is incomplete,
- or the text is severely corrupted.

Do not flag normal Malayalam, Manglish, English, or legitimate multilingual code-switching.

When uncertain, prefer REVIEW rather than inventing a correction.

Return only the requested structured output.`;

export class GeminiTranscriptRefinementProvider implements TranscriptRefinementProvider {
  readonly name = "gemini-transcript-refinement";
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

  async refine(rawTranscript: string): Promise<RefineOutcome> {
    const ai = this.getClient();

    const response = await ai.models.generateContent({
      model: REFINEMENT_MODEL,
      contents: `Refine the following raw voice transcript from a hospital kiosk.\n\nRAW TRANSCRIPT:\n"${rawTranscript}"`,
      config: {
        systemInstruction: REFINEMENT_SYSTEM_INSTRUCTION,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cleanTranscript: {
              type: Type.STRING,
              description: "The linguistically refined transcript.",
            },
          },
          required: ["cleanTranscript"],
        },
      },
    });

    const parsed = parseJsonResponse(response.text, "refine");
    if (typeof parsed.cleanTranscript !== "string") {
      throw new Error("Refinement response missing cleanTranscript");
    }
    return { cleanTranscript: parsed.cleanTranscript };
  }

  async assessQuality(rawTranscript: string, cleanTranscript: string): Promise<QualityOutcome> {
    const ai = this.getClient();

    const promptText = `RAW TRANSCRIPT:\n"${rawTranscript}"\n\nREFINED TRANSCRIPT:\n"${cleanTranscript}"\n\nTASK:\n1. Evaluate the refined transcript's reliability based on the rules provided.\n2. Return a structured JSON response.`;

    const response = await ai.models.generateContent({
      model: REFINEMENT_MODEL,
      contents: promptText,
      config: {
        systemInstruction: QUALITY_SYSTEM_INSTRUCTION,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            qualityStatus: {
              type: Type.STRING,
              description: '"CLEAR", "REVIEW", or "INSUFFICIENT"',
            },
            qualityScore: {
              type: Type.NUMBER,
              description: "A quality score between 0.0 and 1.0",
            },
            issues: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of specific issues found, if any",
            },
            reviewReason: {
              type: Type.STRING,
              description:
                "A concise, patient-safe explanation if review is required, otherwise null.",
              nullable: true,
            },
          },
          required: ["qualityStatus", "qualityScore", "issues"],
        },
      },
    });

    const parsed = parseJsonResponse(response.text, "assessQuality");
    const status = parsed.qualityStatus;
    if (status !== "CLEAR" && status !== "REVIEW" && status !== "INSUFFICIENT") {
      throw new Error(`Quality guard returned unrecognized status: ${String(status)}`);
    }
    return {
      status,
      score: typeof parsed.qualityScore === "number" ? parsed.qualityScore : 0,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      reviewReason: typeof parsed.reviewReason === "string" ? parsed.reviewReason : null,
    };
  }
}

function parseJsonResponse(text: string | undefined, stage: string): Record<string, unknown> {
  if (!text) {
    throw new Error(`${stage}: empty response from model`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${stage}: failed to parse model response as JSON`);
  }
}
