import { Type, type FunctionDeclaration } from "@google/genai";
import type { ConversationState } from "@arteq/shared";
import * as hospitalService from "../hospital/hospitalService.js";
import { generateOPTicket } from "../hospital/ticketService.js";
import {
  applyDepartmentSelected,
  applyDepartmentsShown,
  applyDoctorSelected,
  applyDoctorsShown,
  applyReasonProvided,
  applyTicketGenerated,
  applyWantsToEnd,
} from "./conversationState.js";

/**
 * Gemini Live tool/function-calling surface (CLAUDE.md §5.2 "AI proposes,
 * backend decides" applied natively): the model can only ever learn about
 * or act on real departments/doctors/tickets by calling one of these
 * functions, which are handled entirely by our own deterministic backend
 * code (hospitalService/ticketService/conversationState) — it can never
 * invent a department, doctor, queue length, or ticket number, because
 * nothing in its own generation ever produces that data; it only narrates
 * what these functions actually returned.
 */
export const HOSPITAL_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "find_department",
    description:
      "Given the patient's stated reason/symptom in their own words, look up whether it maps to a known hospital department. Call this as soon as the patient explains what's wrong, before asking follow-up questions.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason_text: {
          type: Type.STRING,
          description: "The patient's stated reason, in their own words (e.g. 'tooth pain').",
        },
      },
      required: ["reason_text"],
    },
  },
  {
    name: "list_departments",
    description: "List all hospital departments. Call this when the patient doesn't know which department they need, or asks what's available.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "select_department",
    description: "Confirm the department the patient wants, once known (from find_department or the patient naming one directly from a list).",
    parameters: {
      type: Type.OBJECT,
      properties: { department_id: { type: Type.STRING } },
      required: ["department_id"],
    },
  },
  {
    name: "list_doctors",
    description: "List the doctors in a department, with their timings, current queue, and estimated wait. Call this once a department is selected and the patient wants to see a doctor. Defaults to the patient's currently selected department.",
    parameters: {
      type: Type.OBJECT,
      properties: { department_id: { type: Type.STRING, description: "ID or name of the department (e.g. dept-dentistry). Defaults to the patient's currently selected department." } },
      required: [],
    },
  },
  {
    name: "find_shortest_queue_doctor",
    description: "Find the doctor with the shortest current queue in the selected department. Call this specifically when the patient asks which doctor is fastest/has the shortest wait. Always search within the patient's currently selected department.",
    parameters: {
      type: Type.OBJECT,
      properties: { department_id: { type: Type.STRING, description: "ID or name of the department (e.g. dept-dentistry). Defaults to the patient's currently selected department." } },
      required: [],
    },
  },
  {
    name: "select_doctor",
    description: "Confirm the specific doctor the patient has chosen.",
    parameters: {
      type: Type.OBJECT,
      properties: { doctor_id: { type: Type.STRING } },
      required: ["doctor_id"],
    },
  },
  {
    name: "generate_op_ticket",
    description:
      "Generate the patient's OP ticket. Only call this once a department and a doctor have been selected, the patient's identity is verified, and the patient has confirmed they want to proceed. Never call this if patient is unverified.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "end_conversation",
    description: "Call this when the patient explicitly wants to stop or end the conversation without getting a ticket.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_hospital_info",
    description: "Get general hospital information, memory, facility locations, visiting hours, amenities, or rules provided by hospital administration.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

export interface ToolCallOutcome {
  /** Goes back to Gemini via session.sendToolResponse — real data only. */
  response: Record<string, unknown>;
  newState: ConversationState;
}

/**
 * Dispatches one real Gemini Live function call to the matching
 * deterministic backend logic. Never calls Gemini itself, never invents
 * data — every branch either reads hospitalService's real (mock) dataset or
 * reports that nothing matched, which the tool response's own shape makes
 * unambiguous to the model (an explicit `found: false` rather than a
 * silently empty/absent field it might paper over).
 */
export function handleHospitalToolCall(
  name: string,
  args: Record<string, unknown>,
  state: ConversationState,
): ToolCallOutcome {
  switch (name) {
    case "find_department": {
      const reasonText = typeof args.reason_text === "string" ? args.reason_text : "";
      let next = applyReasonProvided(state, reasonText);
      const department = hospitalService.matchDepartmentByText(reasonText);
      if (!department) {
        return { response: { found: false }, newState: next };
      }
      next = applyDepartmentSelected(next, department);
      const doctors = hospitalService.listDoctors(department.id);
      next = applyDoctorsShown(next, doctors);
      return { response: { found: true, department, doctors }, newState: next };
    }

    case "list_departments": {
      const departments = hospitalService.listDepartments();
      const next = applyDepartmentsShown(state, departments);
      return { response: { departments }, newState: next };
    }

    case "select_department": {
      const departmentId = typeof args.department_id === "string" ? args.department_id : "";
      let department = hospitalService.getDepartment(departmentId);
      if (!department) {
        // Fallback: Gemini might have passed the name instead of the ID (e.g. "orthopedic")
        department = hospitalService.matchDepartmentByText(departmentId);
      }
      if (!department) {
        return { response: { found: false }, newState: state };
      }
      let next = applyDepartmentSelected(state, department);
      if (next.departmentsShown.length === 0) {
        next = applyDepartmentsShown(next, hospitalService.listDepartments());
      }
      const doctors = hospitalService.listDoctors(department.id);
      next = applyDoctorsShown(next, doctors);
      return { response: { found: true, department, doctors }, newState: next };
    }

    case "list_doctors": {
      let departmentId = typeof args.department_id === "string" ? args.department_id.trim() : "";
      if (!departmentId && state.selectedDepartment) {
        departmentId = state.selectedDepartment.id;
      }
      let department = hospitalService.getDepartment(departmentId);
      if (!department) {
        department = hospitalService.matchDepartmentByText(departmentId);
      }
      if (!department && state.selectedDepartment) {
        department = state.selectedDepartment;
      }
      if (department) {
        departmentId = department.id;
      }
      const doctors = hospitalService.listDoctors(departmentId);
      const deptName = department?.name ?? state.selectedDepartment?.name ?? "";
      const doctorsWithDept = doctors.map((d) => ({ ...d, departmentName: deptName }));
      return {
        response: { department_id: departmentId, department_name: deptName, doctors: doctorsWithDept },
        newState: {
          ...applyDoctorsShown(state, doctors),
          selectedDepartment: department ?? state.selectedDepartment,
        },
      };
    }

    case "find_shortest_queue_doctor": {
      let departmentId = typeof args.department_id === "string" ? args.department_id.trim() : "";
      if (!departmentId && state.selectedDepartment) {
        departmentId = state.selectedDepartment.id;
      }
      let department = hospitalService.getDepartment(departmentId);
      if (!department) {
        department = hospitalService.matchDepartmentByText(departmentId);
      }
      if (!department && state.selectedDepartment) {
        department = state.selectedDepartment;
      }
      if (department) {
        departmentId = department.id;
      }
      const doctor = hospitalService.findShortestQueueDoctor(departmentId);
      if (!doctor) {
        return { response: { found: false, message: `No doctors available today in ${department?.name ?? "this department"}` }, newState: state };
      }
      const dept = department ?? hospitalService.getDepartment(doctor.departmentId) ?? state.selectedDepartment;
      const deptName = dept?.name ?? hospitalService.getDepartment(doctor.departmentId)?.name ?? "";
      const doctorWithDept = {
        ...doctor,
        departmentName: deptName,
      };
      return {
        response: {
          found: true,
          department_id: doctor.departmentId,
          department_name: deptName,
          doctor: doctorWithDept,
        },
        newState: {
          ...applyDoctorsShown(state, [doctor]),
          selectedDepartment: dept ?? state.selectedDepartment,
        },
      };
    }

    case "select_doctor": {
      const doctorId = typeof args.doctor_id === "string" ? args.doctor_id.trim() : "";
      let doctor = hospitalService.getDoctor(doctorId);
      if (!doctor) {
        const all = hospitalService.listDepartmentsWithDoctors().flatMap((d) => d.doctors);
        doctor = all.find((d) => d.name.toLowerCase().includes(doctorId.toLowerCase())) ?? null;
      }
      if (!doctor) {
        return { response: { found: false }, newState: state };
      }
      const department = hospitalService.getDepartment(doctor.departmentId) ?? state.selectedDepartment;
      let next = department ? applyDepartmentSelected(state, department) : state;
      next = applyDoctorSelected(next, doctor);
      return {
        response: {
          found: true,
          doctor: {
            ...doctor,
            departmentName: department?.name ?? "",
          },
        },
        newState: next,
      };
    }

    case "generate_op_ticket": {
      if (!state.readyForTicket || !state.selectedDepartment || !state.selectedDoctor) {
        // Deliberately refuses rather than fabricating a ticket — mirrors
        // CLAUDE.md §14 "never generate fake tokens... never claim
        // registration succeeded without backend confirmation" at the tool
        // level, not just the UI level.
        return {
          response: { success: false, reason: "A department and doctor must both be selected first." },
          newState: state,
        };
      }
      if (state.patientFlowState !== "verified" || !state.patientRecord) {
        return {
          response: {
            success: false,
            reason:
              "Patient identification required. The patient must verify their identity on the kiosk screen before an OP ticket can be issued. Please guide the patient to select Existing or New Patient on screen.",
            requires_identification: true,
          },
          newState: {
            ...state,
            patientFlowState: state.patientFlowState === "none" ? "choice" : state.patientFlowState,
          },
        };
      }
      const ticket = generateOPTicket({
        patient: state.patientRecord,
        departmentName: state.selectedDepartment.name,
        doctorName: state.selectedDoctor.name,
        estimatedWaitMinutes: state.selectedDoctor.estimatedWaitMinutes,
      });
      return { response: { success: true, ticket }, newState: applyTicketGenerated(state, ticket) };
    }

    case "end_conversation": {
      return { response: { acknowledged: true }, newState: applyWantsToEnd(state) };
    }

    case "get_hospital_info": {
      const memory = hospitalService.getHospitalMemory();
      return { response: { found: true, hospital_info: memory }, newState: state };
    }

    default:
      return { response: { error: `Unknown tool: ${name}` }, newState: state };
  }
}
