# ARTEQ AI — AI, Voice & Multilingual Intelligence Specification

**Document:** 04 — AI, Voice & Multilingual Intelligence  
**Product:** ARTEQ AI Portable AI Receptionist  
**Version:** 2.0  
**Status:** AI/Voice Source of Truth  
**Primary Goal:** Define how speech, language, AI reasoning, confirmation, routing, and spoken responses work together.

---

# 1. Purpose

ARTEQ AI is a conversational hospital receptionist.

The AI layer exists to understand what a patient is trying to accomplish and translate that intent into safe, structured actions.

The AI must **not** be treated as the source of truth for hospital operations.

The fundamental model is:

```text
Patient speech
     ↓
Speech capture
     ↓
Speech-to-text
     ↓
Transcript normalization/refinement
     ↓
Intent + entity extraction
     ↓
Quality/confidence validation
     ↓
Hospital-data validation
     ↓
Patient confirmation where required
     ↓
Operational action
     ↓
Human-readable response
     ↓
Voice + visual output
```

---

# 2. Core AI Philosophy

The product should use AI where AI is good:

- Understanding natural language
- Handling Malayalam/Manglish/English variation
- Extracting symptoms and intent
- Understanding incomplete or conversational requests
- Generating natural responses
- Choosing the appropriate approved visualization
- Asking useful clarification questions

The product should **not** use AI as an authority for:

- Doctor availability
- Department existence
- Room numbers
- Queue positions
- OP token numbers
- Patient identity
- Appointment/registration completion
- Hospital operational facts

Those must come from trusted application data.

---

# 3. AI Provider Abstraction

AI providers must remain replaceable.

The application architecture should not become dependent on one model provider.

Conceptually:

```text
                AI Orchestrator
                      │
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
   Voice/STT       Reasoning       TTS
   Provider A      Provider B      Provider C
```

The exact provider can change without redesigning the patient workflow.

---

# 4. Initial Provider Strategy

The project may use multiple AI providers because different models may be better suited to different tasks.

Potential roles include:

### Gemini Live

Used for:

- Real-time voice capture
- Live transcription
- Continuous speech interaction

### Gemini / Other reasoning model

Used for:

- Transcript refinement
- Intent extraction
- Routing
- Structured response generation

### Sarvam AI

May be used for:

- Malayalam-language speech generation
- Natural Malayalam spoken prompts
- Malayalam-specific voice interaction

The provider choice is an implementation decision and must remain isolated behind service interfaces.

---

# 5. Voice Capture Architecture

Voice capture must prioritize audio integrity.

The system previously demonstrated that heavy React rendering can interfere with `ScriptProcessorNode` audio processing.

Therefore:

> **Audio capture must remain isolated from high-frequency UI rendering.**

During recording:

- Audio capture must continue uninterrupted.
- Transcript accumulation should use synchronous refs/buffers.
- High-frequency transcript updates must not cause the entire kiosk workflow to render.
- Recording timers should not trigger parent-component renders.
- UI feedback should be isolated into lightweight components.

---

# 6. Audio Pipeline

The intended pipeline is:

```text
Microphone
   ↓
MediaStream
   ↓
AudioContext
   ↓
Native browser sample rate
   ↓
Resampler
   ↓
16 kHz Float32 PCM
   ↓
16-bit signed little-endian PCM
   ↓
Base64
   ↓
WebSocket
   ↓
Gemini Live
```

The system must inspect the actual runtime `AudioContext.sampleRate`.

It must never assume that requesting:

```text
16000 Hz
```

guarantees that the browser provides 16000 Hz.

---

# 7. Resampling

If the browser provides 44100 Hz or 48000 Hz audio, the service must convert it to 16000 Hz before transmission.

The output contract is:

```text
Sample rate: 16000 Hz
Encoding: PCM
Bit depth: 16-bit
Signed
Little-endian
```

The resampler must preserve continuity across audio chunks.

A chunk-by-chunk resampler must not restart its interpolation position at zero for every buffer.

Persistent state such as:

```text
resampleRemainder
lastInputSample
```

should be used where necessary to preserve continuity.

---

# 8. Voice Session Lifecycle

A voice session is explicitly controlled by the patient.

```text
START
 ↓
CAPTURE
 ↓
LISTEN
 ↓
ACCUMULATE TRANSCRIPT
 ↓
STOP
 ↓
FLUSH
 ↓
FINAL TRANSCRIPT
```

A natural pause in speech must **not** automatically end the patient's interaction.

Gemini may internally identify turns, but the kiosk's recording session is controlled by the application.

---

# 9. Turn Completion

