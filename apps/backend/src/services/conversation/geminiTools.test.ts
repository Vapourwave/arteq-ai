import { describe, expect, it } from "vitest";
import { createInitialConversationState } from "@arteq/shared";
import { handleHospitalToolCall } from "./geminiTools.js";

describe("handleHospitalToolCall — find_department", () => {
  it("finds Dentistry for 'tooth pain' and updates state", () => {
    const { response, newState } = handleHospitalToolCall(
      "find_department",
      { reason_text: "tooth pain" },
      createInitialConversationState(),
    );
    expect(response.found).toBe(true);
    expect(newState.reasonText).toBe("tooth pain");
    expect(newState.selectedDepartment?.id).toBe("dept-dentistry");
  });

  it("reports found:false for ambiguous text, never guesses a department", () => {
    const { response, newState } = handleHospitalToolCall(
      "find_department",
      { reason_text: "I don't feel well" },
      createInitialConversationState(),
    );
    expect(response.found).toBe(false);
    expect(newState.selectedDepartment).toBeNull();
    // The reason is still recorded even when unmatched — real patient words
    // are never discarded just because they weren't understood.
    expect(newState.reasonText).toBe("I don't feel well");
  });
});

describe("handleHospitalToolCall — list_departments / select_department", () => {
  it("lists real departments and records them as shown", () => {
    const { response, newState } = handleHospitalToolCall("list_departments", {}, createInitialConversationState());
    expect(Array.isArray(response.departments)).toBe(true);
    expect((response.departments as unknown[]).length).toBeGreaterThan(0);
    expect(newState.departmentsShown.length).toBeGreaterThan(0);
  });

  it("select_department with an unknown id reports found:false and leaves state untouched", () => {
    const before = createInitialConversationState();
    const { response, newState } = handleHospitalToolCall("select_department", { department_id: "nope" }, before);
    expect(response.found).toBe(false);
    expect(newState).toEqual(before);
  });
});

describe("handleHospitalToolCall — list_doctors / find_shortest_queue_doctor / select_doctor", () => {
  it("lists real doctors for a department", () => {
    const { response, newState } = handleHospitalToolCall(
      "list_doctors",
      { department_id: "dept-dentistry" },
      createInitialConversationState(),
    );
    expect((response.doctors as unknown[]).length).toBeGreaterThan(0);
    expect(newState.doctorsShown.length).toBeGreaterThan(0);
  });

  it("finds the real shortest-queue doctor deterministically", () => {
    const { response } = handleHospitalToolCall(
      "find_shortest_queue_doctor",
      { department_id: "dept-dentistry" },
      createInitialConversationState(),
    );
    expect(response.found).toBe(true);
  });

  it("select_doctor makes the state ready for a ticket only once a department is also selected", () => {
    let state = createInitialConversationState();
    ({ newState: state } = handleHospitalToolCall("select_department", { department_id: "dept-dentistry" }, state));
    ({ newState: state } = handleHospitalToolCall("select_doctor", { doctor_id: "doc-1" }, state));
    expect(state.selectedDoctor?.id).toBe("doc-1");
    expect(state.readyForTicket).toBe(true);
  });
});

describe("handleHospitalToolCall — generate_op_ticket refuses without a confirmed selection and verified patient", () => {
  it("refuses to generate a ticket when no doctor is selected — never fabricates one", () => {
    const { response, newState } = handleHospitalToolCall("generate_op_ticket", {}, createInitialConversationState());
    expect(response.success).toBe(false);
    expect(newState.ticket).toBeNull();
  });

  it("refuses to generate a ticket without verified patient identity even if doctor is selected", () => {
    let state = createInitialConversationState();
    ({ newState: state } = handleHospitalToolCall("select_department", { department_id: "dept-dentistry" }, state));
    ({ newState: state } = handleHospitalToolCall("select_doctor", { doctor_id: "doc-1" }, state));
    const { response, newState } = handleHospitalToolCall("generate_op_ticket", {}, state);
    expect(response.success).toBe(false);
    expect(response.requires_identification).toBe(true);
    expect(newState.patientFlowState).toBe("choice");
    expect(newState.ticket).toBeNull();
  });

  it("generates a real ticket once department + doctor are selected AND patient is verified", () => {
    let state = createInitialConversationState();
    ({ newState: state } = handleHospitalToolCall("select_department", { department_id: "dept-dentistry" }, state));
    ({ newState: state } = handleHospitalToolCall("select_doctor", { doctor_id: "doc-1" }, state));
    state.patientFlowState = "verified";
    state.patientRecord = {
      id: "pat-1000",
      name: "John Doe",
      phone: "5550100",
      registeredAt: new Date().toISOString(),
    };
    const { response, newState } = handleHospitalToolCall("generate_op_ticket", {}, state);
    expect(response.success).toBe(true);
    expect(newState.ticket).not.toBeNull();
    expect(newState.ticket?.doctorName).toBe(state.selectedDoctor?.name);
    expect(newState.ticket?.patientId).toBe("pat-1000");
  });
});

describe("handleHospitalToolCall — end_conversation", () => {
  it("marks wantsToEnd", () => {
    const { newState } = handleHospitalToolCall("end_conversation", {}, createInitialConversationState());
    expect(newState.wantsToEnd).toBe(true);
  });
});

describe("handleHospitalToolCall — unknown tool name", () => {
  it("returns an error response without throwing or mutating state", () => {
    const before = createInitialConversationState();
    const { response, newState } = handleHospitalToolCall("not_a_real_tool", {}, before);
    expect(response.error).toBeTruthy();
    expect(newState).toEqual(before);
  });
});
