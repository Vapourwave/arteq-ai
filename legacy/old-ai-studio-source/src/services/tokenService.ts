import { PatientRecord, Department, TokenStatus, Doctor } from '../types';
import { MOCK_DEPARTMENTS } from '../data/mockData';

const SEQUENCE_STORAGE_KEY = 'abc_hospital_token_sequences_v1';

/**
 * Get the department prefix dynamically from department configuration or fallback.
 */
export function getDepartmentPrefix(departmentName: string, departmentsList: Department[] = MOCK_DEPARTMENTS): string {
  if (!departmentName) return 'G';
  
  const found = departmentsList.find(
    (d) => d.name.toLowerCase() === departmentName.toLowerCase() ||
           d.id.toLowerCase() === departmentName.toLowerCase() ||
           d.code.toLowerCase() === departmentName.toLowerCase()
  );

  if (found && found.prefix) {
    return found.prefix.toUpperCase();
  }

  // Fallback defaults
  const norm = departmentName.toLowerCase();
  if (norm.includes('dent')) return 'D';
  if (norm.includes('card')) return 'C';
  if (norm.includes('gen')) return 'GM';
  if (norm.includes('ped') || norm.includes('paed')) return 'P';
  if (norm.includes('orth')) return 'O';
  if (norm.includes('neur')) return 'N';

  // Default to first 2 chars or first letter
  const words = departmentName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return departmentName.slice(0, 2).toUpperCase();
}

/**
 * Standardize date key for sequence resets (YYYY-MM-DD or standard date string).
 */
