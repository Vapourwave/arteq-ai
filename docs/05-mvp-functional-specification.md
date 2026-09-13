# ARTEQ AI — MVP Functional Specification

**Document:** 05 — MVP Functional Specification  
**Product:** ARTEQ AI Portable AI Receptionist  
**Version:** 2.0  
**Status:** MVP Functional Source of Truth

---

# 1. Purpose

This document defines exactly what the first ARTEQ AI MVP must do.

The MVP is not intended to implement every possible hospital-assistance capability.

It must prove one complete, reliable patient journey:

> **A patient approaches the kiosk, speaks naturally, is understood, identified when necessary, routed to the correct hospital service, and completes the intended OP/registration flow.**

The MVP should feel like a finished product even if some advanced capabilities remain outside its scope.

---

# 2. MVP North Star

The MVP should make a patient feel that they are interacting with a calm, capable hospital receptionist rather than operating a complicated computer.

The ideal experience is:

```text
Person approaches
      ↓
Kiosk notices them
      ↓
Warm welcome
      ↓
"How can I help you?"
      ↓
Patient speaks naturally
      ↓
AI understands
      ↓
Patient confirms
      ↓
System performs validated hospital action
      ↓
Patient receives clear result
      ↓
Session resets safely
```

---

# 3. MVP Scope

The MVP includes six major capabilities:

1. Presence-aware kiosk welcome
2. Voice-first conversational assistance
3. Patient identification and selection
4. Department/doctor discovery and routing
5. OP registration / token workflow
6. Basic hospital information assistance

---

# 4. MVP Capability Map

```text
ARTEQ AI MVP
│
├── Presence
│   └── Person detection
│
├── Welcome
│   ├── Voice assistance
│   ├── Touch fallback
│   └── Existing patient entry
│
├── Voice AI
│   ├── Malayalam
│   ├── Manglish
│   ├── English
│   ├── Speech recognition
│   ├── Refinement
│   ├── Intent extraction
│   └── Confirmation
│
├── Patient
│   ├── Mobile number
│   ├── OTP
│   └── Patient selection
│
├── Hospital routing
│   ├── Department
│   ├── Doctor
│   └── Availability validation
│
├── OP workflow
│   ├── Registration
│   ├── Visit creation
│   └── Token
│
├── Information
│   ├── Doctors
│   ├── Departments
│   ├── Locations
│   ├── Timings
│   └── Queue/basic hospital information
│
└── Fallback
    ├── Repeat
    ├── Touch
    └── Receptionist
```

---

# 5. Presence Detection

The physical kiosk should detect when a person approaches.

Initial behavior:

```text
No person
    ↓
Idle state

Person detected
    ↓
Wake / transition
    ↓
Welcome
```

The detection system may initially use the webcam.

The exact computer-vision implementation is an engineering decision.

The MVP does not require facial recognition.

The system only needs to know:

> **Someone is present.**

---

# 6. Welcome Screen

The welcome screen must be minimal.

It should communicate:

- What the kiosk is
- That the patient can speak
- That help is available
- Optional touch alternatives

Example conceptual interface:

```text
        ARTEQ AI

     How can I help?

          🎙

     Speak naturally

     Existing patient?
       Enter mobile
```

Avoid unnecessary:

- Cards
- Borders
- Decorative gradients
- Excessive icons
- Large menus
- Unrelated information
- Multiple competing calls to action

---

# 7. Voice-First Interaction

The microphone is the primary interaction mechanism.

The patient should not need to learn a special command syntax.

Examples:

> "I have tooth pain."

> "Enikku tooth pain aanu."

> "എനിക്ക് പല്ലുവേദനയാണ്."

> "I want to see a dentist."

All should be interpreted naturally.

---

# 8. Voice Session

A voice session begins when:

- The patient taps the microphone, or
- The system reaches an explicitly designed voice-start state.

The session ends when:

- The patient taps Stop, or
- The application explicitly determines that the workflow has completed.

Natural pauses must not terminate the entire patient interaction.

---

# 9. Listening State

While listening:

The screen should communicate:

> **I'm listening.**

It should not display a large amount of unrelated UI.

Possible elements:

```text
Listening...

[ subtle audio visualization ]

"Speak naturally"

[ Stop ]
```

The visual feedback must remain lightweight enough not to interfere with audio capture.

---

# 10. Supported Languages

MVP language support:

### Malayalam

Primary regional language.

### Manglish

Malayalam spoken/typed using Latin characters.

