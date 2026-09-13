# ARTEQ AI — Claude Code Operating Instructions

> **This file is the engineering constitution for the ARTEQ AI repository.**
>
> Before writing code, understand this file and the six documents in `docs/`.
> Treat them as a unified product specification.

---

# 1. What You Are Building

ARTEQ AI is a **portable AI receptionist for hospitals**.

It is not merely a chatbot, website, or voice assistant.

The physical product is a kiosk/bot with:

- Webcam
- Touchscreen
- Microphone
- Speaker
- Compute device
- Internet connection
- Cloud backend
- AI services
- Hospital data/workflows

The product goal is simple:

> **A patient approaches, speaks naturally, and ARTEQ helps them complete the hospital task.**

The technology must disappear behind the experience.

---

# 2. Source-of-Truth Documents

Read these before making architectural or product decisions:

```text
docs/
├── 01-product-vision.md
├── 02-system-architecture.md
├── 03-ux-interaction-flow.md
├── 04-ai-voice-multilingual.md
├── 05-mvp-functional-specification.md
└── 06-hardware-deployment-specification.md
```

Priority order:

```text
CLAUDE.md
   ↓
Product/architecture documents
   ↓
Approved repository code
   ↓
Implementation details
```

If existing code conflicts with the documents, **do not blindly preserve the old implementation**.

First determine whether the old code represents:

- a reusable implementation,
- an obsolete prototype,
- or a behavior that must be redesigned.

---

# 3. Critical Context

This project evolved from an earlier AI Studio/vibe-coded prototype.

The old source code may contain useful working implementations, especially around:

- Gemini Live voice
- audio capture
- transcript processing
- routing
- hospital data
- token integration

However:

> **The old application's user flow is not the product specification.**

The CEO's current vision is the source of truth.

Reuse proven technical components where they are architecturally sound.

Do not inherit obsolete UX or architecture simply because it already exists.

---

# 4. Product North Star

The ideal patient experience is:

```text
Person approaches
      ↓
Presence detected
      ↓
Warm welcome
      ↓
"How can I help you?"
      ↓
Patient speaks naturally
      ↓
ARTEQ understands
      ↓
Patient confirms
      ↓
System validates
      ↓
Hospital workflow executes
      ↓
Clear result
      ↓
Session resets
```

The patient should never need to understand:

- AI models
- prompts
- APIs
- routing logic
- WebSockets
- databases
- providers
- computer vision

They should only understand:

> **"I can walk up and ask for help."**

---

# 5. Core Engineering Philosophy

## 5.1 Reliability before intelligence

Prioritize:

```text
Reliability
  >
Safety
  >
Simplicity
  >
User experience
  >
Latency
  >
Model sophistication
```

An intelligent system that fails unpredictably is worse than a simpler system that behaves consistently.

---

## 5.2 Backend is the authority

AI interprets.

The backend decides.

The hierarchy is:

```text
Trusted hospital data
        ↓
Backend/application logic
        ↓
AI interpretation
        ↓
Patient-facing response
```

Never allow an LLM to invent:

- Departments
- Doctors
- Tokens
- Patient records
- OP registrations
- Hospital facts
- Availability

AI suggestions must be validated against trusted backend data.

---

## 5.3 Closed-world by default

Whenever AI proposes an entity, validate it.

Examples:

```text
AI → "DENT"
AI → "Dental"
AI → "Dentistry"
```

may map to:

```text
dept-dentistry
```

if the mapping is unambiguous.

But:

```text
AI → "Neuro Healing Department"
```

must not create a department that does not exist.

Unknown or ambiguous results should lead to:

- clarification,
- safe fallback,
- or human assistance.

---

# 6. Voice Is a Critical Path

Voice interaction is not a decorative feature.

It is one of the primary product interfaces.

Architecture:

```text
Patient speech
      ↓
Microphone
      ↓
Audio capture
      ↓
Voice service
      ↓
AI/live transcription
      ↓
Raw transcript
      ↓
Refinement
      ↓
Quality guard
      ↓
Intent/entities
      ↓
Workflow
```

---

# 7. Never Block Audio With UI Rendering

