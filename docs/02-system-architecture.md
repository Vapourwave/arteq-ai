# ARTEQ AI — System Architecture & Technical Blueprint

**Document:** 02 — System Architecture & Technical Blueprint  
**Product:** ARTEQ AI Portable AI Receptionist  
**Version:** 2.0  
**Status:** Technical Source of Truth  
**Implementation Strategy:** New architecture; selectively reuse proven legacy capabilities

---

## 1. Purpose

This document defines the technical architecture for the ARTEQ AI Portable AI Receptionist.

It translates the product vision in Document 01 into an implementation model.

The architecture must support:

- A physical portable bot
- Touchscreen interaction
- Camera-triggered presence detection
- Voice-first multilingual interaction
- Cloud AI services
- Hospital-controlled operational data
- Patient registration and identity verification
- OP registration and token generation
- Spoken and visual responses
- Safe fallbacks
- Session isolation
- Future expansion without rebuilding the core

This document is a blueprint, not a demand to use one specific framework or vendor.

---

# 2. Architectural North Star

The system should be built as a set of clear layers rather than as one giant application component.

```text
┌─────────────────────────────────────────────┐
│              PHYSICAL BOT                  │
│                                             │
│  Camera • Touchscreen • Mic • Speaker      │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│          INTERACTION / UI LAYER             │
│                                             │
│  Presence • Welcome • Voice • Touch • UI   │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│          ORCHESTRATION LAYER                │
│                                             │
│  Session • Intent • Workflow • State       │
└───────────────┬───────────────┬─────────────┘
                │               │
        ┌───────▼──────┐ ┌──────▼──────────┐
        │ AI SERVICES  │ │ HOSPITAL DOMAIN │
        │              │ │                 │
        │ Voice        │ │ Patients        │
        │ Refinement   │ │ Departments     │
        │ Quality      │ │ Doctors         │
        │ Routing      │ │ Visits / Queue  │
        │ TTS          │ │ Tokens          │
        └───────┬──────┘ └──────┬──────────┘
                │               │
                └───────┬───────┘
                        ▼
              ┌───────────────────┐
              │ PROVIDER ADAPTERS │
              │ Gemini / Sarvam / │
              │ other providers   │
              └───────────────────┘
```

The important architectural principle is:

> **AI interprets. The hospital system decides what is operationally valid.**

---

# 3. Physical Hardware Layer

The MVP is designed around a portable physical bot.

Expected hardware:

- Touchscreen
- Webcam
- Microphone
- Speaker
- Compute device
- Network connection
- Power supply
- Physical enclosure

The software must treat hardware capabilities as services rather than hard-coding assumptions about a particular laptop or development machine.

Conceptually:

```text
Camera → Presence Service
Mic    → Voice Service
Speaker → TTS / Audio Output
Touch  → UI
Screen → UI
```

Hardware drivers/adapters should remain replaceable.

---

# 4. Application Layer

The application should be divided into logical domains.

Recommended high-level structure:

```text
src/
├── app/
├── components/
├── features/
│   ├── presence/
│   ├── welcome/
│   ├── patient/
│   ├── voice/
│   ├── assistance/
│   ├── routing/
│   ├── doctors/
│   ├── registration/
│   ├── token/
│   └── kiosk/
├── services/
│   ├── ai/
│   ├── voice/
│   ├── tts/
│   ├── patient/
│   ├── hospital/
│   ├── routing/
│   └── session/
├── data/
├── types/
└── utils/
```

The exact framework and directory names may change during implementation.

The architectural separation should not.

---

# 5. Backend Architecture

The backend is the trusted boundary between the frontend and hospital/AI services.

Conceptually:

```text
Touchscreen Client
        │
        ▼
     Backend
        │
   ┌────┼───────────────┐
   ▼    ▼               ▼
Hospital AI          Authentication
Data    Providers     / Session
```

Backend responsibilities include:

