import { describe, expect, it } from "vitest";
import { createInitialConversationState } from "@arteq/shared";
import {
  applyDepartmentSelected,
  applyDepartmentsShown,
  applyDoctorSelected,
  applyDoctorsShown,
  applyReasonProvided,
  applyTicketGenerated,
  applyWantsToEnd,
} from "./conversationState.js";

const dentistry = { id: "dept-dentistry", name: "Dentistry", description: "Tooth care." };
const orthopedics = { id: "dept-orthopedics", name: "Orthopedics", description: "Bone care." };
const doctorA = {
  id: "doc-1",
  name: "Dr. A",
  departmentId: "dept-dentistry",
  specialization: "General Dentistry",
  availableTimings: "9-1",
  currentQueueLength: 2,
  estimatedWaitMinutes: 15,
  isAvailableToday: true,
};

describe("conversationState reducers — initial state", () => {
  it("starts with nothing selected and not ready for a ticket", () => {
    const state = createInitialConversationState();
    expect(state.selectedDepartment).toBeNull();
    expect(state.selectedDoctor).toBeNull();
    expect(state.readyForTicket).toBe(false);
    expect(state.ticket).toBeNull();
  });
});

describe("conversationState reducers — never ready for a ticket prematurely", () => {
  it("showing departments alone does not make it ready", () => {
    const state = applyDepartmentsShown(createInitialConversationState(), [dentistry, orthopedics]);
    expect(state.readyForTicket).toBe(false);
  });

  it("selecting a department alone does not make it ready (doctor still required)", () => {
    const state = applyDepartmentSelected(createInitialConversationState(), dentistry);
    expect(state.readyForTicket).toBe(false);
  });

  it("showing doctors without selecting one does not make it ready", () => {
    let state = applyDepartmentSelected(createInitialConversationState(), dentistry);
    state = applyDoctorsShown(state, [doctorA]);
    expect(state.readyForTicket).toBe(false);
  });
});

describe("conversationState reducers — ready once department + doctor are both selected", () => {
  it("becomes ready only after both a department and a doctor are selected", () => {
    let state = createInitialConversationState();
    state = applyDepartmentSelected(state, dentistry);
    state = applyDoctorsShown(state, [doctorA]);
    state = applyDoctorSelected(state, doctorA);
    expect(state.readyForTicket).toBe(true);
    expect(state.selectedDoctor).toEqual(doctorA);
  });
});

describe("conversationState reducers — selecting a new department clears stale doctor state", () => {
  it("resets doctorsShown/selectedDoctor/readyForTicket/ticket when the department changes", () => {
    let state = createInitialConversationState();
    state = applyDepartmentSelected(state, dentistry);
    state = applyDoctorsShown(state, [doctorA]);
    state = applyDoctorSelected(state, doctorA);
    expect(state.readyForTicket).toBe(true);

    // Patient changes their mind to a different department.
    state = applyDepartmentSelected(state, orthopedics);
    expect(state.selectedDoctor).toBeNull();
    expect(state.doctorsShown).toEqual([]);
    expect(state.readyForTicket).toBe(false);
    expect(state.ticket).toBeNull();
  });
});

describe("conversationState reducers — reason, ticket, and end-of-conversation", () => {
  it("stores the patient's stated reason verbatim, never elaborates on it", () => {
    const state = applyReasonProvided(createInitialConversationState(), "tooth pain");
    expect(state.reasonText).toBe("tooth pain");
  });

  it("stores a generated ticket", () => {
    const ticket = {
      ticketNumber: "A1001",
      departmentName: "Dentistry",
      doctorName: "Dr. A",
      estimatedWaitMinutes: 15,
      issuedAt: new Date().toISOString(),
    };
    const state = applyTicketGenerated(createInitialConversationState(), ticket);
    expect(state.ticket).toEqual(ticket);
  });

  it("marks wantsToEnd without touching anything else", () => {
    const before = createInitialConversationState();
    const after = applyWantsToEnd(before);
    expect(after.wantsToEnd).toBe(true);
    expect(after.selectedDepartment).toBe(before.selectedDepartment);
  });
});
