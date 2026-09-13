import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { env } from "../config/env.js";
import type { VoiceProvider } from "../providers/voice/VoiceProvider.js";
import { PhoneCallSession } from "../telephony/PhoneCallSession.js";
import { TwilioMediaStreamTransport, type TwilioSocket } from "../telephony/TwilioMediaStreamTransport.js";

/**
 * Owns the /api/phone/media upgrade path — the Twilio Media Streams
 * bidirectional WebSocket for a live phone call.
 *
 * Structurally mirrors ws/voiceSocket.ts (the kiosk's /api/live handler):
 * one place that accepts the socket and bridges it to a VoiceProvider. The
 * SAME provider instance is passed in from index.ts, so the phone channel
 * and the kiosk channel are two transports on one receptionist brain
 * (CLAUDE.md §8, task brief).
 *
 * Everything Twilio-specific lives below this line, inside
 * TwilioMediaStreamTransport; PhoneCallSession and the voice core never see
 * it.
 */
export function attachPhoneSocket(
  server: {
    on(event: "upgrade", listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): void;
  },
  provider: VoiceProvider,
): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? "", "http://localhost").pathname;
    } catch {
      return;
    }
    if (pathname !== "/api/phone/media") return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      const transport = new TwilioMediaStreamTransport(ws as unknown as TwilioSocket);
      const session = new PhoneCallSession(transport, provider, {
        expectedStreamSecret: env.phoneStreamSharedSecret,
      });
      session.begin();
    });
  });
}