- AI API access
- Secret management
- Patient operations
- OTP verification
- Hospital data access
- Routing validation
- Doctor validation
- Token generation
- Session operations
- Audit/logging where appropriate
- Provider abstraction
- Error handling

AI API keys must not be exposed to the browser.

---

# 6. AI Provider Abstraction

AI providers must be replaceable.

Do not scatter provider-specific SDK calls throughout UI components.

Preferred model:

```text
Application
     ↓
AI Service Interface
     ↓
Provider Adapter
     ├── Gemini
     ├── Sarvam
     └── Future Provider
```

For example:

```ts
interface SpeechService {
  start(): Promise<void>;
  stop(): Promise<void>;
  onTranscript(callback: (text: string) => void): void;
}
```

The exact interface should be designed around actual requirements during implementation.

The principle is more important than the exact API.

---

# 7. Voice Architecture

Voice is one of the most important technical subsystems.

The intended pipeline is:

```text
Microphone
   ↓
Audio Capture
   ↓
Speech Recognition
   ↓
Raw Transcript
   ↓
Transcript Refinement
   ↓
Quality Guard
   ↓
Patient Confirmation
   ↓
Approved Request
```

The system must support:

- Malayalam
- Manglish
- English
- Mixed-language speech
- Natural pauses
- Long utterances
- Public-space microphone conditions

---

# 8. Voice Capture Requirements

The voice capture system must prioritize transcription fidelity.

Important considerations include:

- Runtime audio sample rate
- PCM format
- Audio continuity
- Buffer handling
- WebSocket stability where applicable
- Browser/main-thread performance
- Recording lifecycle
- Stop/finalization behavior
- Natural pauses
- Microphone permissions
- Error recovery

The old AI Studio implementation demonstrated that UI rendering can interfere with audio capture when the main thread is overloaded.

Therefore:

> **High-frequency transcription events must never trigger expensive full-application renders.**

Live transcript display should be isolated from the main workflow state where possible.

---

# 9. Voice and UI Performance Boundary

During active recording:

```text
Audio callback
     ↓
Lightweight buffer/ref update
     ↓
Minimal UI update
```

Avoid:

```text
Audio callback
     ↓
Large state update
     ↓
Entire kiosk re-render
     ↓
Audio callback starvation
```

The voice system and the main UI must be decoupled enough that live transcription cannot compromise audio capture.

A small isolated live-transcript component is preferred over re-rendering the entire workflow.

---

# 10. Transcript Refinement

Raw speech recognition output is not automatically suitable for routing.

Pipeline:

```text
Raw Transcript
      ↓
Refinement Service
      ↓
Clean Request
```

Refinement should:

- Improve readability
- Normalize Manglish/Malayalam/English where useful
- Preserve the patient's meaning
- Avoid inventing symptoms
- Avoid adding unsupported medical conclusions
- Return enough structure for routing

The refined transcript must not silently become a diagnosis.

---

# 11. Transcript Quality Guard

Before routing, the system should assess whether the request is usable.

Conceptual states:

```text
CLEAR
REVIEW
INSUFFICIENT
```

### CLEAR

The request is understandable enough to proceed.

### REVIEW

The system has an interpretation but should confirm it with the patient.

### INSUFFICIENT

The request is too incomplete or unclear.

The patient should then be prompted to repeat or clarify.

---

# 12. Patient Confirmation Architecture

The confirmation stage separates AI interpretation from patient intent.

```text
Patient speech
     ↓
AI interpretation
     ↓
"Did I understand you correctly?"
     ↓
Patient confirms / edits
     ↓
Approved request
```

The patient-approved interpretation is the input to downstream routing.

For symptom extraction, the interface may explicitly list the understood issues before asking for confirmation.

This is especially important for multilingual speech.

---

# 13. Sarvam AI Integration

Sarvam AI may be used for language-specific speech/TTS functionality where it provides a better patient experience.

Sarvam should be integrated through the provider abstraction rather than hard-coded into the workflow.

