import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Department, DepartmentWithDoctors, Doctor } from "@arteq/shared";
import { DEFAULT_HOSPITAL_MEMORY, DEFAULT_WELCOME_GREETING, DEPARTMENT_KEYWORD_ALIASES, MOCK_DEPARTMENTS, MOCK_DOCTORS } from "./mockHospitalData.js";

/**
 * The ONE place that reads the mock hospital dataset. Every caller —
 * Gemini tool-call handlers, tests, any future real routing logic — goes
 * through here, never `mockHospitalData.ts` directly. This is the seam a
 * real hospital API/database integration replaces later.
 */

export function listDepartments(): Department[] {
  // Only return active departments to the patient logic, but for admin we need all.
  // Wait, let's keep listDepartments returning all, and filter later, or add isActive?
  // The spec says: "Disabled departments must NOT be offered to patients."
  // So we should add isActive to the Department model first!
  return MOCK_DEPARTMENTS;
}

export function getDepartment(departmentId: string): Department | null {
  return MOCK_DEPARTMENTS.find((d) => d.id === departmentId) ?? null;
}

export function listDoctors(departmentId: string): Doctor[] {
  return MOCK_DOCTORS.filter((d) => d.departmentId === departmentId);
}

export function getDoctor(doctorId: string): Doctor | null {
  return MOCK_DOCTORS.find((d) => d.id === doctorId) ?? null;
}

export function listDepartmentsWithDoctors(): DepartmentWithDoctors[] {
  return MOCK_DEPARTMENTS.map((department) => ({
    ...department,
    doctors: listDoctors(department.id),
  }));
}

/**
 * Closed-world department matching (CLAUDE.md §15-16): tries to find a
 * department from free-text symptom/request wording using the deterministic
 * alias map — never an LLM guess, never invents a department that doesn't
 * exist. Returns null on no confident match; callers MUST treat null as
 * "ask a clarifying question," never "default to General Medicine"
 * (CLAUDE.md §16 explicitly forbids that).
 */
export function matchDepartmentByText(text: string): Department | null {
  const normalized = text.toLowerCase();
  for (const [keyword, departmentId] of Object.entries(DEPARTMENT_KEYWORD_ALIASES)) {
    if (normalized.includes(keyword)) {
      return getDepartment(departmentId);
    }
  }
  return null;
}

/** Picks the doctor with the shortest current queue in a department — a
 * deterministic, explainable rule (not an LLM judgment call) for the
 * "which doctor has the shortest queue?" intent. Only considers doctors
 * available today. */
export function findShortestQueueDoctor(departmentId: string): Doctor | null {
  const available = listDoctors(departmentId).filter((d) => d.isAvailableToday);
  if (available.length === 0) return null;
  return available.reduce((shortest, current) =>
    current.currentQueueLength < shortest.currentQueueLength ? current : shortest,
  );
}

// --- Admin Management Mutators ---

export function updateDepartment(departmentId: string, updates: Partial<Department>): Department | null {
  const dept = getDepartment(departmentId);
  if (!dept) return null;
  Object.assign(dept, updates);
  return dept;
}

export function updateDoctor(doctorId: string, updates: Partial<Doctor>): Doctor | null {
  const doc = getDoctor(doctorId);
  if (!doc) return null;
  Object.assign(doc, updates);
  return doc;
}

// --- Admin Hospital Memory ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../../data");
const MEMORY_FILE_PATH = path.join(DATA_DIR, "hospital_memory.txt");

function loadInitialMemory(): string {
  try {
    if (fs.existsSync(MEMORY_FILE_PATH)) {
      return fs.readFileSync(MEMORY_FILE_PATH, "utf-8");
    }
  } catch (err) {
    console.warn("[hospitalService] Could not read memory file:", err);
  }
  return DEFAULT_HOSPITAL_MEMORY;
}

let currentHospitalMemory = loadInitialMemory();

export function getHospitalMemory(): string {
  return currentHospitalMemory;
}

export function setHospitalMemory(memory: string): string {
  currentHospitalMemory = memory;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(MEMORY_FILE_PATH, memory, "utf-8");
  } catch (err) {
    console.warn("[hospitalService] Could not persist memory file:", err);
  }
  return currentHospitalMemory;
}

// --- Admin Welcome Greeting ---

const GREETING_FILE_PATH = path.join(DATA_DIR, "welcome_greeting.txt");

function loadInitialGreeting(): string {
  try {
    if (fs.existsSync(GREETING_FILE_PATH)) {
      return fs.readFileSync(GREETING_FILE_PATH, "utf-8");
    }
  } catch (err) {
    console.warn("[hospitalService] Could not read greeting file:", err);
  }
  return DEFAULT_WELCOME_GREETING;
}

let currentWelcomeGreeting = loadInitialGreeting();

export function getWelcomeGreeting(): string {
  return currentWelcomeGreeting;
}

export function setWelcomeGreeting(greeting: string): string {
  currentWelcomeGreeting = greeting;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(GREETING_FILE_PATH, greeting, "utf-8");
  } catch (err) {
    console.warn("[hospitalService] Could not persist greeting file:", err);
  }
  return currentWelcomeGreeting;
}
