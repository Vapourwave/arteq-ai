import { Patient, PatientGender, PatientStatus } from '../types';

const STORAGE_KEY = 'abc_hospital_patients_store_v1';

// Seed demo patients for realistic initial state
const SEED_PATIENTS: Patient[] = [
  {
    id: 'PAT-000001',
    patientName: 'Rahul Kumar',
    age: 32,
    dob: '1994-02-14',
    gender: 'Male',
    phone: '9876543210',
    address: '42 MG Road, Indiranagar, City 560038',
    registrationDate: new Date().toISOString().split('T')[0],
    status: 'Active',
    priority: 'Normal',
    visitCount: 2,
    lastVisitDate: new Date().toISOString().split('T')[0],
  },
  {
    id: 'PAT-000002',
    patientName: 'Anjali Sharma',
    age: 28,
    dob: '1998-07-21',
    gender: 'Female',
    phone: '9812345678',
    address: '15 Park Street, Koramangala, City 560034',
    registrationDate: new Date().toISOString().split('T')[0],
    status: 'In Visit',
    priority: 'Normal',
    visitCount: 1,
    lastVisitDate: new Date().toISOString().split('T')[0],
  },
  {
    id: 'PAT-000003',
    patientName: 'Arun Varma',
    age: 65,
    dob: '1961-11-05',
    gender: 'Male',
    phone: '9988776655',
    address: '88 Lake View Colony, City 560078',
    registrationDate: new Date().toISOString().split('T')[0],
    status: 'Active',
    priority: 'Senior Citizen',
    visitCount: 3,
    lastVisitDate: new Date().toISOString().split('T')[0],
  },
  {
    id: 'PAT-000004',
    patientName: 'Priya Nair',
    age: 41,
    dob: '1985-03-10',
    gender: 'Female',
    phone: '9765432109',
    address: '23 Green Park Avenue, City 560001',
    registrationDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    status: 'Completed',
    priority: 'Normal',
    visitCount: 4,
    lastVisitDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
  },
  {
    id: 'PAT-000005',
    patientName: 'Karthik Raja',
    age: 24,
    dob: '2002-09-18',
    gender: 'Male',
    phone: '9543210987',
    address: '104 Station Road, City 560002',
    registrationDate: new Date().toISOString().split('T')[0],
    status: 'Active',
    priority: 'Normal',
    visitCount: 1,
    lastVisitDate: new Date().toISOString().split('T')[0],
  },
  {
    id: 'PAT-000006',
    patientName: 'Aarav Sharma',
    age: 6,
    dob: '2020-04-12',
    gender: 'Male',
    phone: '9432109876',
    address: '15 Park Street, Koramangala, City 560034',
    registrationDate: new Date().toISOString().split('T')[0],
    status: 'In Visit',
    priority: 'Normal',
    visitCount: 1,
    lastVisitDate: new Date().toISOString().split('T')[0],
  },
  {
    id: 'PAT-000007',
    patientName: 'Devika Pillai',
    age: 68,
    dob: '1958-01-25',
    gender: 'Female',
    phone: '9321098765',
    address: '5 Main Road, Jayanagar, City 560011',
    registrationDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    status: 'Completed',
    priority: 'Senior Citizen',
    visitCount: 5,
    lastVisitDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
  },
  {
    id: 'PAT-000008',
    patientName: 'Vikram Singh',
    age: 52,
    dob: '1974-06-30',
    gender: 'Male',
    phone: '9210987654',
    address: '77 Ring Road, City 560068',
    registrationDate: new Date(Date.now() - 172800000).toISOString().split('T')[0],
    status: 'Completed',
    priority: 'Normal',
    visitCount: 2,
    lastVisitDate: new Date(Date.now() - 172800000).toISOString().split('T')[0],
  },
];

type Listener = (patients: Patient[]) => void;
const listeners: Set<Listener> = new Set();

function notifyListeners(patients: Patient[]) {
  listeners.forEach((listener) => listener(patients));
}

/**
 * Load patients from local storage or seed data.
 */
export function getPatients(): Patient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse stored patient records', e);
  }

  // Fallback to initial seeds
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_PATIENTS));
  } catch (e) {
    // ignore
  }
  return SEED_PATIENTS;
}

/**
 * Save updated list to localStorage and notify listeners.
 */
function saveAllPatients(patients: Patient[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
  } catch (e) {
    console.error('Failed to save patients to localStorage', e);
  }
  notifyListeners(patients);
}

/**
 * Subscribe to real-time updates in the patient store.
 */
export function subscribePatients(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get a specific patient by ID (e.g. PAT-000001).
 */
export function getPatientById(id: string): Patient | undefined {
  const list = getPatients();
  return list.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

/**
 * Check if a patient with a matching phone number exists.
 */
export function findDuplicateByPhone(phone: string): Patient | undefined {
  if (!phone) return undefined;
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 5) return undefined;

  const list = getPatients();
  return list.find((p) => {
    const pClean = p.phone.replace(/\D/g, '');
    return pClean === cleanPhone || (cleanPhone.length >= 10 && pClean.endsWith(cleanPhone.slice(-10)));
  });
}

/**
 * Generate next sequential Patient ID: "PAT-000001", "PAT-000002"...
 */
export function generateNextPatientId(): string {
  const list = getPatients();
  let maxNum = 0;

  list.forEach((p) => {
    if (p.id && p.id.startsWith('PAT-')) {
      const numPart = parseInt(p.id.replace('PAT-', ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  });

  const nextNum = maxNum + 1;
  const formattedNum = String(nextNum).padStart(6, '0');
  return `PAT-${formattedNum}`;
}

/**
 * Save a newly registered patient. Auto-generates ID if not supplied.
 */
export function saveNewPatient(patientData: {
  patientName: string;
  age: number;
  dob?: string;
  gender: PatientGender;
  phone: string;
  address?: string;
  priority?: 'Normal' | 'Senior Citizen' | 'Emergency';
  id?: string;
}): Patient {
  const list = getPatients();
  const id = patientData.id || generateNextPatientId();
  const todayStr = new Date().toISOString().split('T')[0];

  const newPatient: Patient = {
    id,
    patientName: patientData.patientName.trim(),
    age: Number(patientData.age) || 0,
    dob: patientData.dob || undefined,
    gender: patientData.gender,
    phone: patientData.phone.trim(),
    address: patientData.address ? patientData.address.trim() : undefined,
    registrationDate: todayStr,
    status: 'Active',
    priority: patientData.priority || 'Normal',
    visitCount: 1,
    lastVisitDate: todayStr,
  };

  const updatedList = [newPatient, ...list];
  saveAllPatients(updatedList);
  return newPatient;
}

/**
 * Update an existing patient's basic information.
 */
export function updatePatient(
  id: string,
  updates: Partial<Omit<Patient, 'id'>>
): Patient | undefined {
  const list = getPatients();
  let updatedRecord: Patient | undefined;

  const updatedList = list.map((p) => {
    if (p.id.toLowerCase() === id.toLowerCase()) {
      updatedRecord = {
        ...p,
        ...updates,
      };
      return updatedRecord;
    }
    return p;
  });

  if (updatedRecord) {
    saveAllPatients(updatedList);
  }

  return updatedRecord;
}

/**
 * Get count of patients registered today.
 */
export function getPatientsTodayCount(): number {
  const list = getPatients();
  const todayStr = new Date().toISOString().split('T')[0];
  return list.filter((p) => p.registrationDate === todayStr).length;
}