Potential uses include:

- Malayalam speech generation
- Malayalam conversational confirmations
- TTS
- Language-specific voice interaction

Example:

```text
Confirmation Text
       ↓
Speech Provider
       ↓
Sarvam Adapter
       ↓
Speaker
```

A Sarvam API key must remain server-side.

If Sarvam is unavailable, the application should have a defined fallback provider or text-based fallback.

---

# 14. TTS Architecture

Spoken responses should be treated as a separate output channel.

```text
AI / Application Response
        ↓
Response Formatter
        ↓
TTS Provider
        ↓
Speaker
```

TTS should not be responsible for business logic.

The application decides what should be said.

The TTS provider decides how it is spoken.

The system should support:

- English speech
- Malayalam speech
- Appropriate speaking speed
- Playback interruption
- Error handling
- Provider fallback where possible

---

# 15. AI Routing Architecture

Routing should be a controlled pipeline:

```text
Approved Patient Request
          ↓
AI Routing
          ↓
Candidate Department / Intent
          ↓
Closed-World Validation
          ↓
Doctor Validation
          ↓
Patient-facing Recommendation
```

The AI should never directly write an operational decision into the database without validation.

---

# 16. Closed-World Routing

The routing system must validate AI output against the hospital's configured departments.

Example:

```text
AI says:
"DENT"

        ↓

Normalization / matching

        ↓

Configured hospital data

        ↓

dept-dentistry

        ↓

Valid
```

Supported variants may include legitimate variations such as:

- DENT
- Dental
- Dentistry

But matching must remain constrained to known entities.

No fuzzy matching rule should be allowed to accidentally map an unrelated department.

---

# 17. Doctor Validation

AI-recommended doctors must be validated against hospital data.

Validation should confirm:

1. Doctor exists.
2. Doctor belongs to the selected department.
3. Doctor is currently eligible/available according to hospital data.
4. Doctor is appropriate for the selected workflow.

Invalid or unavailable doctors must be removed from the recommendation.

---

# 18. Hospital Data Layer

Hospital data is authoritative.

Conceptual entities:

```text
Hospital
 ├── Departments
 │     └── Doctors
 │            └── Availability
 │
 ├── Patients
 │
 ├── Visits
 │
 ├── Tokens
 │
 ├── Queue
 │
 └── Hospital Information
```

AI reads and interprets this information.

AI does not become the source of truth for it.

---

# 19. Patient Identity and OTP

Existing-patient identification should be separated from AI.

Conceptual flow:

```text
Mobile Number
      ↓
OTP Request
      ↓
OTP Verification
      ↓
Verified Mobile
      ↓
Associated Patient Profiles
      ↓
Patient Selection
```

The patient selection screen must minimize unnecessary personal information.

Authentication state should be temporary and scoped to the current kiosk session.

---

# 20. OP Registration and Token Architecture

After the patient has:

- Valid patient identity
- Approved request
- Valid department
- Valid doctor selection where required
- Final confirmation

the system may create the OP visit.

Conceptually:

```text
Approved Request
       ↓
Department
       ↓
Doctor
       ↓
Create Visit
       ↓
Generate Token
       ↓
Queue Patient
       ↓
Display / Print Ticket
```

The token engine must remain deterministic and server-controlled.

A frontend should never invent a token number.

---

# 21. Session Architecture

The kiosk is a shared device.

Each patient interaction must have an isolated session.

Conceptual session state:

```text
IDLE
 ↓
PERSON_DETECTED
 ↓
WELCOME
 ↓
IDENTITY
 ↓
ASSISTANCE_REQUEST
 ↓
TRANSCRIPT_CONFIRMATION
 ↓
ROUTING
 ↓
PATIENT_CONFIRMATION
 ↓
OP_REGISTRATION
 ↓
TICKET
 ↓
COMPLETE
 ↓
RESET
```

The exact state machine may evolve.

