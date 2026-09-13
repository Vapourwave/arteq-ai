import { Readable } from "node:stream";
import { env } from "../../config/env.js";
import type { TTSProvider, TTSSynthesisResult } from "./TTSProvider.js";

/**
 * EXPERIMENTAL. Fish Audio's hosted TTS API — verified directly against the
 * official reference (https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
 * rather than trusted from memory or a third-party summary, same diligence
 * as this project's Gemini model-name verification.
 *
 * Endpoint: POST https://api.fish.audio/v1/tts
 * Auth: `Authorization: Bearer <key>` header.
 * Model selection: a separate `model` header (NOT a body field) — this
 * project requests "s2-pro" specifically, per the CEO's request to
 * evaluate S2 Pro (not the newer default "s2.1-pro").
 * Response: chunked/streamed raw audio bytes (Transfer-Encoding: chunked)
 * in the requested `format` — there is no separate streaming endpoint;
 * streaming is the endpoint's normal behavior, which is why this provider
 * can pipe the response straight through instead of buffering.
 */
const FISH_TTS_ENDPOINT = "https://api.fish.audio/v1/tts";
const FISH_MODEL = "s2-pro";

/** mp3 keeps the response small and universally playable in a browser
 * <audio> element without extra decoding work in this dev-only harness;
 * "low" latency mode favors faster time-to-first-audio over throughput,
 * matching the product's "streaming matters for a conversational
 * receptionist" requirement. Both are documented, valid enum values. */
const FISH_AUDIO_FORMAT = "mp3";
const FISH_CONTENT_TYPE = "audio/mpeg";

export class FishTTSProvider implements TTSProvider {
  readonly name = "fish-s2-pro";

  isConfigured(): boolean {
    return Boolean(env.fishApiKey);
  }

  async synthesize(text: string): Promise<TTSSynthesisResult> {
    if (!env.fishApiKey) {
      throw new Error("FISH_API_KEY is not configured");
    }

    const response = await fetch(FISH_TTS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.fishApiKey}`,
        "Content-Type": "application/json",
        model: FISH_MODEL,
      },
      body: JSON.stringify({
        text,
        format: FISH_AUDIO_FORMAT,
        latency: "low",
      }),
    });

    if (!response.ok || !response.body) {
      // Surface the real status code operationally (CLAUDE.md §11/§25) —
      // never fabricate success, never leak this raw detail to the patient
      // (there is no patient-facing surface for this experimental provider
      // yet; this error is caught and reported by the dev test route).
      const bodyText = await response.text().catch(() => "");
      throw new Error(
        `Fish TTS request failed: HTTP ${response.status} ${response.statusText}${
          bodyText ? ` — ${bodyText.slice(0, 500)}` : ""
        }`,
      );
    }

    return {
      contentType: FISH_CONTENT_TYPE,
      audioStream: Readable.fromWeb(response.body as import("node:stream/web").ReadableStream),
    };
  }
}
