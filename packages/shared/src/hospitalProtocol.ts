/**
 * ARTEQ AI — Hospital domain types + conversational navigation state.
 *
 * Phase 5 (AI receptionist product). These types are shared between backend
 * (the authority — CLAUDE.md §5.2 "AI proposes, backend decides") and kiosk
 * (which only ever renders what the backend hands it, never invents a
 * department/doctor/ticket itself).
 *
 * The mock dataset behind these types lives in
 * apps/backend/src/services/hospital/mockHospitalData.ts, clearly isolated
 * so it can be replaced by a real hospital API/database later without
 * touching this contract or any consumer of it.
 */

export interface Doctor {
  id: string;
  name: string;
  departmentId: string;
  specialization: string;
  /** Human-readable available timing window, e.g. "9:00 AM – 1:00 PM". */
  availableTimings: string;
  /** How many patients are currently ahead in this doctor's queue. */
  currentQueueLength: number;
  /** Rough estimated wait in minutes for a patient joining now. */
  estimatedWaitMinutes: number;
  isAvailableToday: boolean;
  isActive?: boolean;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  isActive?: boolean;
}

/** A department bundled with its doctors — the shape the kiosk actually
 * renders (avoids a second round-trip to look up doctors per department). */
export interface DepartmentWithDoctors extends Department {
  doctors: Doctor[];
}

export interface OPTicket {
  ticketNumber: string;
  departmentName: string;
  doctorName: string;
  estimatedWaitMinutes: number;
  issuedAt: string;
  patientId?: string;
  patientName?: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  address?: string;
  idPhotoRef?: string;
  registeredAt: string;
}

/**
 * Structured, backend-authoritative conversation state — deliberately NOT
 * left to the LLM's implicit memory (CLAUDE.md §5.2, and the explicit
 * instruction not to hard-code the conversation into a chain of if/else).
 * Updated only by real tool-call results (see services/conversation/), so
 * whatever the kiosk renders always traces back to real backend data.
 */
export interface ConversationState {
  /** Free-text reason the patient gave, if any — never a diagnosis, just
   * what they said (e.g. "tooth pain"). Shown back to the patient verbatim
   * in the summary, never elaborated on by the AI. */
  reasonText: string | null;
  departmentsShown: Department[];
  selectedDepartment: Department | null;
  doctorsShown: Doctor[];
  selectedDoctor: Doctor | null;
  /** True once enough is known to offer ticket generation — see
   * services/conversation/conversationState.ts for the exact rule. */
  readyForTicket: boolean;
  ticket: OPTicket | null;
  /** Patient explicitly said they want to end the conversation. */
  wantsToEnd: boolean;
  
  // Phase 6: Identity verification flow state
  patientFlowState: "none" | "choice" | "existing_input" | "new_input" | "camera" | "verified";
  patientRecord: Patient | null;
  currentUIState?: { stateId: string; summary: string };
}

export function createInitialConversationState(): ConversationState {
  return {
    reasonText: null,
    departmentsShown: [],
    selectedDepartment: null,
    doctorsShown: [],
    selectedDoctor: null,
    readyForTicket: false,
    ticket: null,
    wantsToEnd: false,
    patientFlowState: "none",
    patientRecord: null,
  };
}
