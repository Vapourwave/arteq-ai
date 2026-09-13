# ARTEQ AI — Hardware & Deployment Specification

**Document:** 06 — Hardware & Deployment Specification  
**Product:** ARTEQ AI Portable AI Receptionist  
**Version:** 2.0  
**Status:** MVP Hardware & Deployment Source of Truth

---

# 1. Purpose

ARTEQ AI is not only a web application.

The MVP is a **portable physical AI receptionist** designed to operate in a hospital environment.

The hardware system must therefore be treated as part of the product experience.

The goal is:

> **A patient walks up to a physical device, sees a touchscreen, speaks naturally, receives a response, and completes the required hospital task.**

The hardware should feel like a single appliance rather than a collection of development components.

---

# 2. Physical Product Concept

The initial MVP is a portable kiosk/bot consisting of:

```text
              ┌───────────────────────┐
              │        WEBCAM         │
              │    Presence sensing   │
              ├───────────────────────┤
              │                       │
              │      TOUCHSCREEN      │
              │                       │
              │   ARTEQ AI interface  │
              │                       │
              ├───────────────────────┤
              │     MICROPHONE        │
              │                       │
              │      SPEAKER          │
              └───────────────────────┘
                       │
                 Compute device
                       │
                  Internet
                       │
                 Cloud services
```

The exact enclosure dimensions and industrial design are implementation decisions.

The interaction model is not.

---

# 3. Hardware MVP Components

The initial physical MVP requires:

1. Touchscreen
2. Webcam
3. Microphone / microphone array
4. Speaker
5. Compute device
6. Internet connectivity
7. Stable power supply
8. Physical enclosure / mounting structure

Optional components may include:

- Thermal printer
- Status indicator
- Physical emergency/help button
- Additional microphone array
- Better speaker system
- UPS/battery backup

Optional hardware should not delay the first working MVP unless required by the deployment environment.

---

# 4. Compute Architecture

The compute device is responsible for:

- Running the kiosk application
- Accessing the webcam
- Capturing microphone input
- Driving the touchscreen
- Playing audio
- Maintaining the network connection
- Communicating with cloud services

The preferred architecture is:

```text
Local Device
│
├── Kiosk browser/application
├── Camera access
├── Microphone access
├── Speaker output
└── Network client
          │
          ▼
      Cloud Backend
          │
          ├── AI providers
          ├── Hospital APIs
          ├── Authentication
          └── Database
```

Heavy AI inference should remain cloud-based for the MVP unless a specific requirement justifies local inference.

---

# 5. Cloud-First MVP

The first demonstration/deployment architecture is cloud-based.

The physical kiosk communicates with a backend through secure APIs.

Conceptually:

```text
Kiosk
  │
  │ HTTPS / secure WebSocket
  ▼
ARTEQ Backend
  │
  ├── Authentication
  ├── Session management
  ├── AI orchestration
  ├── Routing
  ├── Hospital data
  └── Token/OP operations
       │
       ├── Gemini
       ├── Sarvam
       └── Hospital systems
```

The kiosk must not contain secret provider credentials.

---

# 6. API Key Security

API keys and other secrets must remain server-side.

Never:

- Hard-code production API keys in frontend code
- Commit secrets to Git
- Store provider keys in browser-accessible environment variables
- Expose API keys through client logs

The browser/device communicates with the ARTEQ backend.

The backend communicates with external AI providers.

---

# 7. Network Requirements

The MVP requires reliable internet access because core AI services are cloud-based.

The kiosk should have:

- Stable Wi-Fi or Ethernet
- Low enough latency for conversational voice interaction
- Reliable DNS
- Ability to establish HTTPS connections
- Ability to maintain secure WebSocket connections where required

Ethernet is preferred for a fixed hospital installation when practical.

Wi-Fi is useful for portability.

---

# 8. Network Failure Behavior

The kiosk must not appear broken when the network fails.

Example:

```text
Network available
      ↓
Normal operation

Network lost
      ↓
Detect failure
      ↓
Stop attempting sensitive operations
      ↓
Display simple status
      ↓
Offer retry / receptionist fallback
```

