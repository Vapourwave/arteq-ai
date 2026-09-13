import type { Department, Doctor } from "@arteq/shared";

/**
 * DEMO/MOCK hospital dataset — explicitly NOT real hospital data (CLAUDE.md
 * §26/§39: never pretend fabricated data is real). Clearly isolated in this
 * one file so a real hospital API/database can replace it later without
 * touching hospitalService.ts's query interface, the Gemini tool
 * declarations, or any UI component — everything else only ever calls the
 * functions in hospitalService.ts, never reaches into this file directly.
 */

export let MOCK_DEPARTMENTS: Department[] = [
  { id: "dept-dentistry", name: "Dentistry", description: "Tooth, gum, and jaw care.", isActive: true },
  { id: "dept-general-medicine", name: "General Medicine", description: "General health concerns and check-ups.", isActive: true },
  { id: "dept-orthopedics", name: "Orthopedics", description: "Bones, joints, and muscles.", isActive: true },
  { id: "dept-dermatology", name: "Dermatology", description: "Skin, hair, and nail conditions.", isActive: true },
  { id: "dept-ent", name: "ENT", description: "Ear, nose, and throat care.", isActive: true },
  { id: "dept-cardiology", name: "Cardiology", description: "Heart and circulation care.", isActive: true },
];

export let MOCK_DOCTORS: Doctor[] = [
  {
    id: "doc-1",
    name: "Dr. Anjali Menon",
    departmentId: "dept-dentistry",
    specialization: "General Dentistry",
    availableTimings: "9:00 AM – 1:00 PM",
    currentQueueLength: 3,
    estimatedWaitMinutes: 25,
    isAvailableToday: true,
    isActive: true,
  },
  {
    id: "doc-2",
    name: "Dr. Rahul Nair",
    departmentId: "dept-dentistry",
    specialization: "Dental & Orthodontics (Teeth)",
    availableTimings: "2:00 PM – 6:00 PM",
    currentQueueLength: 1,
    estimatedWaitMinutes: 10,
    isAvailableToday: true,
    isActive: true,
  },
  {
    id: "doc-3",
    name: "Dr. Priya Suresh",
    departmentId: "dept-general-medicine",
    specialization: "General Physician",
    availableTimings: "9:00 AM – 5:00 PM",
    currentQueueLength: 6,
    estimatedWaitMinutes: 40,
    isAvailableToday: true,
    isActive: true,
  },
  {
    id: "doc-4",
    name: "Dr. Thomas Varghese",
    departmentId: "dept-orthopedics",
    specialization: "Orthopedic Surgery",
    availableTimings: "10:00 AM – 2:00 PM",
    currentQueueLength: 2,
    estimatedWaitMinutes: 20,
    isAvailableToday: true,
    isActive: true,
  },
  {
    id: "doc-5",
    name: "Dr. Fathima Beevi",
    departmentId: "dept-dermatology",
    specialization: "Dermatology",
    availableTimings: "11:00 AM – 3:00 PM",
    currentQueueLength: 0,
    estimatedWaitMinutes: 5,
    isAvailableToday: true,
    isActive: true,
  },
  {
    id: "doc-6",
    name: "Dr. Sandeep Kumar",
    departmentId: "dept-ent",
    specialization: "ENT Surgery",
    availableTimings: "9:00 AM – 12:00 PM",
    currentQueueLength: 4,
    estimatedWaitMinutes: 30,
    isAvailableToday: false,
    isActive: true,
  },
  {
    id: "doc-7",
    name: "Dr. Meera Krishnan",
    departmentId: "dept-cardiology",
    specialization: "Cardiology",
    availableTimings: "9:00 AM – 1:00 PM",
    currentQueueLength: 2,
    estimatedWaitMinutes: 20,
    isAvailableToday: true,
    isActive: true,
  },
  {
    id: "doc-8",
    name: "Dr. Vinod Pillai",
    departmentId: "dept-cardiology",
    specialization: "Interventional Cardiology",
    availableTimings: "2:00 PM – 5:00 PM",
    currentQueueLength: 4,
    estimatedWaitMinutes: 35,
    isAvailableToday: true,
    isActive: true,
  },
];

/**
 * Closed-world keyword/alias map (CLAUDE.md §15-16): maps natural-language
 * symptom/request words — English, Malayalam (transliterated), Manglish —
 * to a real department id. Deliberately deterministic pattern matching, not
 * another LLM call: fast, testable, and impossible to hallucinate a
 * department that doesn't exist. Unmatched text returns no department,
 * which callers must treat as "ask a clarifying question," never "guess
 * General Medicine by default" (CLAUDE.md §16).
 */
export const DEPARTMENT_KEYWORD_ALIASES: Record<string, string> = {
  // Dentistry
  tooth: "dept-dentistry",
  teeth: "dept-dentistry",
  dental: "dept-dentistry",
  dentist: "dept-dentistry",
  gum: "dept-dentistry",
  pallu: "dept-dentistry", // Malayalam/Manglish for "tooth" — specific enough to map alone
  // "vedhana"/"pain" deliberately NOT mapped here — it's generic (could be
  // tooth, joint, headache, anywhere) and mapping it to dentistry would be
  // exactly the kind of unsafe over-eager default CLAUDE.md §16 forbids.
  // General Medicine
  fever: "dept-general-medicine",
  cold: "dept-general-medicine",
  cough: "dept-general-medicine",
  "general medicine": "dept-general-medicine",
  // Orthopedics
  bone: "dept-orthopedics",
  joint: "dept-orthopedics",
  fracture: "dept-orthopedics",
  knee: "dept-orthopedics",
  back: "dept-orthopedics",
  orthopedic: "dept-orthopedics",
  orthopedics: "dept-orthopedics",
  // Dermatology
  skin: "dept-dermatology",
  rash: "dept-dermatology",
  dermatology: "dept-dermatology",
  // ENT
  ear: "dept-ent",
  nose: "dept-ent",
  throat: "dept-ent",
  ent: "dept-ent",
  // Cardiology — deliberately only the unambiguous words. "chest pain" is
  // NOT mapped here: it can be cardiac, muscular, respiratory or anxiety-
  // related, and auto-routing it to Cardiology is exactly the over-eager
  // default CLAUDE.md §16 forbids — the model should ask, not assume.
  heart: "dept-cardiology",
  cardiac: "dept-cardiology",
  cardiology: "dept-cardiology",
  cardiologist: "dept-cardiology",
};

export const DEFAULT_HOSPITAL_MEMORY = `General Hospital Information:
- Visiting Hours: 4:00 PM – 7:00 PM on weekdays, 10:00 AM – 12:00 PM & 4:00 PM – 7:00 PM on Sundays.
- Pharmacy: Located on the Ground Floor next to Reception Counter 2. Open 24/7.
- Emergency / Casualty: Ground Floor East Wing. Open 24/7.
- Cafeteria: 2nd Floor, open from 7:00 AM to 9:00 PM.
- Wheelchairs & Stretcher Assistance: Available at the entrance gate and reception desk.
- Laboratory & Diagnostics: 1st Floor, Room 104. Sample collection begins at 7:30 AM.
- Drinking Water & Restrooms: Located near the elevator lobby on all floors.`;

export const DEFAULT_WELCOME_GREETING = "Welcome to ABC Hospital. Thangalk enth sahayam aanu vende?";
