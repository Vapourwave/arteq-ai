# ARTEQ AI — Product Brief

**Document:** 01 — Product Brief  
**Product:** ARTEQ AI Portable AI Receptionist  
**Status:** Source of Truth for Product Direction  
**Version:** 2.0  
**Implementation Strategy:** New product implementation from scratch  
**Legacy Reference:** Google AI Studio MVP

---

## 1. Product Vision

ARTEQ AI is a **portable, physical AI receptionist for hospitals**.

The product combines a camera, touchscreen, microphone, speaker, cloud-based AI services, hospital-specific operational data, voice-first multilingual interaction, patient self-service workflows, and human/receptionist fallback.

The product is **not a conventional hospital kiosk**. The intended experience is that a patient approaches an intelligent receptionist.

The core interaction is:

> **Patient approaches → system notices them → system welcomes them → patient speaks → AI understands → system helps them complete the required task.**

The touchscreen is an interaction surface, not the product itself.

---

## 2. Business Context

ARTEQ AI is being developed as an MVP intended for presentation and initial deployment in a **government hospital environment**.

The MVP should look and behave like a credible final product rather than an experimental AI demo.

It should be professional, reliable, minimal, accessible, multilingual, fast, suitable for a public hospital, and designed for eventual physical deployment.

The initial implementation may be cloud-based and API-driven while remaining compatible with a portable physical bot.

---

## 3. Core Product Experience

When a person is detected near the device:

1. The camera detects presence.
2. The system activates the interaction experience.
3. The bot welcomes the patient.
4. The system asks how it can help.
5. The patient speaks naturally.
6. Speech is transcribed.
7. The transcript is refined without changing meaning.
8. The system checks whether the request is sufficiently clear.
9. AI determines the required hospital operation.
10. Important information is confirmed when necessary.
11. The hospital operation is performed.
12. Relevant information is shown visually.
13. Useful responses are spoken through the speaker.
14. The interaction ends cleanly and the system becomes ready for the next patient.

The system should not force patients through unnecessary menus when conversation can accomplish the same task naturally.

---

## 4. MVP Primary Use Case — OP Registration

The first major operational capability is **patient OP registration and OP ticket generation**.

Typical flow:

```text
Patient approaches bot
        ↓
Welcome
        ↓
"What can I help you with?"
        ↓
Patient explains their need
        ↓
AI understands request
        ↓
Patient identity / registration
        ↓
Hospital department determination
        ↓
Doctor availability / selection where applicable
        ↓
Patient confirmation
        ↓
OP token generation
        ↓
Ticket / visit information displayed
        ↓
Patient proceeds to the appropriate service
```

The patient should not need to understand the internal workflow.

---

## 5. Patient Identity Flow

The system supports both new and existing patients.

### Existing Patient

The intended flow may use the registered mobile number and OTP verification.

After verification:

1. Retrieve patients associated with that verified mobile number.
2. Display the relevant patient profiles.
3. Patient selects the correct profile.
4. That patient becomes active for the current session.
5. Continue to the assistance/request flow.

Other patients' information must not be unnecessarily exposed.

### New Patient

A new patient should be able to register through a simple accessible interaction and only provide information required by the MVP and hospital requirements.

---

## 6. Voice-First Interaction

Voice is a primary interaction method.

The product must support:

- English
- Malayalam
- Manglish
- Natural mixed-language speech

Patients should be able to speak naturally, for example:

> "Enikku tooth pain aanu, dentistine kaananam."

or:

> "എനിക്ക് പല്ലുവേദനയാണ്, ഡോക്ടറെ കാണണം."

The system must preserve meaning while transforming raw speech transcription into usable routing language.

---

## 7. Transcript Pipeline

```text
Microphone
    ↓
Live speech recognition
    ↓
Raw transcript
    ↓
Transcript refinement
    ↓
Transcript quality guard
    ↓
Patient confirmation / clarification
    ↓
Approved request
    ↓
Routing / operation
```

The system must distinguish between:

- What the patient said
- What speech recognition produced
- What refinement interpreted
- What routing inferred