This is a known architectural failure from the previous prototype.

The previous kiosk suffered audio degradation because high-frequency transcript state updates caused heavy React renders, starving `ScriptProcessorNode` audio callbacks.

Therefore:

> **The audio pipeline and large UI render tree must remain decoupled.**

Rules:

- Never update a massive parent component 5–10 times per second merely to display transcript chunks.
- Prefer refs for high-frequency mutable audio/transcript state.
- Isolate live transcript rendering into a small component.
- Avoid unnecessary state updates during recording.
- Do not introduce heavy synchronous work into audio callbacks.
- Preserve continuous audio capture.
- Test natural pauses and long speech.

If a proposed UI change could affect audio timing, treat it as a critical-path change.

---

# 8. Voice Provider Abstraction

Do not couple the entire application directly to one AI provider.

Use provider boundaries where practical:

```text
VoiceProvider
├── Gemini Live
└── Future provider

TTSProvider
├── Sarvam
└── Future provider

AIReasoningProvider
├── Approved model
└── Future model
```

Provider changes should not require rewriting the kiosk UX.

---

# 9. Sarvam AI

Sarvam may be used for Indian-language functionality, especially TTS or language-specific voice output.

Its role must remain behind an abstraction.

Do not scatter Sarvam-specific API calls throughout UI components.

Use:

```text
UI
 ↓
Application service
 ↓
TTS/voice abstraction
 ↓
Sarvam adapter
```

API keys must remain server-side.

Never commit the user's provided Sarvam API key or any other secret to the repository.

If a key has ever been exposed in source/chat/build output, treat it as compromised and recommend rotation.

---

# 10. Model Independence

Do not hard-code a model name throughout the codebase.

Use configuration.

Example conceptual structure:

```text
AI_CONFIG
├── voiceModel
├── refinementModel
├── routingModel
├── qualityModel
└── ttsProvider
```

Each model should have one clear responsibility.

A model becoming unavailable must not silently break the entire product.

---

# 11. Model Failures

External AI services can:

- become unavailable,
- change model names,
- return 404,
- rate-limit,
- timeout,
- change behavior.

Therefore:

- Detect provider errors explicitly.
- Log operationally useful error codes.
- Provide graceful fallback.
- Never fabricate success.
- Never tell the patient an operation succeeded unless the backend confirmed it.

---

# 12. Patient Safety

This is a hospital product.

The AI is not a doctor.

Do not present:

- diagnosis,
- medical certainty,
- treatment recommendations,
- medication instructions,

unless explicitly supported by an approved clinical workflow.

The MVP primarily handles:

- reception
- information
- department routing
- doctor discovery
- patient identification
- OP registration
- token generation

When a request exceeds the system's scope:

> **Escalate to a human.**

---

# 13. Patient Identity

Patient identity is sensitive.

Existing patient flow:

```text
Mobile number
      ↓
OTP
      ↓
Verified
      ↓
List of patients associated with number
      ↓
Patient explicitly selects themselves
```

Never automatically select a patient if multiple records exist.

Never expose another patient's data.

Clear patient context when the session ends.

---

# 14. OP / Token Authority

The AI may recommend.

The backend executes.

Correct flow:

```text
AI recommends department
        ↓
Backend validates department
        ↓
Backend retrieves doctors
        ↓
Backend validates doctor
        ↓
Backend creates OP visit
        ↓
Backend generates token
        ↓
Frontend displays confirmed result
```

Never generate fake tokens in the UI.

Never claim an OP registration succeeded without backend confirmation.

---

# 15. Routing

Routing must support:

- Malayalam
- Manglish
- English
- natural phrasing
- synonyms
- abbreviated department identifiers

But routing remains closed-world.

For example:

```text
"tooth pain"
"palluvedana"
"dentistine kaananam"
"dentist"
"dental"
```

may all lead toward Dentistry.

The backend must ultimately validate:

```text
dept-dentistry
```

---

# 16. Routing Confidence

Routing must expose confidence.

```text
HIGH
MEDIUM
LOW
```

Low confidence should trigger clarification.

Example:

> "Could you tell me a little more about what you need help with?"

