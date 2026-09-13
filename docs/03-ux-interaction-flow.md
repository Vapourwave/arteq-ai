# ARTEQ AI — UX, Interaction & Screen Flow Specification

**Document:** 03 — UX, Interaction & Screen Flow  
**Product:** ARTEQ AI Portable AI Receptionist  
**Version:** 2.0  
**Status:** UX Source of Truth  
**Primary Goal:** Define what the patient experiences, sees, hears, and does

---

## 1. Purpose

This document defines the patient-facing experience of the ARTEQ AI Portable AI Receptionist.

It is intentionally focused on **interaction**, not implementation.

The system should feel like a receptionist, not like an application asking the patient to operate a complicated interface.

The guiding principle is:

> **The patient should interact with the hospital, not with the software.**

---

# 2. Experience Principles

Every screen and interaction should follow these principles.

### 2.1 Minimalism

Show only what is useful at the current moment.

Do not fill empty space simply because it is available.

Do not add a card, border, badge, icon, button, animation, or label unless it has a purpose.

### 2.2 Contextual UI

The screen changes according to what the patient is doing.

If the patient is speaking, the screen should focus on speaking.

If the patient is selecting a doctor, the screen should focus on doctors.

If the patient is waiting, the screen should focus on waiting.

### 2.3 Voice First

Voice should be the natural primary interaction.

Touch exists to:

- Confirm
- Correct
- Select
- Continue
- Cancel
- Provide an alternative when voice is inconvenient

The patient should not have to navigate menus unnecessarily.

### 2.4 Calmness

The interface should feel appropriate for a hospital.

Avoid visual noise, excessive animation, aggressive colors, decorative gradients, and generic AI-dashboard aesthetics.

### 2.5 Accessibility

The system should be usable by:

- Elderly patients
- First-time users
- Patients unfamiliar with technology
- Patients speaking Malayalam
- Patients speaking Manglish
- Patients speaking English

Controls must be large enough for touch and text must remain highly legible.

---

# 3. Visual Language

The interface should be minimal, refined, and purposeful.

## Avoid

- Excessive rounded cards
- Borders around everything
- Too many floating panels
- Pills for ordinary text
- Random accent colors
- Excessive gradients
- Excessive shadows
- Dense dashboard layouts
- Decorative illustrations that do not help the patient
- Unrelated colors for different components
- Generic "AI assistant" visual tropes

The product should not look like a collection of AI-generated components.

## Prefer

- Strong typography
- Clear hierarchy
- Large whitespace
- Simple geometry
- Consistent spacing
- Restrained use of color
- Subtle transitions
- Clear touch targets
- One primary action per screen where possible

---

# 4. Interaction Model

The patient experience follows a simple state progression.

```text
IDLE
  ↓
PERSON DETECTED
  ↓
WELCOME
  ↓
PATIENT INTENT
  ↓
IDENTITY (when required)
  ↓
VOICE REQUEST
  ↓
TRANSCRIPT / REQUEST CONFIRMATION
  ↓
ROUTING
  ↓
DOCTOR / SERVICE SELECTION
  ↓
FINAL CONFIRMATION
  ↓
OP REGISTRATION
  ↓
TICKET
  ↓
COMPLETION
  ↓
RESET
```

Not every interaction must use every state.

For example, a patient asking a simple hospital-information question may never enter patient registration.

---

# 5. Idle Screen

The idle state is intentionally quiet.

It should communicate:

- What the device is
- That the patient can approach it
- That assistance is available

It should not display the entire hospital application.

Possible primary message:

> **How can I help you?**

or:

> **Need help? Ask me.**

The screen may include a microphone affordance.

The camera/presence system remains active in the background.

---

# 6. Presence Detection

When a person approaches:

```text
Idle
  ↓
Person detected
  ↓
Wake
  ↓
Welcome
```

The transition should feel natural rather than like an application suddenly loading.

The bot may use a subtle visual transition and/or spoken welcome.

Example:

> **"Welcome. How can I help you?"**

The system should not immediately dump options onto the patient.

Give the patient a clear opportunity to speak.

---

# 7. Welcome Screen

The welcome screen establishes the relationship.

It should answer:

> "What can this thing do for me?"

without overwhelming the patient.

Possible structure:

```text
                 ARTEQ AI

          How can I help you?

              [ 🎙 Speak ]

       You can ask me for help with
       registration, doctors, departments,
       or hospital information.

          [ മലയാളം ] [ English ]

              Ask Receptionist
```

The exact visual treatment should remain minimal.

---

