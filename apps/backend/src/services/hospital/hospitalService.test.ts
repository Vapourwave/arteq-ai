import { describe, expect, it } from "vitest";
import {
  findShortestQueueDoctor,
  getDepartment,
  getDoctor,
  listDepartments,
  listDoctors,
  matchDepartmentByText,
} from "./hospitalService.js";

describe("hospitalService — deterministic reads (closed-world)", () => {
  it("lists all mock departments", () => {
    const departments = listDepartments();
    expect(departments.length).toBeGreaterThan(0);
    expect(departments.some((d) => d.id === "dept-dentistry")).toBe(true);
  });

  it("returns null for an unknown department id, never invents one", () => {
    expect(getDepartment("dept-does-not-exist")).toBeNull();
  });

  it("returns null for an unknown doctor id", () => {
    expect(getDoctor("doc-does-not-exist")).toBeNull();
  });

  it("lists only doctors belonging to the requested department", () => {
    const doctors = listDoctors("dept-dentistry");
    expect(doctors.length).toBeGreaterThan(0);
    expect(doctors.every((d) => d.departmentId === "dept-dentistry")).toBe(true);
  });

  it("an unrelated department returns an empty doctor list, not an error", () => {
    expect(listDoctors("dept-does-not-exist")).toEqual([]);
  });
});

describe("matchDepartmentByText — closed-world, no invented departments", () => {
  it("matches English 'tooth pain' to Dentistry", () => {
    const result = matchDepartmentByText("I have tooth pain");
    expect(result?.id).toBe("dept-dentistry");
  });

  it("matches Manglish 'pallu vedhana' to Dentistry", () => {
    const result = matchDepartmentByText("enikku pallu vedhana undu");
    expect(result?.id).toBe("dept-dentistry");
  });

  it("matches 'skin rash' to Dermatology", () => {
    const result = matchDepartmentByText("I have a skin rash");
    expect(result?.id).toBe("dept-dermatology");
  });

  it("matches 'knee pain' to Orthopedics", () => {
    const result = matchDepartmentByText("my knee hurts");
    expect(result?.id).toBe("dept-orthopedics");
  });

  it("does NOT guess a department for generic/ambiguous text — real captured concern from this project's own investigations", () => {
    // Mirrors the ambiguity test this project has enforced elsewhere
    // (CLAUDE.md §16 / §35): "I don't feel well" must never silently route
    // anywhere, especially not default to General Medicine.
    expect(matchDepartmentByText("I don't feel well")).toBeNull();
  });

  it("does not route generic 'pain'/'vedhana' alone to any specific department", () => {
    expect(matchDepartmentByText("I have vedhana")).toBeNull();
  });
});

describe("findShortestQueueDoctor — deterministic, explainable rule", () => {
  it("picks the doctor with the lowest currentQueueLength in the department", () => {
    const doctor = findShortestQueueDoctor("dept-dentistry");
    expect(doctor).not.toBeNull();
    const allDentistry = listDoctors("dept-dentistry").filter((d) => d.isAvailableToday);
    const trueMin = Math.min(...allDentistry.map((d) => d.currentQueueLength));
    expect(doctor?.currentQueueLength).toBe(trueMin);
  });

  it("never returns a doctor who isn't available today", () => {
    const doctor = findShortestQueueDoctor("dept-ent");
    // The only ENT doctor in the mock dataset is NOT available today —
    // real captured fixture from mockHospitalData.ts, not invented.
    expect(doctor).toBeNull();
  });

  it("returns null for a department with no doctors", () => {
    expect(findShortestQueueDoctor("dept-does-not-exist")).toBeNull();
  });
});