Do not automatically route every vague request to General Medicine merely because it is the default.

---

# 17. UI Philosophy

The interface must be **minimal, calm, and purposeful**.

The product should deliberately avoid the visual style of generic AI-generated interfaces.

Do not default to:

- rounded cards everywhere
- excessive pill buttons
- gradients
- random color combinations
- thick borders
- decorative containers
- excessive shadows
- dashboard-like layouts
- unnecessary icons
- dense information
- persistent clutter

A border must have a reason.

A color must have a reason.

A card must have a reason.

A component should exist because it helps the patient.

---

# 18. Contextual UI

When the patient is speaking:

> **Show only what helps them speak.**

Do not keep unrelated hospital information, menus, statistics, or decorative content on the screen.

When the patient asks for doctors:

> Show doctors.

When the patient confirms a department:

> Show the confirmation.

When the patient receives a token:

> Show the token prominently.

The UI should adapt to the current task.

---

# 19. Dynamic Visualization

When an AI response benefits from visual information, the screen may show a synchronized visualization.

Examples:

```text
"Which dentists are available?"
        ↓
Voice response
+
Doctor list visualization
```

```text
"Where is Orthopedics?"
        ↓
Voice response
+
Department/location visualization
```

Approved visualization components should be deterministic.

Do **not** allow the LLM to generate arbitrary frontend code.

Conceptual visualization library:

```text
DoctorList
DoctorDetail
DepartmentList
DepartmentDetail
QueueStatus
HospitalInfo
LocationInfo
TokenCard
Confirmation
```

---

# 20. Touch Is a Fallback, Not the Main Character

Voice should be the natural interaction.

Touch should support:

- confirmation
- patient selection
- mobile number
- OTP
- doctor selection
- correction
- retry
- human assistance

Do not turn the kiosk into a giant touchscreen menu.

---

# 21. Physical Kiosk

The application must eventually run as an appliance.

Expected hardware:

```text
Webcam
Touchscreen
Microphone
Speaker
Compute device
Internet
```

The application should support kiosk mode.

Patients must not see:

- browser tabs
- address bar
- developer tools
- OS desktop
- unrelated notifications
- other applications

---

# 22. Presence Detection

Presence detection means:

> **Someone is here.**

It does not mean:

> **Identify who this person is.**

Do not implement facial recognition unless explicitly required and separately approved.

The camera should initially be used for presence detection.

---

# 23. Session Lifecycle

Every patient interaction is isolated.

```text
WELCOME
   ↓
ACTIVE SESSION
   ↓
WORKFLOW
   ↓
COMPLETED / CANCELLED / TIMEOUT
   ↓
RESET
   ↓
WELCOME
```

Reset all sensitive state:

- transcript
- patient
- OTP
- department
- doctor
- token
- workflow
- AI context
- visualization

A new patient must never inherit previous context.

---

# 24. Error Handling

Errors should be understandable to patients.

Bad:

> `ApiError: 404 models/...`

Good:

> "I'm having trouble connecting right now. Please try again or speak to the receptionist."

Technical details belong in logs, not the patient UI.

---

# 25. Logging

Log enough to debug.

Do not log unnecessary sensitive information.

Good:

```text
VOICE_SESSION_STARTED
ROUTING_REQUEST
ROUTING_MODEL_ERROR
DEPARTMENT_VALIDATION_FAILED
OP_REGISTRATION_SUCCESS
SESSION_RESET
```

Avoid dumping:

- full medical transcripts
- OTPs
- secrets
- unnecessary patient identifiers

unless explicitly required and properly protected.

---

# 26. Secrets

Never put secrets in:

- frontend source
- Git
- documentation
- screenshots
- test fixtures
- client-side environment variables
- generated UI

Use server-side environment configuration.

Before committing:

```text
Check for secrets.
```

---

# 27. Existing Source Code

When the repository contains the old prototype:

1. Inspect it.
2. Identify reusable components.
3. Identify architectural problems.
4. Preserve proven working functionality where appropriate.
5. Refactor rather than blindly copy.
6. Replace obsolete UX.
7. Do not let legacy component structure dictate the new architecture.