The application should distinguish:

### AI turn boundary

A model-level indication that the patient paused or completed a conversational turn.

### Application recording session

The period between:

```text
Patient presses Start
```

and:

```text
Patient presses Stop
```

These are not necessarily the same.

A natural mid-sentence pause must not cause the kiosk to stop listening.

---

# 10. Transcript Accumulation

Incoming transcription chunks should be accumulated without causing expensive parent renders.

Conceptually:

```ts
finalTranscriptRef.current += text;
```

The transcript should be synchronized into React state only when necessary.

Live display can be handled by a lightweight isolated component.

This preserves audio performance while maintaining patient feedback.

---

# 11. Finalization / Flush

When the patient presses Stop:

```text
Stop requested
     ↓
Short settling/flush period
     ↓
Allow in-flight transcription events
     ↓
Read final transcript
     ↓
Close voice session
     ↓
Process transcript
```

The exact flush duration should be treated as an implementation parameter and measured rather than blindly assumed.

The system should avoid destroying the WebSocket and audio stream before trailing transcription messages have had an opportunity to arrive.

---

# 12. Transcript Quality

Raw transcription should not immediately drive hospital operations.

Pipeline:

```text
Raw transcript
      ↓
Refinement
      ↓
Quality guard
      ↓
Structured understanding
```

Possible quality states:

```text
CLEAR
REVIEW
INSUFFICIENT
```

### CLEAR

The transcript appears sufficiently reliable.

### REVIEW

The system understands the likely meaning but should confirm it with the patient.

### INSUFFICIENT

The system does not have enough reliable information.

The patient should be asked to repeat or clarify.

---

# 13. Transcript Refinement

Refinement should improve readability and recover obvious transcription imperfections without changing meaning.

For example:

Input:

> "enikku tooth pain aanu dentistine kaananam"

Possible normalized understanding:

> "I have tooth pain and I want to see a dentist."

The refinement model must not invent symptoms, diagnoses, or patient intent.

The rule is:

> **Improve expression, never manufacture meaning.**

---

# 14. Malayalam / Manglish / English

The system must treat multilingual input as a first-class requirement.

Supported forms include:

### Malayalam

> "എനിക്ക് പല്ലുവേദനയാണ്."

### Manglish

> "Enikku pallu vedana aanu."

### English

> "I have tooth pain."

### Mixed

> "Enikku tooth pain aanu, dentistine kaananam."

The system should understand the semantic meaning rather than requiring a specific language or spelling convention.

---

# 15. Manglish Handling

Manglish is inherently variable.

Examples:

```text
enikku
enik
enikk
enikkuu
```

and:

```text
kaananam
kaanam
kaanenam
```

should not automatically be treated as different intents.

The AI should normalize language semantically.

Do not create a brittle dictionary of every possible Manglish spelling.

Use the language model for semantic interpretation, then validate the resulting structured intent against known hospital data.

---

# 16. Malayalam Confirmation

After extracting symptoms, the system may ask the patient to confirm them.

Example concept:

> **"ഈ ബുദ്ധിമുട്ടുകളാണോ നിങ്ങൾ അനുഭവിക്കുന്നത്?"**

The exact wording should be generated or selected according to the active language.

If Sarvam AI is used for this step, its responsibility should remain narrowly scoped.

For example:

```text
Input:
Confirmed symptom list

Output:
One natural confirmation sentence
```

It should not perform routing or modify hospital records.

---

# 17. Sarvam AI Integration Principle

If Sarvam is used, isolate it behind a dedicated service.

Conceptually:

```text
SarvamService
 ├── Malayalam TTS
 └── Malayalam-specific voice functionality
```

The rest of the application should not directly depend on Sarvam API calls.

This allows:

- API changes
- Model changes
- Provider replacement
- Testing with another provider

without rewriting the workflow.

---

# 18. API Key Security

API keys must never be embedded directly in frontend source code.

Never place provider secrets in:

- React components
- Browser JavaScript
- Public configuration
- Git repositories
- Client-side environment variables that are bundled into the browser

Preferred architecture:

```text
Kiosk
 ↓
ARTEQ backend
 ↓
Provider API
```

Secrets remain server-side.

---

# 19. Symptom Extraction

The AI should extract what the patient reports, not diagnose them.

Example:

Patient:

> "എനിക്ക് പല്ലുവേദനയാണ്, ഡോക്ടറെ കാണണം."

Structured understanding:

```json
{
  "symptoms": ["tooth pain"],
  "request": "see doctor",
  "possibleDepartment": "dentistry"
}
```

The system should not convert this into:

```text
Diagnosis: Dental infection
```

unless an explicitly supported clinical system is later introduced for that purpose.

---

# 20. Symptom Confirmation

For symptom-based workflows:

```text
Patient speech
     ↓
Symptom extraction
     ↓
Patient confirmation
     ↓
Routing
```

The patient should have the opportunity to correct the system before an operational decision is made.

---

# 21. Intent Classification

The AI should identify the patient's high-level intent.

Examples:

```text
OP_REGISTRATION
DOCTOR_LOOKUP
DEPARTMENT_LOOKUP
HOSPITAL_INFORMATION
QUEUE_INFORMATION
LOCATION
GENERAL_ASSISTANCE
RECEPTIONIST_REQUEST
```

The list should remain controlled and versioned.

The model should not invent arbitrary intent categories.

---

# 22. Structured AI Output

AI responses should be converted into structured data before the application acts.

Example:

```json
{
  "intent": "OP_REGISTRATION",
  "language": "ml",
  "symptoms": ["tooth pain"],
  "departmentCandidate": "dentistry",
  "confidence": "HIGH",
  "needsConfirmation": true
}
```

The exact schema should be defined in implementation documentation and validated at runtime.

---

# 23. Closed-World Routing

Routing must follow a closed-world model.

The AI may suggest:

```text
DENT
Dental
Dentistry
dept-dentistry
```

The backend maps these to a known department.

It must never create a new department because the model produced an unfamiliar string.

Conceptually:

```text
AI recommendation
       ↓
Normalize
       ↓
Match against known departments
       ↓
Valid?
 ┌─────┴─────┐
Yes         No
 ↓           ↓
Continue    Safe fallback / clarification
```

---

# 24. Department Matching

Matching should tolerate legitimate model variation.

Examples that may refer to the same known department:

```text
DENT
Dental
Dentistry
dept-dentistry
```

However, matching must remain constrained to the known hospital department dataset.

This preserves flexibility without sacrificing safety.

---

# 25. Routing Confidence

Routing should produce a confidence classification.

Example:

```text
HIGH
MEDIUM
LOW
```

### HIGH

Clear intent and strong department match.

### MEDIUM

Likely interpretation but confirmation may be useful.

### LOW

Insufficient information.

Low-confidence requests should trigger clarification instead of random routing.

Example:

> **"Could you please tell me a little more about what you are experiencing?"**

---

# 26. Doctor Recommendation

AI may recommend a doctor based on:

- Patient request
- Department
- Specialty
- Hospital-defined rules
- Current availability

However:

> **The AI does not decide whether a doctor exists or is available.**

The backend must validate:

```text
Doctor exists
AND
Doctor belongs to selected department
AND
Doctor is currently eligible/available
```

Only then can the doctor be presented.

---

# 27. Hospital Data Authority

The hierarchy should be:

```text
Hospital database
      ↑
Application backend
      ↑
AI interpretation
```

Not:

```text
AI
 ↓
Hospital database
```

AI interprets patient language.

The application determines what is actually true.

---

# 28. Information Queries

For non-registration questions, the AI can act as a conversational interface over trusted hospital data.

Examples:

> "Which doctors are available in Dentistry?"

> "Where is Orthopedics?"

> "What time does OP start?"

> "How many patients are waiting?"

The system should retrieve current data and formulate a natural answer.

---

# 29. Voice + Dynamic Visualization

When useful:

```text
Patient asks question
        ↓
AI understands request
        ↓
Backend retrieves trusted data
        ↓
AI creates structured response
        ↓
 ┌───────────────┬───────────────┐
 ↓               ↓
Voice answer   Visual component
```

Example:

> "There are three dentists available."

At the same time, the screen shows the three doctors.

The visual is a companion to the spoken response.

---

# 30. Visualization Selection

The AI may request an approved visualization type.

Examples:

```text
doctor_list
department_list
department_detail
queue_status
hospital_info
location
ticket
```

The frontend renders the appropriate controlled component.

The AI must not output executable frontend code.

---

# 31. TTS Architecture

Text-to-speech should be treated as a separate output layer.

```text
Structured answer
      ↓
Response text
      ↓
Language selection
      ↓
TTS provider
      ↓
Speaker
```

The UI should not depend on TTS completion to display important information.

The screen and voice should operate in parallel.

---

# 32. Gemini Speaking / Generation Reliability

The product must account for the possibility that a conversational model may stop generating speech prematurely.

Voice generation should therefore be treated as an independently monitored stream.

The application should distinguish:

- User speech ended
- AI response generation ended
- AI audio playback ended
- Connection failed
- Generation interrupted

