# ARTEQ AI — Client Demo Script

**Audience:** live client demonstration
**Duration:** 4–6 minutes
**Owner:** presenter (not the client) drives the kiosk

---

## Demo objective

Show, end to end, that ARTEQ is an **AI hospital receptionist**: a patient walks
up, speaks naturally (English, Malayalam, or Manglish), and ARTEQ understands
them, routes them to the right department and doctor using **real hospital
data**, and issues an OP token — all without the patient touching a menu.

The one sentence the client should leave with:

> "A patient can just walk up and ask for help, and ARTEQ takes them to the
> right doctor."

---

## Before the client arrives — setup checklist

1. **Start the servers** (two terminals, from the repo root):
   - `npm run dev:backend`  → wait for `listening on http://localhost:8787`
   - `npm run dev:kiosk`    → wait for `Local: http://localhost:5173/`
2. Confirm the backend is healthy: open `http://localhost:8787/api/health` —
   it must show `"voiceProviderConfigured": true`.
3. Open `http://localhost:5173/` in **Chrome**.
4. Press **F11** for fullscreen (hides the address bar and tabs).
5. **Grant microphone permission** when Chrome asks — do this once now, on a
   throwaway run, so the client never sees the permission prompt.
6. Check audio output: speakers on, volume ~70%, not muted.
7. Do **one full practice run** end to end (below). Then press **Esc** to reset.
8. Close every other noisy app (notifications, chat, email).

You should now be sitting on the idle screen: **"How can I help you? — Your AI
hospital receptionist"** with a **Tap to begin** button.

---

## Recommended demo flow

### Scene 1 — Idle → Welcome (10s)

- Point at the screen: "This is the resting state. The camera would normally
  wake it when someone walks up; here I'll tap."
- **Tap "Tap to begin"** → Welcome screen: *"Welcome. How can I help you?
  Speak naturally, in Malayalam, Manglish, or English."*
- **Tap the microphone.**

### Scene 2 — Patient speaks, ARTEQ understands (30–45s)

- The orb turns green and the label reads **"I'm listening…"**.
- Speak clearly, one natural sentence (see **Scenario A** below).
- The live transcript appears under the orb as you speak.
- ARTEQ replies **out loud** and the orb switches to the speaking state.
  The label reads **"Speaking…"**.

### Scene 3 — Routing with real data (30s)

- ARTEQ confirms what it understood and names the department.
- The **department / doctor panel** appears on screen — this is real data from
  the hospital service, not something the AI made up.
- Either **say** which doctor you want, or **tap** the doctor card. (Tapping is
  the reliable path — use it if the room is noisy.)

### Scene 4 — OP ticket (20s)

- Once a department **and** a doctor are selected, the primary button becomes
  **"Get OP Ticket"**.
- **Tap "Get OP Ticket"** → the token screen: token number, department, doctor,
  estimated wait, and the reason the patient gave — then *"Please take a seat."*
- Tap **Done**.

### Scene 5 — Reset and go again (5s)

- Press **Esc** — the session resets to idle instantly. Ready for the next run.

---

## Exact sample patient utterances

Use these verbatim. All three lead to a department that exists in the
deterministic demo dataset (`apps/backend/src/services/hospital/mockHospitalData.ts`).

### Scenario A — symptom, English (primary demo)

> "I have tooth pain and I'd like to see a doctor."

Expected: routes to **Dentistry**. Doctors shown: **Dr. Anjali Menon** (General
Dentistry, 9:00 AM – 1:00 PM, ~25 min wait) and **Dr. Rahul Nair** (Orthodontics,
2:00 PM – 6:00 PM, ~10 min wait).

### Scenario B — patient already knows the department

> "I already know I want to see the cardiology department."

Expected: routes to **Cardiology**. Doctors shown: **Dr. Meera Krishnan**
(Cardiology, ~20 min wait) and **Dr. Vinod Pillai** (Interventional Cardiology,
~35 min wait).

### Scenario C — Manglish / mixed language (shows multilingual strength)