# 8. "Do You Need Help?" Entry

A dedicated voice entry may be present on the home/welcome screen.

Conceptually:

> **Do you need any help?**

with a prominent microphone.

The purpose is not to create another dashboard.

It gives patients an obvious first action.

The interaction should be:

```text
Do you need help?
        ↓
Tap microphone
        ↓
Speak naturally
```

---

# 9. Language Selection

The interface should support Malayalam and English.

Language selection should be simple.

Avoid placing large language controls on every screen if the language is already known for the session.

The system should remember the selected language for the current session.

Voice input may still contain mixed Malayalam, Manglish, and English regardless of the selected UI language.

---

# 10. Voice Interaction Screen

When the patient begins speaking, remove unnecessary UI.

This is one of the most important UX rules.

The speaking screen should contain only:

- A clear listening indicator
- A microphone state
- Minimal transcript feedback
- A stop/finish control if required
- A small fallback option if necessary

Conceptually:

```text
               Listening

                  ◉

        "I'm listening..."

       Enikku tooth pain aanu...

               [ Stop ]

          Ask Receptionist
```

Do not show:

- Department lists
- Doctor cards
- Hospital information
- Navigation menus
- Large headers
- Unrelated quick actions
- Decorative panels

The patient is speaking. The interface should respect that.

---

# 11. Live Transcript

Live transcription is useful because it gives the patient confidence that the system is hearing them.

However, it should remain visually secondary.

The transcript should:

- Update smoothly
- Remain readable
- Not dominate the screen
- Not require manual editing while the patient is speaking

The system should not visually jump around with every transcription chunk.

---

# 12. Stop / Completion

The patient should have a clear way to finish speaking.

After the patient stops:

```text
Voice capture
     ↓
Final transcript
     ↓
Refinement
     ↓
Quality check
```

The interface may briefly show a processing state.

Example:

> **Understanding what you said…**

The processing state should be short and honest.

Do not use fake AI animations merely to make a wait feel intelligent.

---

# 13. Understanding / Confirmation Screen

After refinement, show the system's understanding in patient-friendly language.

For example:

> **I understood that you have:**

> Tooth pain  
> Need to see a dentist

Then:

> **Are these the issues you are dealing with?**

Actions:

```text
[ Yes, that's correct ]

[ Edit / Correct ]

[ Speak again ]
```

For Malayalam, the confirmation should be spoken naturally and may use wording such as:

> **"ഈ ബുദ്ധിമുട്ടുകളാണോ നിങ്ങൾ അനുഭവിക്കുന്നത്?"**

The patient's confirmation is important before operational routing.

---

# 14. Correction Flow

If the patient says the interpretation is wrong:

```text
Incorrect
   ↓
Speak again / edit
   ↓
Refinement
   ↓
Confirmation
```

Do not force the patient to restart the entire kiosk session.

The correction should affect only the relevant request.

---

# 15. Existing Patient Flow

Existing-patient identification should be simple.

Conceptually:

```text
How can I help?
       ↓
OP Registration
       ↓
Existing Patient
       ↓
Mobile Number
       ↓
OTP
       ↓
Patient List
       ↓
Select Patient
       ↓
Continue
```

The interface should clearly explain why the phone number is being requested.

Example:

> **Enter your registered mobile number**

Then:

> **We sent an OTP to verify your number.**

---

# 16. Patient List

If multiple patients are associated with the verified mobile number, show a clear selection interface.

Example:

```text
Who are you registering today?

  Anil Kumar
  Age 42

  Meera Anil
  Age 38

  Rahul Anil
  Age 12
```

Only information necessary for identification should be shown.

Do not expose unrelated medical or personal information.

---

# 17. New Patient Flow

For a new patient:

```text
New Patient
    ↓
Basic registration
    ↓
Confirm details
    ↓
Continue
```

The form should remain short.

The system should not turn the kiosk into a large data-entry application.

Where voice can safely reduce typing, use it.

---

# 18. Assistance Request

Once the patient identity is established where required:

> **What do you need help with?**

The patient should be able to immediately speak.

Primary control:

```text
             🎙
        Tell me what you need
```

Possible secondary actions:

- Type instead
- Ask Receptionist

Do not show the entire hospital service catalog unless the patient asks for it.

---

# 19. Routing Screen

After the request is confirmed, the system determines the relevant department.

The patient should see the result in a simple form.

Example:

```text
Based on what you told me

Dentistry

We found doctors available
in this department.
```

If confidence is low, do not pretend certainty.

Instead:

