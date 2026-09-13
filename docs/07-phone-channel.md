# ARTEQ AI — Phone Voice Channel

**Document:** 07 — Real Phone Call Channel
**Status:** Code-complete / awaiting real telephony configuration
**Scope:** Vertical slice only — answer, converse, barge-in, hang up. No
hospital workflow (OP ticket / doctor / department / registration) is
driven from the phone channel yet; those already exist in the receptionist
core and light up unchanged once this slice is proven on a real number.

---

## 1. Where this fits

ARTEQ is **one receptionist brain with multiple channels**. The phone
channel is a transport/adaptation layer in front of the existing voice
core — it contains **no hospital business logic**.

```
                    ┌──────────────────────────┐
                    │    Receptionist Core     │
                    │  VoiceProvider (Gemini)  │
                    │  conversationState /     │
                    │  geminiTools / grounding │
                    └───────────┬──────────────┘
                                │  VoiceProvider / VoiceSession
                                │  (base64 PCM16 — no telephony types)
              ┌─────────────────┴──────────────────┐
              │                                    │
     Kiosk Voice Channel                  Phone Voice Channel
     ws/voiceSocket.ts                    ws/phoneSocket.ts
     /api/live                            /api/phone/media
              │                                    │
     browser AudioWorklet             PhoneCallSession
     + VoiceSocketClient              → TelephonyAudioAdapter
                                      → PhoneVoiceTransport
                                      → TwilioMediaStreamTransport
                                              │
                                        Twilio Media Streams
                                        (µ-law 8 kHz, WebSocket)
                                              │
                                         PSTN / caller
```

The same `GeminiLiveVoiceProvider` **instance** is shared by both
`attachVoiceSocket` and `attachPhoneSocket` (see `apps/backend/src/index.ts`).

---

## 2. Chosen provider — Twilio (first), boundary kept provider-agnostic

### Decision

Build the vertical slice on **Twilio Programmable Voice + Media Streams**,
behind a provider-agnostic `PhoneVoiceTransport` interface so Plivo /
Exotel / Ozonetel / Teler can be added later without touching
`PhoneCallSession` or anything above it.

### Why Twilio for the slice

| Factor | Twilio | Plivo | Exotel / Ozonetel / Knowlarity |
|---|---|---|---|
| Bidirectional realtime media over WebSocket | Yes — `<Connect><Stream>` | Yes — `<Stream bidirectional="true">` | Exotel Voicebot / streaming APIs; more call-center-oriented |
| Wire codec | µ-law (`audio/x-mulaw`) 8 kHz mono, base64, no header bytes | µ-law 8 kHz (`audio/x-mulaw;rate=8000`) | µ-law 8 kHz |
| Barge-in / playback cancellation | `clear` control message empties Twilio's outbound buffer | `clearAudio` event | provider-specific |
| Interruption event to server | `mark` acks; interruption handled by our VAD (Gemini) + `clear` | similar | similar |
| Docs quality for realtime AI | Best-in-class, current | Good, improving | Sparse for realtime AI streaming |
| Instant test number | US number in minutes, callable worldwide | US + India numbers | India numbers, KYC-gated |
| India inbound number | **Restricted** — see §7 | Available (₹ pricing published) | Available, their core business |
| Signature/security | `X-Twilio-Signature` HMAC-SHA1 on the webhook | token/param on stream | provider-specific |

Twilio wins for **getting a real end-to-end call working now** (best
docs, an instantly usable number). Its weakness is exactly the thing ARTEQ
needs for production in Kerala — an **Indian** inbound number — so the
adapter is deliberately written against an interface, not against Twilio.

### Production recommendation for India

Plan to run production on **Plivo** or **Exotel**:

- Both expose an almost identical bidirectional µ-law-8k WebSocket, so
  each is a second `PhoneVoiceTransport` implementation (~1 file), not a
  rewrite.
- Both legitimately provision Indian DID numbers that Indian mobile
  networks can call.
- Expect **KYC**: business registration, a local address, and an
  authorised-signatory ID; number provisioning is not instant. Voice bots
  / outbound also touch DoT OSP and TRAI DND/DLT rules — a compliance
  step to schedule early, independent of this code.