These stages must not be silently collapsed into one uncontrolled AI decision.

---

## 8. Patient Confirmation

After extracting the patient's stated issues or request, the system should confirm its understanding naturally.

For example:

> "Are these the issues you are dealing with?"

Malayalam may use wording such as:

> "ഈ ബുദ്ധിമുട്ടുകളാണോ നിങ്ങൾ അനുഭവിക്കുന്നത്?"

The exact confirmation speech may be produced by the selected TTS provider, including Sarvam AI where appropriate.

This is **confirmation of understanding, not diagnosis**. The patient must be able to correct the system.

---

## 9. AI Routing Philosophy

The AI is an **administrative interpretation and routing system**, not a doctor.

It may understand requests, match them to configured hospital departments, recommend relevant available doctors, ask for clarification, and explain administrative information.

It must not diagnose diseases, prescribe treatment, invent medical conditions, invent departments/doctors/services, or make unsupported emergency medical judgments.

Routing must remain constrained by configured hospital data.

---

## 10. Closed-World Hospital Data

Hospital operational decisions must be grounded in configured data such as:

- Departments
- Doctors
- Doctor availability
- Rooms
- OP services
- Queue information
- Hospital information
- Registration data

AI-generated entities must never automatically become authoritative hospital entities.

If an AI recommendation cannot be matched to configured data, the system should reject or neutralize it, request clarification or provide a safe manual path, and never silently create a fictional entity.

---

## 11. Human Fallback

A clear fallback such as **Ask Receptionist** should be available when speech recognition repeatedly fails, the request is ambiguous, the patient wants assistance, an AI service is unavailable, hospital data is insufficient, or self-service cannot be completed.

AI should assist hospital staff, not eliminate human control.

---

## 12. Dynamic Visual Interaction

The touchscreen should not merely display static forms.

When the AI speaks or responds, the screen should show information that helps the patient understand the interaction.

For example, a spoken doctor-availability answer can be paired with a visual list of doctors, rooms, and availability.

For department information, the system may show department name, location, room, doctors, or other useful administrative information.

If a visual representation improves comprehension, show it. If it does not, keep the screen quiet.

Rich dynamic visualizations for arbitrary hospital questions are a **post-MVP expansion area** unless required for the initial demonstration.

---

## 13. UI Philosophy

The interface must intentionally avoid the visual language of generic AI-generated dashboards.

### Core principles

- Minimal
- Calm
- Spacious
- Highly readable
- Purposeful typography
- Strong hierarchy
- Few elements per screen
- Clear actions
- Consistent visual language
- Touch-friendly
- Accessible from a standing position

### Avoid

- Excessive rounded cards
- Borders around every element
- Decorative containers
- Unnecessary pills
- Excessive gradients
- Random color combinations
- Excessive shadows
- Visually unrelated accent colors
- Dense dashboards
- Decorative AI imagery
- Information irrelevant to the current interaction

A screen should contain **only what the patient needs at that moment**.

During voice interaction especially, unnecessary UI should disappear.

---

## 14. Camera Interaction

The camera provides the physical interaction trigger.

```text
No person
    ↓
Idle state

Person approaches
    ↓
Presence detected

System wakes
    ↓
Welcome

Patient interacts
    ↓
Conversation begins
```

The camera should not identify a person beyond what is required for explicitly approved functionality.

Privacy is a first-class requirement.

---

## 15. Physical Product Direction

The MVP should be designed for a **portable physical bot** containing approximately:

- Touchscreen
- Webcam/camera
- Microphone
- Speaker
- Compute device
- Network connectivity
- Power solution
- Physical enclosure

Software should avoid assumptions that only make sense in a desktop browser.

The UI must account for touch interaction, camera distance, speaker volume, microphone pickup, screen visibility, public-space use, session reset, and physical idle/wake states.

---

## 16. Cloud Architecture Direction

The initial MVP may operate through cloud APIs using secured credentials.

External AI providers must be kept behind service boundaries.

Potential providers include:

- Gemini
- Sarvam AI
- Other specialized services where justified

Provider-specific code should not be scattered throughout the application.

```text
Application
    ↓
Voice / AI Service
    ↓
Provider Adapter
    ↓
Sarvam / Gemini / Other
```

This allows providers to change without rewriting the product.

**API keys must never be embedded in frontend source code or committed to the repository.**

---

## 17. Reliability Requirements

Every major AI-dependent operation should have an appropriate fallback.

```text
Voice AI unavailable
        ↓
Text / manual interaction

Routing AI unavailable
        ↓
Configured manual department selection

AI recommendation uncertain
        ↓
Clarification / human fallback

Network unavailable
        ↓
Graceful error state where supported
```

Patients should receive clear explanations rather than broken interfaces.

---

## 18. Privacy and Session Isolation

The bot is a shared public device.

After a patient completes or abandons an interaction, the session must reset.

Temporary data that may need clearing includes:

- Patient identity
- Phone number
- OTP state
- Transcript
- Voice state
- AI request
- Routing state
- Selected doctor
- Token information
- Temporary UI state

Timeouts and explicit completion should both trigger cleanup.

---

## 19. MVP Scope

### In MVP

- Physical-bot-oriented interaction model
- Camera/presence detection
- Welcome interaction
- Voice-first patient interaction
- Malayalam / Manglish / English
- Patient registration
- Existing patient lookup
- OTP verification
- Patient selection
- Service/request understanding
- Transcript refinement
- Request confirmation
- Department routing
- Doctor availability
- Patient confirmation
- OP token generation
- OP ticket / visit information
- Human fallback
- Privacy/session reset
- Professional touchscreen UI

### After MVP

- Rich dynamic visualizations for arbitrary hospital questions
- Advanced hospital information assistant
- Navigation assistance
- Queue visualization
- Multilingual conversational TTS refinement
- Additional hospital workflows
- Deeper physical robotics
- Advanced computer vision
- Offline/edge AI capabilities

---

## 20. Legacy AI Studio MVP

The previous Google AI Studio application is a **reference implementation, not the foundation of the new product**.

It demonstrated valuable capabilities including:

- Gemini Live voice capture
- Malayalam/Manglish transcription
- Transcript refinement
- Transcript quality checking
- AI hospital routing
- Closed-world department validation
- Doctor validation
- Token generation
- OP ticket generation
- Patient kiosk concepts

These proven components and lessons may be selectively reused when they satisfy the new architecture.

The following must **not** be inherited merely because they already exist:

- Existing user flow
- Existing kiosk navigation
- Existing UI structure
- Existing component architecture
- Existing assumptions about patient interaction

The new product is designed around the **Portable AI Receptionist vision first**.

The legacy MVP exists to provide engineering evidence and reusable knowledge.

---

## 21. Product Success Criteria

The MVP is successful when a patient can approach the physical prototype and intuitively understand what to do without staff explaining the interface.

The ideal experience is:

> **Approach → Welcome → Speak → Understand → Confirm → Complete.**

The interaction should feel:

- Natural rather than form-driven
- Helpful rather than technical
- Calm rather than visually noisy
- Intelligent without pretending to be a doctor
- Fast without feeling rushed
- Professional enough for a government hospital
- Reliable enough for real patient interaction

---

## 22. Product Principle

> **The patient should interact with the hospital, not with the software.**

The AI, UI, camera, microphone, routing engine, database, and hardware are implementation details.

The patient should experience one coherent receptionist.

---

## 23. Design North Star

When deciding between implementations, prefer the one that:

1. Reduces patient effort.
2. Reduces unnecessary screen complexity.
3. Preserves patient control.
4. Improves clarity.
5. Uses AI only where it adds meaningful value.
6. Keeps hospital operations authoritative.
7. Fails safely.
8. Works naturally with voice.
9. Works naturally on a physical touchscreen.
10. Can be understood by a patient who has never seen the system before.

**The goal is not to build an impressive AI demo.**

**The goal is to build a trustworthy AI receptionist.**