> **I need a little more information before I can guide you.**

Then ask a focused clarification question.

---

# 20. Doctor Selection

If doctor selection is applicable:

```text
Dentistry

Available doctors

Dr. Ananya Nair
Endodontist
Room 4
Available

Dr. Rahul
Dental Surgeon
Room 5
Available
```

The AI recommendation can be indicated subtly.

For example:

> **Recommended for your request**

Do not turn every doctor into a colorful "AI card."

The recommendation should be helpful, not visually dominant.

---

# 21. Doctor Information

When a patient asks for doctor information, the system may show:

- Name
- Specialty
- Department
- Room
- Availability
- Relevant administrative information

Only hospital-verified information should be displayed.

---

# 22. Department Information

For a department query:

```text
Dentistry

Room 4

Ground Floor

Available today
```

If useful, the interface may include a simple location visualization.

Do not create a complex hospital map unless navigation is explicitly supported.

---

# 23. Dynamic Visual Response

The system may determine that a visual response will improve understanding.

Examples:

### Patient asks:

> "Which doctors are available?"

Show a doctor list.

### Patient asks:

> "Where is Dentistry?"

Show department/location information.

### Patient asks:

> "What departments are available?"

Show a clean department list.

### Patient asks:

> "How many people are waiting?"

Show queue information if available.

The rule is:

> **Voice explains. Visuals reinforce.**

Never show a visualization simply because the AI can generate one.

---

# 24. AI Visualization Safety

AI must not directly generate arbitrary frontend code.

Instead:

```text
Patient Query
      ↓
AI interpretation
      ↓
Structured visualization type
      ↓
Frontend validates type
      ↓
Approved component
      ↓
Screen
```

Possible controlled types:

```text
doctor_list
department_list
department_detail
queue_status
hospital_info
location
ticket
```

The list can grow over time.

---

# 25. Final Confirmation

Before generating an OP visit/token, the patient should receive a concise summary.

Example:

```text
You're registering for:

Dentistry
Dr. Ananya Nair
Room 4

[ Confirm ]

[ Change ]
```

The patient must clearly understand what they are confirming.

---

# 26. OP Ticket Screen

After successful registration:

```text
OP REGISTRATION COMPLETE

Token
DEN-101

Dentistry
Dr. Ananya Nair
Room 4

Queue position: 7

Please proceed to the department.
```

The screen should prioritize the token.

Printing may be offered if the physical setup supports it.

The bot should also speak the essential next step.

---

# 27. Completion

The system should explicitly indicate that the interaction is finished.

Example:

> **You're all set. Please proceed to Room 4.**

Then:

```text
Ticket
   ↓
Short completion state
   ↓
Reset
   ↓
Idle
```

The reset should happen automatically after an appropriate period.

---

# 28. Ask Receptionist

The human fallback should remain accessible but not visually compete with the primary interaction.

It may appear as a simple secondary action:

> **Need help? Ask Receptionist**

When activated, the system should provide a clear path to staff assistance.

The fallback should never feel like an error or punishment.

---

# 29. Error States

Errors should be written for patients, not developers.

Avoid:

> `API_ERROR 500`

Prefer:

> **I'm having trouble connecting right now.**

Then:

> **Please try again or ask a receptionist for help.**

The system should provide an actionable next step.

---

# 30. Timeout / Inactivity

Because the device is public, inactivity should trigger a reset.

Before reset:

> **Are you still there?**

Then, after the timeout:

> **Starting a new session.**

All temporary patient information should be cleared.

The next patient must see a clean state.

---

# 31. Staff Access

Staff may need to exit patient mode or access operational controls.

Staff controls should be intentionally separate from patient controls.

The patient-facing interface should not expose:

- Configuration
- API information
- Debug controls
- Internal routing data
- System administration
- Development tools

---

# 32. Touch Interaction Rules

Touch controls should:

- Be large
- Have clear labels
- Provide obvious feedback
- Avoid tiny icons as the only control
- Avoid requiring precise gestures
- Avoid hidden interactions

One primary action per screen is preferred.

Secondary actions should be visually subordinate.

---

# 33. Animation Rules

Animation should communicate state, not decorate the interface.

Good uses:

- Wake transition
- Listening state
- Processing state
- Confirmation transition
- Ticket completion
- Session reset

Avoid:

- Constant floating animations
- Decorative particle effects
- Pulsing everything
- Excessive loading animations
- AI "thinking" theater

The bot should feel alive because it responds naturally, not because the screen is constantly moving.

---

# 34. Voice + Visual Synchronization