### English

For patients who prefer English.

The system may automatically determine the language from speech.

The user should not be forced to manually choose a language unless necessary.

---

# 11. Transcript Pipeline

The MVP uses:

```text
Microphone
   ↓
Live speech recognition
   ↓
Raw transcript
   ↓
Transcript refinement
   ↓
Quality guard
   ↓
Intent + entity extraction
   ↓
Workflow
```

The raw transcript should be retained internally for debugging and evaluation subject to privacy requirements.

---

# 12. Symptom Extraction

When the patient's request contains symptoms, the system extracts them.

Example:

> "Enikku tooth pain aanu, dentistine kaananam."

Structured interpretation:

```json
{
  "symptoms": [
    "tooth pain"
  ],
  "request": "see doctor",
  "departmentCandidate": "dentistry"
}
```

The system must not invent symptoms that were not communicated.

---

# 13. Symptom Confirmation

Before symptom-driven routing, the system should confirm its understanding when appropriate.

Conceptually:

```text
Patient:
"Enikku tooth pain aanu."

AI:
"Are you experiencing tooth pain?"

Patient:
"Yes."
```

Malayalam equivalent should be natural and culturally appropriate.

The final wording may be generated through the approved language/TTS layer.

---

# 14. Patient Identity

When an operation requires patient identity, the system asks for the patient's mobile number.

Example:

> **"Are you an existing patient?"**

If yes:

```text
Mobile number
     ↓
OTP
     ↓
Verified
     ↓
Patients associated with number
     ↓
Patient selects themselves
```

The system must never automatically select a patient merely because multiple patient records share a phone number.

---

# 15. OTP

OTP verification is an authentication step.

The MVP should:

- Request mobile number
- Send/trigger OTP through the configured backend mechanism
- Verify OTP
- Continue only after successful verification
- Provide clear retry/error states

OTP details must never be exposed in logs or client code.

---

# 16. Patient Selection

After successful OTP verification, the backend may return the patient records associated with that verified number.

Example:

```text
Who are you?

[ Patient A ]

[ Patient B ]

[ Patient C ]
```

The patient explicitly selects their identity.

After selection:

```text
Patient selected
      ↓
Authenticated patient context
      ↓
Continue requested workflow
```

---

# 17. New Patient Flow

If the patient is not registered:

```text
New patient
    ↓
Collect required information
    ↓
Validate
    ↓
Create patient record
    ↓
Continue OP workflow
```

The exact fields must be determined by the hospital's approved registration requirements.

The AI should collect information conversationally where appropriate, but the backend validates the data.

---

# 18. Department Routing

The AI may identify a likely department.

Example:

```text
"Tooth pain"
       ↓
Dentistry
```

The backend must validate the result against the known department list.

The model must not be allowed to invent departments.

---

# 19. Closed-World Department Matching

Accepted variations may include:

```text
DENT
Dental
Dentistry
dept-dentistry
```

if they map unambiguously to the known:

```text
dept-dentistry
```

Unknown values must not create or select arbitrary departments.

If no valid match exists:

```text
Clarify
or
Safe fallback
```

---

# 20. Routing Confidence

The routing engine must distinguish:

```text
HIGH
MEDIUM
LOW
```

### HIGH

Clear patient request and valid department.

### MEDIUM

Likely department but confirmation is appropriate.

### LOW

Not enough information.

For LOW:

> "Could you tell me a little more about what you need help with?"

Do not silently route ambiguous patients to General Medicine merely because it is the default.

---

# 21. Doctor Discovery

After department selection, the system can retrieve eligible doctors.

The backend validates:

```text
Doctor exists
AND
Doctor belongs to department
AND
Doctor is currently eligible/available
```

The frontend should display only validated doctors.

---

# 22. AI Suggested Doctor

The AI may suggest a doctor based on:

- Department
- Specialty
- Patient request
- Hospital-defined rules
- Availability

The final doctor must come from trusted backend data.

Example:

```text
Dentistry

Recommended

Dr. Ananya Nair
Endodontist

[ Continue ]
```

The recommendation must never be presented as a fabricated AI-generated doctor.

---

# 23. OP Registration

The MVP must support a complete OP registration path.

Conceptually:

```text
Patient
 ↓
Reason / symptoms
 ↓
Department
 ↓
Doctor
 ↓
Patient identity
 ↓
OP visit creation
 ↓
Token generation
```

The workflow must wait for backend confirmation before telling the patient that registration succeeded.

---