Twilio Indian numbers: only toll-free (`+91 800`) is offered on the
self-serve path, the registered address must be **outside India**, and
reachability from Indian mobile networks is unreliable — treat a Twilio
Indian number as not viable for a hospital reception line without a
direct Twilio sales/carrier arrangement.

---

## 3. Call flow

```
Caller dials the hospital number
        │
        ▼
Twilio → HTTP POST  /api/phone/incoming-call   (routes/phone.ts)
        │   • X-Twilio-Signature verified (when TWILIO_AUTH_TOKEN set)
        │   • responds with TwiML:
        │       <Say>short greeting</Say>
        │       <Connect><Stream url="wss://<host>/api/phone/media">
        │                        <Parameter name="secret" .../></Stream></Connect>
        ▼
Twilio opens the Media Streams WebSocket → /api/phone/media  (ws/phoneSocket.ts)
        │
        ▼
TwilioMediaStreamTransport parses:  connected → start → media… → dtmf/stop
        │   • start.customParameters.secret checked against PHONE_STREAM_SHARED_SECRET
        ▼
PhoneCallSession.begin()
        │   • provider.startSession(callbacks)   ← the SAME Gemini Live core
        ▼
loop:
   caller media frame ─► TelephonyAudioAdapter.callerFrameToCore ─► VoiceSession.sendAudioChunk
   Gemini audio chunk ─► TelephonyAudioAdapter.coreChunkToCaller ─► transport.sendCallerAudio
   Gemini "interrupted" ─► adapter.resetOutbound + transport.clearCallerAudio  (barge-in)
        ▼
Twilio "stop" (caller hung up)  OR  socket close
        ▼
PhoneCallSession.teardown()  → VoiceSession.stop() + transport.close()   (idempotent)
```

---

## 4. Audio flow / conversion boundary

Telephony is narrowband µ-law 8 kHz; the core speaks linear PCM16 at two
different rates. **Nothing above `TelephonyAudioAdapter` ever sees a µ-law
byte, an 8 kHz sample, or a `streamSid`.**

```
Caller → core (patient speech):
  base64 ─► µ-law bytes ─► G.711 decode ─► PCM16 @ 8 kHz
        ─► LinearResampler 8k→16k (carries phase across frames)
        ─► PCM16 LE bytes ─► base64      ══► VoiceSession.sendAudioChunk
                                              (VOICE_AUDIO_CONTRACT: 16 kHz)

Core → caller (assistant speech):
  base64 PCM16 LE @ 24 kHz  (ASSISTANT_AUDIO_CONTRACT)
        ─► Float32 ─► LinearResampler 24k→8k (carries phase across frames)
        ─► Int16 ─► G.711 µ-law encode ─► base64
        ─► TwilioMediaStreamTransport re-frames to 160-byte (20 ms) frames
        ─► { event: "media", streamSid, media: { payload } }  ══► Twilio
```

Files:

| File | Responsibility |
|---|---|
| `telephony/audio/mulaw.ts` | G.711 µ-law encode/decode (dependency-free) |
| `telephony/audio/resample.ts` | `LinearResampler` (cross-chunk continuity, ported from the kiosk's proven `PcmResampler`) + PCM/Float helpers |
| `telephony/TelephonyAudioAdapter.ts` | The boundary: `callerFrameToCore()`, `coreChunkToCaller()`, `resetOutbound()` |

### Latency introduced by conversion

Per-frame conversion is pure arithmetic over ~160–480 samples: **sub-
millisecond**, negligible next to network + model round-trip. The
resamplers are linear-interpolation and stateful (no lookahead, no
buffering delay). The transport's 20 ms outbound re-framing adds at most
one frame (~20 ms) of jitter smoothing. The dominant latency is Gemini
Live's response time, unchanged from the kiosk.

---

## 5. Transport boundary

`PhoneVoiceTransport` (in `telephony/PhoneVoiceTransport.ts`) is the only
contract `PhoneCallSession` knows:

- **in:** `onStart(meta)`, `onCallerAudio(muLawBase64)`, `onDtmf(digit)`,
  `onStop()`, `onClose()`, `onError(msg)`
- **out:** `sendCallerAudio(muLawBase64)`, `clearCallerAudio()`, `close()`

Everything Twilio-specific — event names (`connected`/`start`/`media`/
`dtmf`/`mark`/`stop`), `streamSid`/`callSid`, the `clear` control message,
custom-parameter parsing, 20 ms re-framing — is contained in
`telephony/TwilioMediaStreamTransport.ts`. Adding Plivo = one more file
implementing the same interface.

---

## 6. Security boundary

The phone webhook and media socket are **untrusted external transports**
(CLAUDE.md §28).

| Concern | Handling |
|---|---|
| Webhook authenticity | `X-Twilio-Signature` HMAC-SHA1 verified in `routes/phone.ts` against `TWILIO_AUTH_TOKEN` + exact public URL + POST params (`telephony/twilioSignature.ts`, validated against Twilio's published test vector). Unset token ⇒ served but a loud startup + per-request warning; set it before going public. |
| Media WebSocket | Media Streams has no per-message provider signature. A shared secret is passed as a Twilio `<Parameter name="secret">` and checked against `PHONE_STREAM_SHARED_SECRET` when the stream starts; mismatch ⇒ the socket is closed before any core session is created. |
| Event validation | Unknown / malformed / out-of-order frames are logged and ignored, never thrown out of the socket handler. |
| Secrets | All via env (`config/env.ts`), never logged. `.env` is gitignored; `.env.example` documents keys with empty values. |
| Cleanup | `PhoneCallSession.teardown()` is idempotent and runs on `stop`, socket close, provider error, and the hang-up-mid-connect race; it always calls `VoiceSession.stop()` and `transport.close()`. |
| Logging | Structured `PHONE_*` events with call/stream ids and hospital-navigation facts only — never the caller's transcript text (CLAUDE.md §25); patient speech is logged as a character count. |

---

## 7. Interruption / barge-in behaviour

1. Caller talks while the assistant is speaking.
2. Gemini Live's VAD fires `serverContent.interrupted` → `VoiceProvider`
   `onInterrupted`.
3. `PhoneCallSession` calls `adapter.resetOutbound()` (drop the
   downsampler's carried interpolation tail so the next reply doesn't
   glide out of a stale sample) **and** `transport.clearCallerAudio()`.
4. `TwilioMediaStreamTransport` drops its own un-sent 20 ms remainder and
   sends `{ event: "clear", streamSid }`; Twilio empties everything it has
   buffered but not yet played to the caller.
5. Result: assistant audio stops within ~one frame; the caller keeps
   talking; the next Gemini turn plays normally.

---

## 8. Environment variables

All optional. Unset ⇒ the phone channel is dormant and the kiosk channel
is unaffected. See `apps/backend/.env.example`.

| Var | Purpose |
|---|---|
| `GEMINI_API_KEY` | Already required for kiosk voice; the phone channel reuses it (one brain). |
| `TWILIO_AUTH_TOKEN` | Verify the inbound-call webhook signature. Strongly recommended before exposing the endpoint. |
| `PHONE_PUBLIC_HOST` | Public host (no scheme, no trailing slash) Twilio reaches this backend at — the tunnel host in dev, the real domain in prod. Used to build the `wss://…/api/phone/media` URL in the TwiML. |
| `PHONE_STREAM_SHARED_SECRET` | Sent to Twilio as `<Parameter name="secret">` and checked on stream start. Recommended whenever `PHONE_PUBLIC_HOST` is set. |

`/api/health` reports `phoneChannelConfigured` (`GEMINI_API_KEY` &&
`PHONE_PUBLIC_HOST`).

---

## 9. Local testing

### Automated (no telephony account needed)

```
cd apps/backend
npm test            # includes src/telephony/*  (57 telephony assertions)
npm run typecheck
```

Covered: µ-law round-trip + clipping + sign convention; resampler ratios,
DC preservation, cross-chunk continuity, `reset()`; adapter
caller↔core↔caller conversions and streaming stability; Twilio transport
inbound events (`connected`/`start`/`media`/`dtmf`/`mark`/`stop`), malformed
& unknown frames, 160-byte re-framing, sub-frame buffering, `clear`,
close/readyState gating; `PhoneCallSession` start, secret accept/reject,
audio both directions, barge-in, hang-up teardown, error teardown,
hang-up-mid-connect race; Twilio signature against the published vector.

### Local end-to-end against real Gemini + a simulated Twilio stream

Verified during development: with a real `GEMINI_API_KEY`, a script
emitting Twilio-shaped `start` + µ-law `media` + `stop` frames over
`ws://localhost:8787/api/phone/media` produced
`PHONE_CALL_STARTED → PHONE_VOICE_SESSION_READY → PHONE_CALL_HANGUP →
PHONE_CALL_ENDED` with no errors — i.e. the adapter + transport + session
drive the real voice core correctly. **A real PSTN call has not been
placed** (no telephony number configured).

### Real phone call — remaining setup

Nothing telephony-specific is configured in this repo. To place a real
call:

1. **Twilio account + number.** Buy a Programmable Voice number (a US
   number is fine for testing; it is callable from anywhere). Note the
   Account SID and Auth Token.
2. **Public tunnel.** `ngrok http 8787` (or a Cloudflare Tunnel). Copy the
   host, e.g. `a1b2c3d4.ngrok-free.app`.
3. **`apps/backend/.env`:**
   ```
   GEMINI_API_KEY=...            # already set
   TWILIO_AUTH_TOKEN=<from Twilio console>
   PHONE_PUBLIC_HOST=a1b2c3d4.ngrok-free.app
   PHONE_STREAM_SHARED_SECRET=<any long random string>
   ```
4. **Run the backend:** `npm run dev:backend` (from repo root).
5. **Twilio console → your number → Voice → "A call comes in":**
   Webhook, `HTTP POST`,
   `https://a1b2c3d4.ngrok-free.app/api/phone/incoming-call`.
6. **Call the number.** Expected: the greeting plays, you speak, ARTEQ
   replies in voice, you can talk over it and it stops, you continue, it
   replies again, you hang up and the server logs `PHONE_CALL_ENDED`.

Watch `PHONE_*` log lines for `PHONE_CALL_STARTED`,
`PHONE_VOICE_SESSION_READY`, `PHONE_CALLER_SPEECH`,
`PHONE_ASSISTANT_INTERRUPTED`, `PHONE_CALL_HANGUP`.

---

## 10. Production deployment considerations

- **Public HTTPS/WSS endpoint** with a stable domain; set `PHONE_PUBLIC_HOST`
  to it and always set `TWILIO_AUTH_TOKEN` + `PHONE_STREAM_SHARED_SECRET`.
- **One process per region / horizontal scale:** each call is a WebSocket
  held for the call's duration plus one Gemini Live connection; size
  compute for concurrent-call peak, not average.
- **Greeting:** currently a Twilio `<Say>` (Polly voice). For a
  Malayalam-first hospital line, move the greeting into the voice core so
  it is one consistent voice and language-aware (small follow-up).
- **India:** provision the real inbound number on Plivo/Exotel (add a
  `PhoneVoiceTransport` impl), and complete KYC + DoT/TRAI compliance
  before launch.
- **Observability:** ship the `PHONE_*` events to the same telemetry sink
  as the kiosk `VOICE_*` events (docs/02 §29).
- **Failure UX:** if `GEMINI_API_KEY` is missing/failing, the webhook
  answers with a spoken "service not available, please call back" and
  hangs up — it never fakes a working line (CLAUDE.md §11/§24).

---

## 11. Known limitations (this slice)

- No real PSTN call has been placed — **code-complete, not
  production-verified**.
- No hospital workflow on the phone path yet (no OP ticket / doctor /
  department / registration / DTMF IVR). The core tool-calls exist and
  will work unchanged; they are simply not a goal of this slice.
- Greeting is Twilio `<Say>`, not the core voice.
- Single provider implemented (Twilio). Interface is ready for a second.
- Barge-in relies on Gemini Live's VAD (same as the kiosk); no
  telephony-side energy VAD.
- No call recording, transfer-to-human, or voicemail.
- Outbound re-framing is fixed 20 ms; not yet tuned against real jitter.

---

## 12. Next steps

1. Place a **real test call** via the §9 setup; measure end-to-end latency
   and barge-in responsiveness on a real network.
2. Move the greeting into the voice core (language-aware, one voice).
3. Add a **Plivo** `PhoneVoiceTransport` and provision an Indian number;
   start KYC / DoT / TRAI compliance.
4. Let the existing hospital tool-calls run on the phone path; add a
   spoken confirmation + optional SMS of the OP ticket.
5. Wire `PHONE_*` telemetry into the shared observability sink.
6. Load/soak test concurrent calls.
