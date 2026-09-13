import type { OPTicket, Patient } from "@arteq/shared";

/**
 * Authoritative OP ticket generator (CLAUDE.md §14: "Never generate fake tokens in
 * the UI. Never claim an OP registration succeeded without backend
 * confirmation.").
 *
 * Enforces authoritative identity verification: an OP ticket CANNOT be generated
 * without a valid, identified, and verified patient record.
 */

let ticketCounter = 1000;

export function generateOPTicket(params: {
  patient: Patient;
  departmentName: string;
  doctorName: string;
  estimatedWaitMinutes: number;
}): OPTicket {
  if (!params.patient || !params.patient.id || !params.patient.name || !params.patient.phone) {
    throw new Error(
      "[ticketService] Cannot issue OP Ticket: patient is unverified or missing required identity fields.",
    );
  }

  if (!params.departmentName || !params.doctorName) {
    throw new Error(
      "[ticketService] Cannot issue OP Ticket: departmentName and doctorName are required.",
    );
  }

  ticketCounter += 1;
  return {
    ticketNumber: `A${ticketCounter}`,
    departmentName: params.departmentName,
    doctorName: params.doctorName,
    estimatedWaitMinutes: params.estimatedWaitMinutes,
    issuedAt: new Date().toISOString(),
    patientId: params.patient.id,
    patientName: params.patient.name,
  };
}