The principle should remain explicit state transitions rather than uncontrolled combinations of UI booleans.

---

# 22. Session Reset

Reset must happen after:

- Successful completion
- User cancellation
- Timeout
- Error requiring restart
- Staff override

Reset should clear temporary state including:

```text
patient
phone
OTP
transcript
refinedRequest
qualityStatus
routing
selectedDepartment
selectedDoctor
token
ticket
voiceState
TTS state
temporary UI state
```

A new patient must never inherit the previous patient's state.

---

# 23. Presence Detection

Presence detection is an entry trigger, not necessarily identity recognition.

```text
Camera
   ↓
Person Detection
   ↓
Presence State
   ↓
Wake UI
   ↓
Welcome
```

The MVP should favor simple, reliable presence detection over unnecessarily complex facial identification.

The architecture should allow the detection mechanism to evolve later.

---

# 24. UI Architecture

The UI should be state-driven.

A screen should correspond to the current interaction state.

Examples:

```text
Idle Screen
Welcome Screen
Patient Identification
Voice Assistance
Transcript Confirmation
Routing
Doctor Selection
Confirmation
Ticket
Error / Fallback
```

Do not create one enormous component containing every workflow state and every visual element.

Prefer:

```text
KioskShell
 ├── IdleView
 ├── WelcomeView
 ├── IdentityView
 ├── VoiceView
 ├── ConfirmationView
 ├── RoutingView
 ├── TicketView
 └── FallbackView
```

The exact component hierarchy can evolve.

The goal is separation of concerns and predictable rendering.

---

# 25. UI Performance Rules

The kiosk is a real-time interactive application.

Avoid:

- Giant components
- High-frequency parent state updates
- Expensive DOM trees during recording
- Re-rendering unrelated sections
- Large synchronous computations on audio events

Prefer:

- Small isolated components
- Memoization where justified
- Refs for high-frequency transient data
- Event-driven updates
- Lightweight rendering during recording
- Lazy loading for non-critical features

---

# 26. Dynamic Visualization Architecture

The system should eventually support an AI response being represented visually.

Conceptually:

```text
Patient Query
     ↓
Intent / Response
     ↓
Visualization Decision
     ├── No useful visualization
     │       ↓
     │     Voice + Text
     │
     └── Useful visualization
             ↓
       Structured Visual Data
             ↓
       Dynamic UI Component
```

AI should not directly generate arbitrary executable UI.

Instead, AI should return structured data describing an approved visualization type.

Example:

```json
{
  "type": "doctor_list",
  "data": {
    "department": "Dentistry",
    "doctors": [...]
  }
}
```

The frontend maps the approved type to a controlled component.

This prevents AI-generated UI from becoming a security or reliability problem.

---

# 27. Error Architecture

Errors should be categorized.

### User errors

Examples:

- Invalid phone number
- Incorrect OTP
- Empty request

Response:

> Explain clearly and allow retry.

### AI errors

Examples:

- Model unavailable
- Invalid AI output
- Low confidence

Response:

> Clarify, retry, or fall back.

### Hospital-data errors

Examples:

- Department unavailable
- Doctor unavailable

Response:

> Show current valid alternatives.

### Infrastructure errors

Examples:

- Network failure
- Backend failure

Response:

> Graceful service-unavailable state and human fallback.

---

# 28. Security

Minimum security requirements:

- API keys server-side only
- Environment variables/secrets management
- No secrets committed to Git
- Server-side validation of patient operations
- Server-side routing validation
- Input validation
- OTP verification
- Session expiration
- No unnecessary patient data in logs
- Controlled error messages
- No trust in client-generated hospital entities
- No trust in AI-generated operational IDs without validation

---

# 29. Observability

The system should provide enough telemetry to diagnose failures without logging sensitive patient information unnecessarily.

Useful events include:

```text
presence_detected
session_started
voice_started
voice_stopped
transcript_received
transcript_refined
quality_result
patient_confirmed
routing_requested
routing_validated
doctor_validated
visit_created
token_generated
tts_started
tts_completed
session_completed
session_reset
fallback_triggered
```

Logs should avoid raw patient medical information unless explicitly required and appropriately protected.

---

# 30. AI Response Contracts

AI services should return structured responses wherever possible.

Example routing contract:

```ts
interface RoutingResult {
  departmentId: string | null;
  recommendedDoctorIds: string[];
  confidence: "HIGH" | "MODERATE" | "LOW";
  rationale?: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
}
```

The exact schema may change.

The principle is:

> **AI output must have a validated contract before entering hospital operations.**

---

# 31. Provider Failure Strategy

Provider failures should not crash the kiosk workflow.

Example:

```text
Gemini unavailable
      ↓
Provider error
      ↓
Retry / alternate provider
      ↓
Manual fallback if necessary
```

Provider-specific error handling belongs inside the provider/service layer where possible.

The UI should receive normalized application-level errors.

---

# 32. Legacy Code Reuse Policy

The old Google AI Studio source code is useful engineering evidence.

Reuse is allowed when a legacy module:

1. Solves the same problem.
2. Has acceptable quality.
3. Fits the new architecture.
4. Does not force the old UX or state model into the new product.

Potentially reusable knowledge includes:

- Gemini Live audio handling
- PCM processing
- Transcript refinement
- Quality guard
- Closed-world routing
- Doctor validation
- Token generation concepts

Do not copy large legacy components simply to move faster if doing so creates architectural debt.

---

# 33. Development Strategy

Build vertically rather than implementing every subsystem independently.

Preferred sequence:

```text
Phase 1
Physical interaction shell
        ↓
Phase 2
Camera → wake → welcome
        ↓
Phase 3
Voice capture + TTS
        ↓
Phase 4
Transcript refinement + confirmation
        ↓
Phase 5
Patient identity / OTP
        ↓
Phase 6
Hospital routing
        ↓
Phase 7
Doctor selection
        ↓
Phase 8
OP visit + token
        ↓
Phase 9
Ticket / completion
        ↓
Phase 10
Hardening + physical testing
```

At each phase, maintain a working end-to-end experience.

---

# 34. MVP Acceptance Test

A complete MVP demonstration should be possible through a physical prototype:

```text
Person approaches
      ↓
Camera detects person
      ↓
Bot welcomes them
      ↓
Patient speaks in Malayalam/Manglish
      ↓
Voice captured accurately
      ↓
Transcript refined
      ↓
Symptoms/request displayed
      ↓
Patient confirms
      ↓
Patient identity handled
      ↓
Department correctly identified
      ↓
Available doctor shown
      ↓
Patient confirms
      ↓
OP token generated
      ↓
Ticket displayed
      ↓
Bot explains next step
      ↓
Session securely resets
```

The system must also demonstrate a safe path when something fails.

---

# 35. Architectural Non-Negotiables

1. **The patient experience is the primary interface.**
2. **Hospital data is authoritative.**
3. **AI recommendations require validation.**
4. **API secrets stay server-side.**
5. **Voice capture cannot be compromised by heavy UI rendering.**
6. **Every patient session is isolated.**
7. **AI failure must have a graceful fallback.**
8. **Provider integrations must be replaceable.**
9. **The UI must remain minimal and context-specific.**
10. **The physical bot is the target environment, not a desktop browser.**
11. **Dynamic AI visualizations must use controlled structured components.**
12. **The architecture must remain understandable and maintainable by the engineering team.**

---

# 36. Final Architecture Principle

The system should be thought of as:

> **A hospital workflow engine wrapped in a conversational physical interface.**

The AI provides the intelligence required to understand people.

The hospital backend provides the truth required to operate safely.

The UI provides the clarity required for patients.

The physical bot provides the presence and accessibility that make the system feel like a receptionist.

These responsibilities should remain separate even when the final product feels like one seamless experience.