The system must never tell the patient that an OP registration or token was created unless the backend confirmed it.

---

# 9. Touchscreen

The touchscreen is the primary visual interface.

Requirements:

- Touch-capable
- Bright enough for hospital lighting
- Readable at normal standing distance
- Responsive
- Suitable for continuous operation
- Capable of running the kiosk browser/application
- Easy to clean

The interface should be optimized for touch targets rather than desktop mouse interaction.

---

# 10. Screen Philosophy

The physical screen must follow the product's minimalism principle.

Avoid:

- Excessive rounded cards
- Unnecessary borders
- Decorative gradients
- Clashing colors
- Dense dashboards
- Tiny controls
- Persistent navigation bars
- Developer-oriented information
- AI branding everywhere

The screen should show only what matters to the current interaction.

---

# 11. Camera

The webcam has two primary MVP purposes:

### Presence detection

Determine whether a person is approaching/standing at the kiosk.

### Future interaction expansion

The camera hardware should not prevent future capabilities such as:

- Better presence detection
- Accessibility improvements
- Interaction-state detection

The MVP does **not** require facial recognition.

---

# 12. Privacy-Preserving Camera Design

The initial camera implementation should use the minimum information necessary.

For presence detection:

```text
Person present?
     ↓
YES / NO
```

There is no requirement to identify who the person is through their face.

Patient identity should be established through the approved authentication workflow.

---

# 13. Microphone

Voice interaction is central to the product.

The microphone should therefore be treated as a critical component rather than a generic peripheral.

Requirements:

- Clear speech capture
- Suitable pickup distance
- Reasonable background-noise rejection
- Stable continuous capture
- Compatibility with the browser/audio pipeline
- Good performance with Malayalam, Manglish, and English

A microphone array may be preferred for the physical product if the environment is noisy.

---

# 14. Audio Capture Architecture

The voice path is:

```text
Patient speech
     ↓
Microphone
     ↓
Browser audio input
     ↓
Voice service
     ↓
Audio processing/resampling
     ↓
Cloud speech/AI service
     ↓
Transcript
```

The implementation must avoid UI rendering work that can starve audio processing.

---

# 15. Audio Performance Requirement

Audio capture must remain continuous while the patient speaks.

The application must not perform heavy React/UI rendering on the critical audio path.

High-frequency transcript updates should be isolated from the main kiosk workflow.

The existing engineering lesson is important:

> **Voice capture and large UI renders must be decoupled.**

---

# 16. Audio Format

Where the selected voice backend requires it, the client must produce the declared PCM format consistently.

For the current voice architecture:

```text
Input
Native AudioContext sample rate

        ↓

Resampling

        ↓

16,000 Hz
16-bit
Signed PCM
Little-endian
```

The implementation must use the actual runtime AudioContext sample rate rather than assuming that every device runs at 16 kHz.

---

# 17. Speaker

The speaker is required for voice-first interaction.

It should provide:

- Clear speech
- Sufficient volume for a nearby patient
- Minimal distortion
- Understandable Malayalam/English output
- Controlled playback

The speaker should not be unnecessarily loud in a hospital environment.

---

# 18. AI Voice Output

The voice output path is:

```text
AI response
     ↓
Approved response text
     ↓
TTS provider
     ↓
Audio output
     ↓
Speaker
```

Possible providers include:

- Sarvam AI
- Other approved TTS providers

Provider-specific implementation must remain behind an abstraction.

---

# 19. AI Provider Independence

The hardware should not depend on one AI provider.

The architecture should allow:

```text
VoiceProvider
     ├── Gemini
     └── Other provider

TTSProvider
     ├── Sarvam
     └── Other provider
```

Changing providers should not require redesigning the kiosk hardware.

---

# 20. Kiosk Browser/Application Mode

The device should boot into the ARTEQ AI application.

The production experience should not expose:

- Browser tabs
- Address bars
- Developer tools
- Desktop applications
- OS notifications
- Unrelated applications

The application should behave like a dedicated appliance.

---

# 21. Startup Behavior

Preferred startup sequence:

```text
Device powers on
      ↓
Operating system starts
      ↓
Network initializes
      ↓
ARTEQ application launches
      ↓
Hardware permissions initialize
      ↓
Camera/microphone checked
      ↓
Backend connectivity checked
      ↓
Kiosk enters Welcome state
```

The patient should not need to operate the operating system.

---

# 22. Recovery After Crash

If the kiosk application crashes:

```text
Application failure
      ↓
Automatic restart
      ↓
Hardware reinitialization
      ↓
Session state cleared
      ↓
Welcome screen
```

A production deployment should have an external watchdog or process supervisor where practical.

---

# 23. Session Isolation

Each patient interaction is a separate session.

At session start:

```text
Create session
```

During session:

```text
Patient context
Voice context
Workflow state
```

At session end:

```text
Destroy sensitive session state
```

A new patient must never inherit the previous patient's:

- Transcript
- Patient identity
- OTP state
- Department
- Doctor
- Token
- AI context

---

# 24. Physical Session Reset

The kiosk should have a clear reset behavior.

Possible triggers:

- Successful workflow completion
- Patient cancellation
- Timeout
- Human fallback
- Application restart

After reset:

```text
Clean state
    ↓
Welcome
```

---

# 25. Accessibility

The physical product should eventually support:

- Large readable text
- High contrast
- Clear voice guidance
- Touch targets suitable for varied users
- Malayalam language
- English language
- Minimal cognitive load

The MVP should avoid relying solely on color to communicate state.

---

# 26. Hospital Environment

The device must be designed for a real hospital rather than a controlled developer environment.

Consider:

- Background conversations
- Foot traffic
- Reverberation
- Bright lighting
- Variable lighting
- Multiple people nearby
- Touchscreen contamination
- Network fluctuations
- Long operating hours
- Repeated sessions

The MVP should therefore be tested under realistic environmental conditions.

---

# 27. Audio Environment Testing

Voice testing should include:

### Quiet

One patient, quiet room.

### Moderate noise

Normal hospital background.

### High noise

Multiple conversations and movement.

### Multiple speakers

Another person speaking nearby.

The system should avoid accidentally treating unrelated speech as the patient's request.

---

# 28. Presence Detection Testing

Test:

1. No person
2. One person approaches
3. Person walks away
4. Person approaches quickly
5. Multiple people nearby
6. Person stands beside rather than directly in front
7. Lighting changes
8. Camera temporarily unavailable

Presence detection should control the interaction state, not determine patient identity.

---

# 29. Physical Placement

The kiosk should be positioned so that:

- Camera has a clear view
- Microphone has reasonable speech pickup
- Screen is comfortable to use
- Speaker points toward the patient
- Cables are secured
- Device cannot easily tip over
- Staff can access service ports when necessary

Exact dimensions depend on the selected enclosure.

---

# 30. Portability

Because the initial product is a portable bot:

The system should be capable of being:

```text
Powered down safely
     ↓
Moved
     ↓
Connected at a new location
     ↓
Powered on
     ↓
Automatically restored
     ↓
Ready for patients
```

Configuration should be software-controlled wherever practical.

---

# 31. Configuration

Deployment-specific configuration should include:

- Hospital identifier
- Department configuration
- Doctor configuration
- API endpoint
- Feature flags
- Language availability
- Kiosk identifier
- Device identifier
- Environment

Configuration should not require modifying application source code.

---

# 32. Environment Separation

The deployment system should distinguish:

```text
Development
     ↓
Staging
     ↓
Production
```

A developer must not accidentally point a demonstration kiosk at a production hospital database.

---

# 33. Logging

Logs should support troubleshooting without exposing unnecessary patient information.

Useful operational events include:

```text
Kiosk started
Camera initialized
Microphone initialized
Backend connected
Voice session started
Voice session ended
Routing request
Routing result
OP request
OP success/failure
Token generated
Session reset
Hardware error
Network error
```

Medical or personally identifying data should be minimized in logs.

---

# 34. Monitoring

Production deployments should eventually expose device health information such as:

- Online/offline
- Application running
- CPU/memory health
- Network status
- Camera status
- Microphone status
- Speaker status
- Backend connectivity
- Error rate

This is a post-MVP operational capability unless needed for the first deployment.

---

# 35. Security

The physical device must be hardened against casual misuse.

Production kiosk mode should prevent patients from:

- Accessing the OS
- Opening other applications
- Viewing developer tools
- Accessing browser storage
- Reading API credentials
- Navigating to arbitrary websites

Administrative access should be restricted to authorized personnel.

---

# 36. Physical Security

The enclosure should eventually provide:

- Secure mounting
- Protected cables
- Protected compute device
- Limited access to USB/service ports
- Tamper-resistant construction

The first prototype may use an accessible enclosure for development.

The production enclosure should not.

---

# 37. Optional Printer

A thermal printer may be integrated for physical token/receipt output.

Possible flow:

```text
Token generated
      ↓
Backend confirms
      ↓
Screen displays token
      ↓
Printer prints token
```

Printing must happen only after backend confirmation.

The printer is optional for the earliest software MVP.

---

# 38. Hardware Abstraction

Hardware-specific code should be isolated.

Conceptually:

```text
Hardware
│
├── CameraService
├── MicrophoneService
├── SpeakerService
├── DisplayService
└── PrinterService
```

The application should not contain hardware-specific implementation throughout every UI component.

---

# 39. Device Independence

The software should initially run on standard development hardware where possible.

The final physical device can then be selected based on:

- Cost
- Availability
- Performance
- Reliability
- Screen compatibility
- Camera compatibility
- Audio performance
- Power requirements

Hardware selection should not prematurely lock the software architecture.

---

# 40. MVP Hardware Definition

The minimum demonstrable physical MVP is:

```text
┌───────────────────────────────┐
│            Webcam             │
│                               │
│       Touchscreen             │
│                               │
│    ARTEQ AI Interface         │
│                               │
│  Microphone      Speaker      │
└───────────────────────────────┘
              │
         Compute device
              │
           Internet
              │
         Cloud backend
```

This is sufficient to demonstrate the core product concept.

---

# 41. MVP Hardware Acceptance Test

The MVP hardware is ready for demonstration when:

1. Device boots without developer intervention.
2. Application launches automatically.
3. Touchscreen works reliably.
4. Camera detects presence.
5. Microphone captures speech clearly.
6. Voice capture remains stable during long speech.
7. Speaker produces understandable responses.
8. Network connection is stable.
9. Backend communication works.
10. Patient sessions can complete.
11. Session state clears between patients.
12. The device can be safely restarted.
13. The device can be moved and redeployed without code changes.

---

# 42. Real-World Demonstration Scenario

The target demonstration should be physical.

```text
Person walks toward ARTEQ AI
        ↓
Camera detects presence
        ↓
Screen wakes
        ↓
"Welcome. How can I help you?"
        ↓
Patient:
"Enikku tooth pain aanu."
        ↓
Microphone captures speech
        ↓
AI understands
        ↓
Patient confirms
        ↓
Patient authentication
        ↓
Dentistry selected
        ↓
Doctor selected
        ↓
OP registration
        ↓
Token generated
        ↓
Voice + touchscreen confirmation
        ↓
Patient leaves with clear next step
```

The demo should not depend on a developer manually operating the computer.

---

# 43. Physical Product Principle

The hardware should make the AI feel **present**, not complicated.

The patient should perceive:

> **One helpful hospital receptionist.**

Not:

> A screen + webcam + microphone + AI software + cloud backend.

All engineering complexity should disappear behind the physical experience.

---

# 44. Deployment Principle

The first MVP should optimize for:

**Reliability → simplicity → serviceability → portability → cost**

rather than attempting to maximize hardware sophistication.

A reliable simple device is more valuable than an impressive prototype that fails in a hospital environment.

---

# 45. Final Hardware North Star

> **ARTEQ AI should be able to be physically placed in a hospital, powered on, connected to the configured cloud service, and left in front of a patient without requiring a developer to operate it.**

That is the hardware definition of an MVP.