Especially inspect the previous Gemini Live implementation because it contains valuable lessons around audio continuity and render isolation.

---

# 28. Do Not Rewrite Working Systems Without Reason

Before replacing a working implementation, answer:

```text
Why is it being replaced?
What failure does the replacement solve?
What existing behavior could be lost?
How will the replacement be tested?
```

Prefer small, reversible changes.

---

# 29. Development Method

Work in phases.

Do not attempt to build the entire product in one enormous change.

Recommended order:

```text
Phase 1
Foundation + repository architecture

Phase 2
Physical kiosk shell + welcome

Phase 3
Voice capture + transcription

Phase 4
AI understanding + confirmation

Phase 5
Routing

Phase 6
Patient identity + OTP

Phase 7
OP registration + token

Phase 8
Hospital information

Phase 9
Dynamic visualizations

Phase 10
Hardware integration + deployment hardening
```

Each phase must have a clear acceptance test.

---

# 30. Before Coding

For every non-trivial task:

1. Read the relevant documentation.
2. Inspect the existing implementation.
3. Identify dependencies.
4. Identify potential regressions.
5. State the implementation plan.
6. Make the smallest coherent change.
7. Run relevant tests.
8. Inspect the resulting behavior.
9. Fix regressions.
10. Only then continue.

Do not code from assumptions.

---

# 31. Continuous Iteration

You are expected to iterate.

For each implementation:

```text
Implement
   ↓
Run
   ↓
Observe
   ↓
Measure
   ↓
Reason
   ↓
Improve
   ↓
Test again
   ↓
Repeat
```

Do not stop after the first technically successful implementation if the behavior is visibly poor.

However:

> **Iteration must converge toward the documented product, not become endless scope expansion.**

Improve the current objective before adding new objectives.

---

# 32. UI Iteration Loop

For visual work:

```text
Build
 ↓
Run in browser
 ↓
Inspect actual screen
 ↓
Compare with UX specification
 ↓
Identify clutter / hierarchy problems
 ↓
Simplify
 ↓
Repeat
```

The question is not:

> "Does this look impressive?"

The question is:

> "Would a patient immediately understand what to do?"

---

# 33. Voice Iteration Loop

For voice work:

Test:

- Malayalam
- Manglish
- English
- long speech
- natural pauses
- mid-sentence pauses
- background noise
- repeated phrases
- accents
- transcription errors

Do not judge voice performance from a single successful recording.

---

# 34. Golden Voice Tests

At minimum:

### Malayalam

> "എനിക്ക് പല്ലുവേദനയാണ്, ഡോക്ടറെ കാണണം."

Expected semantic result:

```text
Symptom: tooth pain
Department: Dentistry
Intent: see doctor
```

### Manglish

> "Enikku tooth pain aanu, dentistine kaananam."

Expected:

```text
Symptom: tooth pain
Department: Dentistry
Intent: see doctor
```

### English

> "I have tooth pain and I want to see a dentist."

Expected:

```text
Symptom: tooth pain
Department: Dentistry
Intent: see doctor
```

---

# 35. Ambiguity Test

Input:

> "I don't feel well."

Expected:

```text
routingConfidence: LOW
needsClarification: true
```

The system should ask for more information.

It should not randomly select a department.

---

# 36. Routing Tests

Test variations such as:

```text
DENT
Dental
Dentistry
Dentist
palluvedana
tooth pain
dentistine kaananam
```

All should map correctly when the backend has Dentistry configured.

Also test invalid department names and ensure they cannot escape the closed-world validation.

---

# 37. Build and Type Safety

Before considering an implementation complete:

```text
npm run build
```

must pass.

If TypeScript is used:

```text
tsc --noEmit
```

or the repository's configured typecheck command must pass.

Lint must pass where configured.

---

# 38. Testing Standard

A feature is not done because it compiles.

Definition of done:

```text
Build
+
Lint/typecheck
+
Relevant automated tests
+
Manual behavioral verification
+
Regression check
```

For voice/hardware features, real-device testing is required before production claims.

---

# 39. Do Not Fake Verification

Never report:

> "Tested successfully"

