import { describe, expect, it } from "vitest";
import { generateOPTicket } from "./ticketService.js";
import type { Patient } from "@arteq/shared";

const mockPatient: Patient = {
  id: "pat-1000",
  name: "John Doe",
  phone: "5550100",
  registeredAt: new Date().toISOString(),
};

describe("generateOPTicket — authoritative ticket generator", () => {
  it("produces a ticket carrying verified patient and department/doctor info", () => {
    const ticket = generateOPTicket({
      patient: mockPatient,
      departmentName: "Dentistry",
      doctorName: "Dr. Anjali Menon",
      estimatedWaitMinutes: 25,
    });
    expect(ticket.patientId).toBe("pat-1000");
    expect(ticket.patientName).toBe("John Doe");
    expect(ticket.departmentName).toBe("Dentistry");
    expect(ticket.doctorName).toBe("Dr. Anjali Menon");
    expect(ticket.estimatedWaitMinutes).toBe(25);
    expect(ticket.ticketNumber).toMatch(/^A\d+$/);
    expect(new Date(ticket.issuedAt).toString()).not.toBe("Invalid Date");
  });

  it("rejects ticket generation if patient is missing or unverified", () => {
    expect(() =>
      generateOPTicket({
        patient: null as unknown as Patient,
        departmentName: "Dentistry",
        doctorName: "Dr. Anjali Menon",
        estimatedWaitMinutes: 25,
      }),
    ).toThrowError(/patient is unverified/);

    expect(() =>
      generateOPTicket({
        patient: { id: "", name: "", phone: "", registeredAt: "" },
        departmentName: "Dentistry",
        doctorName: "Dr. Anjali Menon",
        estimatedWaitMinutes: 25,
      }),
    ).toThrowError(/patient is unverified/);
  });

  it("never reuses the same ticket number across two calls", () => {
    const a = generateOPTicket({ patient: mockPatient, departmentName: "X", doctorName: "Y", estimatedWaitMinutes: 1 });
    const b = generateOPTicket({ patient: mockPatient, departmentName: "X", doctorName: "Y", estimatedWaitMinutes: 1 });
    expect(a.ticketNumber).not.toBe(b.ticketNumber);
  });
});
