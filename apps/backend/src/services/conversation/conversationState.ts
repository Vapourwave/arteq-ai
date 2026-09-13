import type { ConversationState, Department, Doctor, OPTicket } from "@arteq/shared";

/**
 * Pure reducer functions over ConversationState — the explicit,
 * structured conversation model requested instead of relying on the LLM's
 * implicit memory or a chain of if/else statements. Every function takes
 * the current state and real data (department/doctor objects that came
 * from hospitalService, never from the LLM's own words) and returns a new
 * state. Nothing here calls Gemini, reads mock data directly, or does any
 * I/O — that separation is what makes this independently testable and is
 * what geminiTools.ts's tool-call handlers sit on top of.
 */

export function applyReasonProvided(state: ConversationState, reasonText: string): ConversationState {
  return { ...state, reasonText };
}

export function applyDepartmentsShown(state: ConversationState, departments: Department[]): ConversationState {
  return { ...state, departmentsShown: departments };
}

export function applyDepartmentSelected(state: ConversationState, department: Department): ConversationState {
  // Selecting a (possibly different) department invalidates any
  // previously-shown/selected doctor — never leave a stale doctor selection
  // attached to a department the patient didn't actually pick that doctor
  // under.
  return {
    ...state,
    selectedDepartment: department,
    doctorsShown: [],
    selectedDoctor: null,
    readyForTicket: false,
    ticket: null,
  };
}

export function applyDoctorsShown(state: ConversationState, doctors: Doctor[]): ConversationState {
  return { ...state, doctorsShown: doctors };
}

export function applyDoctorSelected(state: ConversationState, doctor: Doctor): ConversationState {
  return {
    ...state,
    selectedDoctor: doctor,
    // Ready for ticket generation once both a department and a specific
    // doctor are established — the one explicit rule for when the UI's
    // primary action may switch from "Stop" to "Get OP Ticket" (see
    // KioskShell/VoiceView). Deliberately conservative: department alone
    // is not enough, matching "do not show Get OP Ticket prematurely."
    readyForTicket: Boolean(state.selectedDepartment),
  };
}

export function applyTicketGenerated(state: ConversationState, ticket: OPTicket): ConversationState {
  return { ...state, ticket };
}

export function applyWantsToEnd(state: ConversationState): ConversationState {
  return { ...state, wantsToEnd: true };
}