> "Enikku pallu vedhana undu, oru dentist-ne kaananam."

Expected: routes to **Dentistry**, same doctors as Scenario A. ARTEQ replies in
the language the patient used.

### Scenario D — ambiguity handled safely (optional, shows it doesn't guess)

> "I don't feel well."

Expected: ARTEQ does **not** pick a department. It asks a short clarifying
question. Use this only if you want to show the safety behaviour; then follow up
with "I have a fever" → **General Medicine**.

---

## Expected ARTEQ behaviour

| Step | What ARTEQ does | Where the data comes from |
|---|---|---|
| Understand speech | Live transcription, replies in the patient's language | Gemini Live |
| Identify need | Extracts the symptom / department / doctor intent | Gemini Live |
| Look up department | Closed-world match — never invents a department | `hospitalService` |
| Show doctors | Names, timings, queue length, estimated wait | `hospitalService` (mock dataset) |
| Confirm | Repeats back what it understood before acting | Gemini Live, grounded on real facts |
| Issue token | Generates the OP token deterministically | `ticketService` (backend) |

ARTEQ never states a doctor, department, queue number, wait time, or token that
did not come from the backend.

---

## What to show the client

- Natural spoken interaction — no buttons to start talking beyond the mic tap.
- The living listening / speaking states (the orb).
- Real department + doctor data appearing on screen, in sync with the voice.
- Multilingual input (Scenario C).
- The finished OP token.
- The instant reset (Esc) between runs.

## What NOT to demonstrate

- **Do not** open "TTS test (dev)" — it is hidden by default; keep it that way.
- **Do not** press **Stop** mid-conversation. Stop is the "patient gave up"
  path; it ends in a plain "here's what I heard" screen, which is honest but
  not the story you're telling. Finish with **Get OP Ticket**, or reset with **Esc**.
- **Do not** ask ARTEQ medical questions ("what medicine should I take?"). It
  will correctly decline, but that is not the point of this demo.
- **Do not** rely on voice-only doctor selection in a noisy room — tap the card.
- **Do not** demonstrate patient identity / OTP — not built yet.
- **Do not** demonstrate the phone channel — separate workstream, not part of
  this demo.

---

## Recovery procedure if voice fails

Symptoms: orb stuck on "Connecting…", no transcript appearing, or an error
screen ("I'm having trouble connecting right now").

1. The error screen already offers **Try again** and **Ask a receptionist** —
   tap **Try again** first.
2. If it doesn't recover: press **Esc** to reset to idle, then start again from
   "Tap to begin".
3. If still failing: check the **backend terminal** is still running (these dev
   servers can be stopped by the OS). Restart `npm run dev:backend`, refresh the
   browser, redo the mic-permission run.
4. Check `http://localhost:8787/api/health` shows `voiceProviderConfigured: true`.
5. Last resort: narrate the routing using the **tap** path only — tap a
   department card, tap a doctor card, tap **Get OP Ticket**. This exercises the
   exact same backend logic without needing the microphone.

## Reset procedure between demonstrations

- **Press Esc.** This fully clears the session — transcript, department, doctor,
  token — and returns to the idle screen. It also tears down the microphone and
  voice connection cleanly.
- Alternatively, finish the flow and tap **Done** on the token screen.
- If left untouched for ~1 minute, the kiosk shows **"Are you still there?"**
  and then resets itself — this is expected behaviour, not a fault.
- A browser **refresh** also gives a completely clean state.

---

## Known limitations (be ready if asked)

- Hospital data is a **fixed demo dataset**, not a live hospital feed. This is
  by design — the integration seam is a single service file.
- **Patient identity / OTP** is not implemented. The token is issued without a
  verified patient record.
- If the patient presses **Stop** instead of finishing, there is a short
  processing wait before the "here's what I heard" screen.
- Voice quality depends on room noise and mic placement — a headset or a quiet
  room is strongly recommended for the live demo.
- First page load after starting the dev server can take a few seconds to
  compile; load the page a minute before the client sees it.