Do not assume that a single event represents all four.

If Gemini begins speaking and stops unexpectedly, the system should have a controlled recovery path rather than leaving the kiosk visually or audibly stuck.

---

# 33. AI Response Recovery

If an AI response is interrupted:

```text
Generation interrupted
       ↓
Determine whether complete answer was received
       ↓
If incomplete:
    retry / continue using controlled policy
       ↓
Otherwise:
    finish normally
```

Recovery must avoid repeating the entire response unnecessarily.

The exact retry strategy should be measured during MVP testing.

---

# 34. Human Fallback

AI failure must never become a dead end.

Fallback options include:

```text
Try again
Speak again
Use touch
Ask Receptionist
```

The fallback should be presented calmly.

Do not expose technical failure details to patients.

---

# 35. Safety Boundaries

The receptionist AI is an administrative and navigation assistant.

It should not:

- Diagnose disease
- Prescribe medication
- Invent clinical instructions
- Override hospital rules
- Invent doctor availability
- Invent room numbers
- Invent token numbers
- Expose another patient's information
- Claim an action succeeded before backend confirmation

When a medical question exceeds the intended scope, the AI should guide the patient toward appropriate hospital staff.

---

# 36. Prompting Philosophy

Prompts should define:

- Role
- Scope
- Allowed outputs
- Hospital context
- Structured schema
- Safety constraints
- Language behavior

Prompts should not contain giant collections of hard-coded hospital facts that can become stale.

Hospital facts belong in trusted data sources.

---

# 37. Context Management

Each patient session should have its own conversational context.

At session reset:

```text
Transcript cleared
Patient identity cleared
Temporary intent cleared
Temporary AI context cleared
Visualization state cleared
```

A new patient must never inherit the previous patient's conversation.

---

# 38. AI Observability

For development and testing, record useful telemetry such as:

```text
voice session ID
audio runtime sample rate
output sample rate
transcription latency
refinement latency
routing latency
provider/model
quality result
routing confidence
fallback reason
```

Do not log sensitive patient information unnecessarily.

Production logging must follow appropriate privacy requirements.

---

# 39. Testing Strategy

AI/voice testing must include:

### Malayalam

Natural Malayalam sentences.

### Manglish

Multiple spelling variations.

### English

Natural conversational English.

### Mixed language

Malayalam + English hospital terminology.

### Pauses

Natural mid-sentence pauses.

### Background noise

Realistic hospital environments.

### Elderly speech

Slower and less consistent speech.

### Repetition

Patient repeats or corrects themselves.

### Ambiguous requests

Requests requiring clarification.

### Long speech

Multiple sentences in one recording session.

---

# 40. Golden Voice Test Set

The project should maintain a repeatable test set.

Example:

```text
"എനിക്ക് പല്ലുവേദനയാണ്, ഡോക്ടറെ കാണണം."
"Enikku tooth pain aanu, dentistine kaananam."
"I have severe tooth pain and want to see a dentist."
"My knee hurts when I walk."
"I need to know where the cardiology department is."
```

For each test, record:

```text
Raw transcript
Refined transcript
Extracted intent
Department
Confidence
Final response
```

This allows regressions to be detected after model/provider changes.

---

# 41. Provider Change Policy

Changing a model is not considered safe merely because the application compiles.

A provider/model change requires:

1. Build verification
2. Voice test
3. Malayalam test
4. Manglish test
5. English test
6. Routing test
7. Ambiguity test
8. Doctor validation test
9. TTS test if applicable
10. End-to-end OP registration test

Only then should the new model become the default.

---

# 42. AI Does Not Own the Workflow

The AI can recommend the next step.

The application owns the state machine.

For example:

```text
AI:
"I believe this is Dentistry."

Application:
"Is Dentistry a valid department?"
        ↓
Yes
        ↓
Continue
```

This distinction is critical.

The model should never be allowed to bypass application state.

---

# 43. The Ideal Conversation

The ideal interaction feels like:

```text
Patient:
"I have tooth pain."

AI:
"Are you looking to see a dentist?"

Patient:
"Yes."

AI:
"Okay. I'll help you register with Dentistry."
```

The system is conversational, but every operational action is deterministic and validated.

---

# 44. North Star

The AI should feel intelligent because it understands the patient.

It should feel trustworthy because it does not invent facts.

It should feel natural because it speaks the patient's language.

It should feel fast because audio and UI processing are decoupled.

It should feel safe because hospital data remains authoritative.

The ultimate rule is:

> **AI understands. The application decides. The hospital database confirms. The patient approves.**
