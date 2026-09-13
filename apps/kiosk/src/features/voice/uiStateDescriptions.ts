/**
 * ARTEQ AI — Centralized UI State Descriptions
 * 
 * Provides stable state identifiers and concise, human-readable summaries
 * describing what is currently visible and interactable on screen.
 * These summaries are forwarded to the Gemini Live session so the model
 * has real-time awareness of what the patient is seeing and doing.
 */

export interface UIStateInfo {
  stateId: string;
  summary: string;
}

export function describeUIState(params: {
  touchStageKind: string;
  patientFlowState: string;
  identityStep?: string;
  departmentName?: string;
  doctorName?: string;
  readyForTicket?: boolean;
}): UIStateInfo {
  const { touchStageKind, patientFlowState, identityStep, departmentName, doctorName, readyForTicket } = params;

  // Identity / Patient Verification States
  if (patientFlowState === "choice" || identityStep === "choice") {
    return {
      stateId: "PATIENT_TYPE_SELECTION",
      summary: "Patient type selection: user is choosing between New Patient and Existing Patient.",
    };
  }

  if (identityStep === "existing-phone") {
    return {
      stateId: "EXISTING_PATIENT_PHONE_INPUT",
      summary: "Existing patient identification: user is entering their registered phone number to request an OTP.",
    };
  }

  if (identityStep === "existing-otp") {
    return {
      stateId: "EXISTING_PATIENT_OTP_VERIFICATION",
      summary: "Existing patient verification: user is entering the OTP code received on their phone.",
    };
  }

  if (identityStep === "new-info" || patientFlowState === "new_input") {
    return {
      stateId: "NEW_PATIENT_REGISTRATION",
      summary: "New patient registration: user is entering their name, phone number, and address.",
    };
  }

  if (identityStep === "capture" || patientFlowState === "camera") {
    return {
      stateId: "ID_DOCUMENT_CAPTURE",
      summary: "ID document capture: user is presenting their ID document to the camera.",
    };
  }

  // Ready for OP Ticket
  if (touchStageKind === "ready" || (readyForTicket && patientFlowState === "verified")) {
    return {
      stateId: "TICKET_READY",
      summary: "Ticket stage: patient has completed identification and can proceed to receive an OP ticket.",
    };
  }

  // Doctor Confirmation
  if (touchStageKind === "doctor-confirm") {
    const docText = doctorName ? ` for Dr. ${doctorName}` : "";
    return {
      stateId: "DOCTOR_CONFIRMATION",
      summary: `Doctor confirmation: the selected doctor${docText} is shown and the user can confirm or go back.`,
    };
  }

  // Doctor Selection
  if (touchStageKind === "doctors") {
    const deptText = departmentName ? ` for ${departmentName}` : "";
    return {
      stateId: "DOCTOR_SELECTION",
      summary: `Doctor selection: user is choosing a doctor${deptText}.`,
    };
  }

  // Department Confirmation
  if (touchStageKind === "dept-confirm") {
    const deptText = departmentName ? ` for ${departmentName}` : "";
    return {
      stateId: "DEPARTMENT_CONFIRMATION",
      summary: `Department confirmation: the selected department${deptText} is shown and the user can confirm or go back.`,
    };
  }

  // Department Selection
  if (touchStageKind === "departments") {
    return {
      stateId: "DEPARTMENT_SELECTION",
      summary: "Department selection: user is choosing a hospital department.",
    };
  }

  // Default / Initial Conversation
  return {
    stateId: "INITIAL_CONVERSATION",
    summary: "Initial conversation: patient is speaking with the receptionist to explain their visit reason.",
  };
}
