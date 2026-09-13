import { describe, expect, it } from "vitest";
import { createInitialConversationState, type ConversationState } from "@arteq/shared";
import { describePatientUnderstanding } from "./patientUnderstanding";

function state(overrides: Partial<ConversationState>): ConversationState {
  return { ...createInitialConversationState(), ...overrides };
}

const dentistry = { id: "dept-dentistry", name: "Dentistry", description: "Tooth, gum, and jaw care." };
const drNair = {
  id: "doc-2",
  name: "Dr. Rahul Nair",
  departmentId: "dept-dentistry",
  specialization: "Orthodontics",
  availableTimings: "2:00 PM – 6:00 PM",
  currentQueueLength: 1,
  estimatedWaitMinutes: 10,
  isAvailableToday: true,
};

describe("describePatientUnderstanding", () => {
  it("returns null when nothing has been understood yet (never invents a statement)", () => {
    expect(describePatientUnderstanding(createInitialConversationState())).toBeNull();
  });

  it("returns null for an empty / whitespace-only reason with no routing", () => {
    expect(describePatientUnderstanding(state({ reasonText: "   " }))).toBeNull();
  });

  it("echoes just the reason phrase Gemini extracted when no department matched yet", () => {
    expect(describePatientUnderstanding(state({ reasonText: "tooth pain" }))).toBe(
      "I understood you mentioned tooth pain.",
    );
  });

  it("names the department when the patient asked for one directly", () => {
    expect(describePatientUnderstanding(state({ selectedDepartment: dentistry }))).toBe(
      "I understood you'd like to visit Dentistry.",
    );
  });

  it("combines the reason and the routed department", () => {
    expect(
      describePatientUnderstanding(state({ reasonText: "tooth pain", selectedDepartment: dentistry })),
    ).toBe("I understood you'd like help with tooth pain — I can take you to Dentistry.");
  });

  it("names the doctor and reason once a doctor is selected", () => {
    expect(
      describePatientUnderstanding(
        state({ reasonText: "tooth pain", selectedDepartment: dentistry, selectedDoctor: drNair }),
      ),
    ).toBe("I understood you'd like to see Dr. Rahul Nair for tooth pain.");
  });

  it("names the doctor and department when there is no free-text reason", () => {
    expect(
      describePatientUnderstanding(state({ selectedDepartment: dentistry, selectedDoctor: drNair })),
    ).toBe("I understood you'd like to see Dr. Rahul Nair in Dentistry.");
  });
});
