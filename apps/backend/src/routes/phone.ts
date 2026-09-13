import express, { type Express, type Request } from "express";
import { env, hasGeminiCredentials } from "../config/env.js";
import { validateTwilioSignature } from "../telephony/twilioSignature.js";

/**
 * The Twilio Voice webhook for an inbound hospital phone call.
 *
 * Twilio requests this URL (configured on the number in the Twilio console)
 * when a call comes in and expects TwiML back. We answer, speak a short
 * greeting, then hand the call's live audio to our Media Streams WebSocket
 * (/api/phone/media, see ws/phoneSocket.ts) with `<Connect><Stream>`, which
 * is Twilio's bidirectional mode — audio flows both ways over that socket.
 *
 * This route contains NO hospital logic: it is pure call setup. It is also
 * an untrusted external transport (CLAUDE.md §28), so the request signature
 * is verified when TWILIO_AUTH_TOKEN is configured.
 */
export function attachPhoneRoutes(app: Express): void {
  // Twilio posts application/x-www-form-urlencoded, not JSON — parse it just
  // for this route so the global express.json() isn't disturbed.
  const form = express.urlencoded({ extended: false });

  app.post("/api/phone/incoming-call", form, (req, res) => {
    const params = (req.body ?? {}) as Record<string, string>;
    const fullUrl = publicUrlFor(req);

    if (env.twilioAuthToken) {
      const ok = validateTwilioSignature({
        authToken: env.twilioAuthToken,
        signatureHeader: req.header("X-Twilio-Signature"),
        fullUrl,
        params,
      });
      if (!ok) {
        console.warn("[phone] rejected inbound webhook: bad X-Twilio-Signature", { url: fullUrl });
        res.status(403).type("text/plain").send("Invalid signature");
        return;
      }
    } else {
      console.warn(
        "[phone] TWILIO_AUTH_TOKEN not set — inbound webhook signature NOT verified. " +
          "Set it before exposing this endpoint publicly (docs/07 §Security).",
      );
    }

    if (!hasGeminiCredentials) {
      // Never fabricate service (CLAUDE.md §11/§24): say so plainly, in
      // words a caller understands, and hang up.
      res
        .type("text/xml")
        .send(
          twiml(
            `<Say voice="Polly.Aditi" language="en-IN">Sorry, the reception service is not available right now. Please call back later.</Say><Hangup/>`,
          ),
        );
      return;
    }

    if (!env.phonePublicHost) {
      console.error("[phone] PHONE_PUBLIC_HOST is not set — cannot build the Media Streams URL.");
      res
        .type("text/xml")
        .send(
          twiml(
            `<Say voice="Polly.Aditi" language="en-IN">Sorry, the reception service is not configured. Please call back later.</Say><Hangup/>`,
          ),
        );
      return;
    }

    const streamUrl = `wss://${env.phonePublicHost}/api/phone/media`;
    const secretParam = env.phoneStreamSharedSecret
      ? `<Parameter name="secret" value="${escapeXml(env.phoneStreamSharedSecret)}"/>`
      : "";

    console.log("[phone] answering inbound call", { callSid: params.CallSid });

    res.type("text/xml").send(
      twiml(
        `<Say voice="Polly.Aditi" language="en-IN">Welcome to the hospital reception. Please tell me how I can help you.</Say>` +
          `<Connect><Stream url="${escapeXml(streamUrl)}">${secretParam}</Stream></Connect>`,
      ),
    );
  });
}

function twiml(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}

/** The exact public URL Twilio used, for signature verification. Trusts
 * PHONE_PUBLIC_HOST (the tunnel/prod host) over the local Host header. */
function publicUrlFor(req: Request): string {
  const host = env.phonePublicHost ?? req.header("Host") ?? "localhost";
  return `https://${host}${req.originalUrl}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