unless you actually executed the test.

Never claim:

- a model works,
- an API works,
- hardware works,
- a token was generated,
- a patient was registered,

without evidence.

If something cannot be tested in the current environment, state that clearly.

---

# 40. Documentation Discipline

When architecture changes materially:

Update the relevant documentation.

When a decision is intentionally changed:

Record:

```text
What changed
Why
Impact
```

Do not let the code silently diverge from the product documents.

---

# 41. Scope Control

Before adding a feature ask:

1. Is it required for the MVP?
2. Is it in the functional specification?
3. Does it support the core patient journey?
4. Does it introduce significant complexity?
5. Can it wait until post-MVP?

If it can wait, defer it.

---

# 42. No Generic AI Features

Do not add generic features just because an LLM can do them.

Examples:

- random chatbot modes
- unnecessary AI summaries
- decorative AI animations
- AI-generated dashboards
- arbitrary conversational personas
- irrelevant personalization

Every AI capability must serve a hospital task.

---

# 43. UX Anti-Patterns

Avoid:

```text
Card
 └── Card
      └── Card
           └── Button
```

Avoid:

```text
Gradient background
+
Glassmorphism
+
Huge rounded container
+
Multiple colored pills
+
Floating AI orb
```

unless there is a compelling product reason.

The ARTEQ visual language should be calm and intentional.

---

# 44. Patient-First Copy

Patient-facing language should be:

- short
- natural
- reassuring
- understandable
- multilingual when appropriate

Avoid technical language.

Avoid unnecessarily formal AI phrasing.

Prefer:

> "How can I help you?"

over:

> "Please select an intent from the following available service categories."

---

# 45. AI Response Length

Voice responses should normally be concise.

The patient is standing in front of a kiosk.

Do not make the AI deliver essays.

Prefer:

> "Dentistry is on the first floor. I can also show you the available dentists."

Not:

> "Based on the hospital information available to me, I would like to inform you that..."

---

# 46. Current Product Direction

The immediate goal is not to build every possible hospital assistant feature.

The immediate goal is:

> **Build one exceptionally reliable patient journey on a physical device.**

The first impressive demo should be end-to-end, not feature-heavy.

---

# 47. Recommended First Demonstration

The canonical demonstration:

```text
Person approaches
      ↓
Welcome
      ↓
Patient speaks Malayalam
      ↓
"എനിക്ക് പല്ലുവേദനയാണ്..."
      ↓
AI understands
      ↓
Symptoms confirmed
      ↓
Patient authenticated
      ↓
Dentistry
      ↓
Doctor
      ↓
OP
      ↓
Token
      ↓
Voice + visual confirmation
```

Then demonstrate:

```text
"Which dentists are available?"
```

and show:

```text
Voice answer
+
DoctorList visualization
```

---

# 48. Final Engineering Rule

When uncertain, choose the implementation that is:

- simpler,
- safer,
- more testable,
- more reversible,
- less coupled,
- easier to operate in a hospital,
- and closer to the documented patient journey.

Do not choose complexity merely because it is technically impressive.

---

# 49. Final Product Rule

**Make the machine feel simple.**

Behind the screen there may be:

```text
Gemini
Sarvam
WebSockets
Audio resampling
AI routing
Hospital APIs
Authentication
Databases
Computer vision
TTS
Cloud infrastructure
```

The patient should experience none of that complexity.

They should experience:

```text
Approach
  ↓
Speak
  ↓
Be understood
  ↓
Confirm
  ↓
Get help
```

That is ARTEQ AI.

---

# 50. Claude Code Operating Contract

Before every implementation task:

```text
READ
UNDERSTAND
PLAN
IMPLEMENT
TEST
OBSERVE
REASON
IMPROVE
VERIFY
DOCUMENT
```

Never:

```text
ASSUME
CODE EVERYTHING
DECLARE SUCCESS
```

The six product documents define **what ARTEQ AI should be**.

This file defines **how you should build it**.

Build deliberately.
Validate continuously.
Protect the patient.
Keep the interface calm.
Keep the architecture clean.
And always optimize for the real hospital interaction rather than the demo.