export function getStandardDateKey(dateInput?: string): string {
  if (!dateInput) {
    return new Date().toISOString().split('T')[0];
  }

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  try {
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {
    // ignore
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Get today's user-friendly display date string (e.g. "12 August 2026").
 */
export function getFormattedDisplayDate(dateObj: Date = new Date()): string {
  return dateObj.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Get stored department sequence counters from localStorage.
 */
function getStoredSequences(): Record<string, Record<string, number>> {
  try {
    const raw = localStorage.getItem(SEQUENCE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse token sequences', e);
  }
  return {};
}

/**
 * Save updated department sequence counters to localStorage.
 */
function saveStoredSequences(sequences: Record<string, Record<string, number>>): void {
  try {
    localStorage.setItem(SEQUENCE_STORAGE_KEY, JSON.stringify(sequences));
  } catch (e) {
    console.error('Failed to save token sequences', e);
  }
}

/**
 * Calculate next sequential token number for a specific department and date.
 * Inspects both current queue state and persistent daily counter store.
 */
export function generateNextTokenNumber(
  departmentName: string,
  dateStr?: string,
  existingQueue: PatientRecord[] = [],
  departmentsList: Department[] = MOCK_DEPARTMENTS
): {
  tokenNumber: string;
  sequenceNumber: number;
  prefix: string;
} {
  const prefix = getDepartmentPrefix(departmentName, departmentsList);
  const dateKey = getStandardDateKey(dateStr);
  const displayDate = dateStr || getFormattedDisplayDate();

  // 1. Scan existing queue items for matching date & department prefix to find highest sequence
  let maxSeqFromQueue = 0;
  existingQueue.forEach((record) => {
    // Match date (either display date or ISO date key)
    const isSameDate =
      record.date === displayDate ||
      getStandardDateKey(record.date) === dateKey;

    const recordDeptPrefix = record.departmentPrefix || getDepartmentPrefix(record.department, departmentsList);

    if (isSameDate && recordDeptPrefix.toUpperCase() === prefix.toUpperCase()) {
      // Extract number part from "D-001", "C-024", "GM-005"
      const parts = record.tokenNumber.split('-');
      if (parts.length >= 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxSeqFromQueue) {
          maxSeqFromQueue = num;
        }
      }
    }
  });

  // 2. Scan localStorage stored sequences
  const stored = getStoredSequences();
  const dayStore = stored[dateKey] || {};
  const maxSeqFromStore = dayStore[prefix] || 0;

  // 3. Next sequence is max + 1
  const nextSeq = Math.max(maxSeqFromQueue, maxSeqFromStore) + 1;

  // Update store
  stored[dateKey] = {
    ...(stored[dateKey] || {}),
    [prefix]: nextSeq,
  };
  saveStoredSequences(stored);

  // Format as e.g. D-001, C-002, GM-005
  const formattedSeq = String(nextSeq).padStart(3, '0');
  const tokenNumber = `${prefix}-${formattedSeq}`;

  return {
    tokenNumber,
    sequenceNumber: nextSeq,
    prefix,
  };
}

/**
 * Generate OP Number in standard hospital format (e.g., OP-20260812-026).
 */
export function generateOpNumber(dateStr?: string, existingQueue: PatientRecord[] = []): string {
  const dateKey = getStandardDateKey(dateStr);
  const cleanDateStr = dateKey.replace(/-/g, ''); // e.g. 20260812

  // Count visits created today to determine OP index
  const todayVisitsCount = existingQueue.filter(
    (item) => getStandardDateKey(item.date) === dateKey
  ).length;

  const nextIndex = String(todayVisitsCount + 1).padStart(3, '0');
  return `OP-${cleanDateStr}-${nextIndex}`;
}

/**
 * Check if a patient already has an ACTIVE visit token in the specified department for today.
 * Active statuses are: 'Waiting', 'Called', 'Consulting'.
 */
export function checkActiveDuplicateVisit(
  patientIdentifier: { patientId?: string; phone?: string; patientName?: string },
  departmentName: string,
  dateStr: string = getFormattedDisplayDate(),
  queue: PatientRecord[] = []
): PatientRecord | undefined {
  if (!queue || queue.length === 0) return undefined;

  const targetDateKey = getStandardDateKey(dateStr);
  const targetDept = departmentName.trim().toLowerCase();

  const activeStatuses: TokenStatus[] = ['Waiting', 'Called', 'Consulting'];

  return queue.find((item) => {
    // Check status
    if (!activeStatuses.includes(item.status)) {
      return false;
    }

    // Check department
    if (item.department.trim().toLowerCase() !== targetDept) {
      return false;
    }

    // Check date
    const itemDateKey = getStandardDateKey(item.date);
    if (itemDateKey !== targetDateKey && item.date !== dateStr) {
      return false;
    }

    // Check patient matching by ID or Phone
    if (patientIdentifier.patientId && item.patientId) {
      if (item.patientId.toLowerCase() === patientIdentifier.patientId.toLowerCase()) {
        return true;
      }
    }

    if (patientIdentifier.phone && item.phone) {
      const cleanPhone1 = patientIdentifier.phone.replace(/\D/g, '');
      const cleanPhone2 = item.phone.replace(/\D/g, '');
      if (
        cleanPhone1 &&
        cleanPhone2 &&
        (cleanPhone1 === cleanPhone2 ||
          (cleanPhone1.length >= 10 && cleanPhone2.endsWith(cleanPhone1.slice(-10))))
      ) {
        return true;
      }
    }

    if (
      patientIdentifier.patientName &&
      item.patientName &&
      patientIdentifier.patientName.trim().toLowerCase() === item.patientName.trim().toLowerCase()
    ) {
      return true;
    }

    return false;
  });
}

/**
 * Calculate the position of a token in the queue and estimated wait time.
 */
export function calculateQueuePosition(
  tokenNumber: string,
  departmentName: string,
  queue: PatientRecord[] = []
): {
  position: number;
  totalWaitingInDept: number;
  estimatedWaitMinutes: number;
} {
  const targetDept = departmentName.trim().toLowerCase();

  // Filter queue for waiting/called patients in this department
  const deptQueue = queue.filter(
    (item) =>
      item.department.trim().toLowerCase() === targetDept &&
      (item.status === 'Waiting' || item.status === 'Called')
  );

  const totalWaitingInDept = deptQueue.length;

  const targetIndex = deptQueue.findIndex((item) => item.tokenNumber === tokenNumber);

  if (targetIndex === -1) {
    // If not found in queue yet (e.g. preview mode), position is total + 1
    const nextPos = totalWaitingInDept + 1;
    return {
      position: nextPos,
      totalWaitingInDept,
      estimatedWaitMinutes: Math.max(5, (nextPos - 1) * 12),
    };
  }

  const position = targetIndex + 1;
  const estimatedWaitMinutes = Math.max(0, (position - 1) * 12);

  return {
    position,
    totalWaitingInDept,
    estimatedWaitMinutes,
  };
}

/**
 * Generate a complete, fully populated OPVisit / PatientRecord object.
 */
export function createOpVisit(params: {
  patientId: string;
  patientName: string;
  age: number;
  gender: PatientRecord['gender'];
  phone: string;
  department: string;
  doctorId: string;
  doctorName: string;
  doctorRoom: string;
  serviceRequest: string;
  priority?: PatientRecord['priority'];
  dateStr?: string;
  existingQueue?: PatientRecord[];
  departmentsList?: Department[];
  aiRecommendation?: PatientRecord['aiRecommendation'];
  aiRoutingAudit?: PatientRecord['aiRoutingAudit'];
  visitSource?: 'RECEPTIONIST' | 'SELF_SERVICE';
}): {
  record: PatientRecord;
  duplicateWarning?: PatientRecord;
} {
  const dateDisplay = params.dateStr || getFormattedDisplayDate();
  const queue = params.existingQueue || [];
  const departments = params.departmentsList || MOCK_DEPARTMENTS;

  // 1. Check duplicate active visit
  const existingActive = checkActiveDuplicateVisit(
    {
      patientId: params.patientId,
      phone: params.phone,
      patientName: params.patientName,
    },
    params.department,
    dateDisplay,
    queue
  );

  // 2. Generate token number using sequence engine
  const { tokenNumber, prefix } = generateNextTokenNumber(
    params.department,
    dateDisplay,
    queue,
    departments
  );

  // 3. Generate OP number
  const opNumber = generateOpNumber(dateDisplay, queue);

  // 4. Calculate initial queue position
  const { position } = calculateQueuePosition(tokenNumber, params.department, queue);

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const departmentObj = departments.find(
    (d) => d.name.toLowerCase() === params.department.toLowerCase()
  );

  const record: PatientRecord = {
    id: `op-record-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    patientId: params.patientId,
    opNumber,
    tokenNumber,
    patientName: params.patientName,
    age: params.age,
    gender: params.gender,
    phone: params.phone,
    department: params.department,
    departmentId: departmentObj?.id,
    departmentPrefix: prefix,
    doctorName: params.doctorName,
    doctorId: params.doctorId,
    doctorRoom: params.doctorRoom,
    status: 'Waiting',
    registeredTime: timeFormatted,
    date: dateDisplay,
    serviceRequest: params.serviceRequest,
    patientRequest: params.serviceRequest,
    visitSource: params.visitSource || 'RECEPTIONIST',
    aiRecommendation: params.aiRecommendation,
    aiRoutingAudit: params.aiRoutingAudit,
    priority: params.priority || 'Normal',
    createdAtTimestamp: now.getTime(),
    queuePosition: position,
  };

  return {
    record,
    duplicateWarning: existingActive,
  };
}