# 24. Token Generation

The token is generated by the backend/hospital system.

Example:

```text
Your OP Token

DEN-101

Dentistry

Dr. Ananya Nair
```

The token must never be invented by the AI.

---

# 25. Token Confirmation

After token creation:

Voice:

> "Your Dentistry OP token is DEN-101."

Screen:

```text
       OP TOKEN

        DEN-101

     Dentistry

   Dr. Ananya Nair

   Please proceed
```

The exact presentation depends on the hospital workflow.

---

# 26. Basic Hospital Information

The MVP may answer common informational questions.

Examples:

### Department

> "Where is Orthopedics?"

### Doctor

> "Which doctors are available in Dentistry?"

### Timings

> "When does OP start?"

### Queue

> "How many patients are waiting?"

### General information

> "How do I register for OP?"

These answers must use trusted hospital data.

---

# 27. Dynamic Visualizations

Dynamic visualization is part of the product direction but should remain controlled.

When a spoken response benefits from visual information, the screen can show it simultaneously.

Example:

Patient:

> "Which dentists are available?"

Voice:

> "There are three dentists available."

Screen:

```text
Dentistry

Dr. A
Endodontist
Available

Dr. B
Orthodontist
Available

Dr. C
General Dentistry
Available
```

The visual component should be selected from an approved component library.

AI must not generate arbitrary UI code.

---

# 28. Visualization Types for MVP

Initial approved types may include:

```text
DoctorList
DepartmentList
DoctorDetail
DepartmentDetail
QueueStatus
HospitalInfo
LocationInfo
TokenCard
Confirmation
```

More advanced visualization types can be added after the core MVP is stable.

---

# 29. Touch Interaction

Touch is the fallback and confirmation mechanism.

Touch should be used for:

- Selecting a patient
- Confirming a department
- Selecting a doctor
- Correcting AI misunderstanding
- Entering a mobile number
- Entering OTP
- Repeating a request
- Calling a receptionist

The patient should not be forced to navigate a complex menu hierarchy.

---

# 30. Human Fallback

The kiosk must always provide a path to a human.

Possible option:

> **Ask Receptionist**

Fallback should be available when:

- AI cannot understand
- Voice fails
- Patient requests human help
- Backend is unavailable
- Authentication repeatedly fails
- The request is outside MVP scope

---

# 31. Failure States

The MVP must gracefully handle:

### Microphone unavailable

Provide touch fallback.

### Speech recognition failure

Ask the patient to try again.

### AI failure

Show a simple retry state.

### Network failure

Explain that the service is temporarily unavailable and offer human assistance.

### Backend failure

Do not claim the operation succeeded.

### OTP failure

Allow retry without losing the entire workflow.

### Invalid department

Ask for clarification.

---

# 32. Session Reset

After completing or abandoning a workflow:

```text
Clear transcript
Clear patient context
Clear OTP state
Clear selected patient
Clear department
Clear doctor
Clear token state
Clear AI conversation context
Clear visualization
Return to Welcome
```

The next patient must start from a clean state.

---

# 33. Session Timeout

If the patient walks away:

```text
Active session
    ↓
No interaction
    ↓
Timeout
    ↓
Clear sensitive state
    ↓
Return to Welcome
```

The timeout duration is an implementation parameter and should be configurable.

---

# 34. Privacy

The MVP must avoid exposing sensitive patient information unnecessarily.

Examples:

- Do not display patient information on the welcome screen.
- Do not retain previous patient's information after reset.
- Do not expose OTP values.
- Do not log unnecessary medical details.
- Do not display another patient's records without authentication and explicit selection.

---

# 35. MVP Data Authority

The hierarchy is:

```text
Hospital backend/database
        ↓
Application logic
        ↓
AI interpretation
        ↓
Patient-facing response
```

AI is not the source of truth.

---

# 36. MVP Non-Goals

The following are explicitly outside the first MVP unless required by the deployment partner:

- Full electronic medical record system
- Clinical diagnosis
- Medication prescribing
- Clinical decision support
- Facial recognition
- Autonomous medical triage
- Complex hospital navigation
- Advanced analytics dashboards
- Arbitrary AI-generated UI
- Fully autonomous robotic movement
- Multi-hospital federation
- Large-scale appointment marketplace
- Advanced patient history analysis

These may become future product capabilities.

---

# 37. Post-MVP Roadmap

After the core MVP works reliably:

### Phase 2