Voice and screen should communicate the same thing.

Example:

```text
Speaker:
"Dr. Ananya is available in Room 4."

Screen:
Dr. Ananya Nair
Room 4
Available
```

Do not make the speaker talk about information that is hidden or contradicted by the screen.

If the answer changes, both channels must reflect the current state.

---

# 35. Multilingual UX

Language is not merely a translation layer.

The system should preserve natural conversational meaning.

A Malayalam-speaking patient should not receive awkward machine-translated Malayalam.

Similarly, Manglish should be accepted naturally as input even if the output is normalized Malayalam or English depending on the selected language.

The system should support mixed-language hospital terminology such as:

> "dentistine kaananam"

without forcing the patient to speak formally.

---

# 36. Accessibility for Government Hospital Use

The design should assume:

- High patient volume
- Different ages
- Different technical literacy
- Different language preferences
- Patients who may be anxious
- Patients who may not read English comfortably
- Public lighting conditions
- Background noise
- Repeated daily use

Therefore:

- Text must be readable at a distance.
- Important actions must be obvious.
- Voice must remain optional.
- Touch controls must be forgiving.
- Contrast must be strong.
- The interface must not rely on color alone.
- Fallback to a human must always be understandable.

---

# 37. UX Rules for Voice Mode

When voice mode begins:

### Keep

- Listening indicator
- Microphone state
- Minimal live transcript
- Stop control
- Essential fallback

### Remove

- Navigation
- Doctor lists
- Department menus
- Unrelated buttons
- Decorative content
- Secondary information

The principle is:

> **When the patient speaks, listen. Do not make them operate the interface simultaneously.**

---

# 38. UX Rules for Information Mode

When the patient asks an informational question, the screen should adapt to the answer.

Example:

```text
Patient:
"Which doctors are available in Dentistry?"

       ↓

Voice response + Doctor list
```

The interface should not force the patient into a separate "Doctor Directory" application.

The conversation determines the appropriate visualization.

---

# 39. UX Rules for OP Registration

OP registration is the most structured workflow.

Even here, the system should minimize form filling.

The patient should experience:

```text
Tell us what you need
        ↓
Identify yourself
        ↓
Confirm what we understood
        ↓
Choose/confirm doctor if needed
        ↓
Confirm registration
        ↓
Receive token
```

The software may perform many internal operations.

The patient should experience only the necessary decisions.

---

# 40. Complete Example — Malayalam Toothache

Example end-to-end interaction:

### 1. Approach

Camera detects patient.

Bot:

> "Welcome. How can I help you?"

### 2. Patient

> "എനിക്ക് പല്ലുവേദനയാണ്, ഡോക്ടറെ കാണണം."

### 3. System

Voice capture → transcript → refinement.

### 4. Confirmation

Screen:

> **I understood that you have:**  
> Tooth pain  
> Need to see a dentist

Bot:

> "ഈ ബുദ്ധിമുട്ടുകളാണോ നിങ്ങൾ അനുഭവിക്കുന്നത്?"

### 5. Patient

> "അതെ."

### 6. Routing

Screen:

> **Dentistry**

Available doctors appear.

### 7. Patient

Selects a doctor.

### 8. Confirmation

Screen:

> Dentistry  
> Dr. Ananya Nair  
> Room 4

> **Confirm registration?**

### 9. Token

Screen:

> **DEN-101**

Bot:

> "You're registered. Please proceed to Room 4."

### 10. Reset

Session clears.

Bot returns to idle.

---

# 41. UX Anti-Patterns

The following should trigger reconsideration during design review:

### "Can we put this in a card?"

Ask:

> Does this grouping actually improve comprehension?

If not, remove it.

### "Can we add another button?"

Ask:

> Does the patient need this decision right now?

If not, remove it.

### "Can we show more information?"

Ask:

> Will the patient use it at this moment?

If not, hide it.

### "Can we add an animation?"

Ask:

> Does it communicate state?

If not, remove it.

### "Can we make it more AI-looking?"

No.

The product should look like a **professional hospital interface**, not an AI demo.

---

# 42. UX North Star

At every screen, ask:

> **What is the patient trying to accomplish right now?**

Then show only what helps them accomplish it.

The interface should continuously reduce cognitive load.

---

# 43. Final Interaction Principle

The ideal ARTEQ interaction is almost invisible.

The patient should not think:

> "Which button do I press?"

They should think:

> **"I can just ask it."**

And when they do ask:

> **The bot listens, understands, confirms, acts, explains, and gets out of the way.**