- Rich dynamic visualizations
- Better hospital navigation
- More hospital information
- Queue intelligence
- Additional languages
- More sophisticated patient assistance

### Phase 3

- Production hardware enclosure
- Better camera/person detection
- Improved microphone array
- Printer integration
- Accessibility improvements
- Hospital-system integrations

### Phase 4

- Multi-hospital deployment
- Centralized administration
- Analytics
- Fleet management
- Remote monitoring
- Model evaluation infrastructure

---

# 38. MVP Acceptance Criteria

The MVP is considered functionally successful when a real user can complete the following without developer assistance:

### Scenario 1 — Dentistry

```text
Patient approaches
 ↓
Welcome
 ↓
Speaks Malayalam/Manglish/English
 ↓
System understands tooth pain
 ↓
Patient confirms
 ↓
Dentistry selected
 ↓
Doctor retrieved
 ↓
Patient identified
 ↓
OP visit created
 ↓
Token generated
 ↓
Patient receives token
```

### Scenario 2 — Ambiguous request

```text
"I don't feel well."
 ↓
LOW confidence
 ↓
Clarification question
 ↓
Patient explains
 ↓
System continues
```

### Scenario 3 — Information query

```text
"Which doctors are available in Dentistry?"
 ↓
Backend retrieves doctors
 ↓
Voice answer
 +
Visual doctor list
```

### Scenario 4 — AI failure

```text
Voice failure
 ↓
Patient sees retry
 ↓
Touch fallback available
 ↓
Human fallback available
```

---

# 39. Quality Bar

The MVP must not be considered complete merely because:

```text
npm run build
```

passes.

Completion requires:

- Functional tests
- Malayalam voice tests
- Manglish voice tests
- English voice tests
- Natural-pause tests
- Routing tests
- Ambiguity tests
- Patient identity tests
- OTP tests
- Doctor validation tests
- Token tests
- Session-reset tests
- Network-failure tests
- Real-device usability tests

---

# 40. Golden End-to-End Test

The primary demonstration scenario should be:

Patient says:

> **"എനിക്ക് പല്ലുവേദനയാണ്, ഡോക്ടറെ കാണണം."**

Expected:

```text
Speech
 ↓
Accurate Malayalam transcript
 ↓
Symptom = tooth pain
 ↓
Intent = see doctor
 ↓
Department = Dentistry
 ↓
Patient confirmation
 ↓
Patient authentication
 ↓
Dentistry doctors retrieved
 ↓
Valid doctor selected
 ↓
OP visit created
 ↓
Token generated
 ↓
Voice + visual confirmation
```

The same scenario must work in Manglish:

> **"Enikku tooth pain aanu, dentistine kaananam."**

and English:

> **"I have tooth pain and I want to see a dentist."**

---

# 41. MVP Engineering Rule

Every feature should answer:

> **Does this improve the patient's ability to complete the hospital task safely and easily?**

If not, it does not belong in the MVP.

---

# 42. Final Product Principle

The MVP should not feel like a prototype with AI attached.

It should feel like:

> **a simple hospital receptionist that happens to be powered by AI.**

The technology should disappear behind the interaction.

The patient should not need to understand:

- Gemini
- Sarvam
- APIs
- models
- routing logic
- databases
- WebSockets
- prompts
- computer vision

They should only need to know:

> **"I can walk up and ask for help."**

---

# 43. Definition of Done

The MVP is done when:

1. A person can approach the physical kiosk.
2. The kiosk recognizes presence.
3. The welcome interaction is immediate and understandable.
4. The patient can speak naturally.
5. Malayalam, Manglish, and English work reliably.
6. Audio remains stable during long speech and natural pauses.
7. The system accurately extracts the patient's request.
8. Symptoms can be confirmed.
9. Existing patients can authenticate using mobile + OTP.
10. Patients can select the correct patient record.
11. Departments are validated against trusted hospital data.
12. Doctors are validated against trusted hospital data.
13. OP registration can complete successfully.
14. A real backend token is generated.
15. The token is clearly communicated.
16. Hospital information queries can be answered from trusted data.
17. Useful answers can appear visually and audibly.
18. AI failures have graceful fallbacks.
19. Sensitive session data is cleared between patients.
20. The complete experience works on the intended kiosk hardware.

---

# 44. North-Star Statement

> **ARTEQ AI MVP turns a hospital visit into a conversation.**

The patient speaks.

ARTEQ understands.

The system verifies.

The patient confirms.

The hospital system executes.

The patient leaves knowing exactly what to do next.
