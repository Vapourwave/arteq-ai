import { PatientRecord, TokenStatus } from '../types';

/**
 * Validates token status transitions according to Step 5 rules:
 * WAITING -> CALLED -> CONSULTING -> COMPLETED
 * WAITING -> CANCELLED
 * CALLED -> NO SHOW
 */
export function validateStatusTransition(
  currentStatus: TokenStatus,
  targetStatus: TokenStatus
): { allowed: boolean; reason?: string } {
  if (currentStatus === targetStatus) {
    return { allowed: true };
  }

  // COMPLETED tokens cannot be modified
  if (currentStatus === 'Completed') {
    return {
      allowed: false,
      reason: 'Completed visits are final and cannot be reopened.',
    };
  }

  // CANCELLED tokens cannot be modified
  if (currentStatus === 'Cancelled') {
    return {
      allowed: false,
      reason: 'Cancelled tokens cannot be modified.',
    };
  }

  // NO SHOW tokens cannot be modified directly into consulting
  if (currentStatus === 'No Show' && targetStatus === 'Consulting') {
    return {
      allowed: false,
      reason: 'No Show tokens cannot transition directly into consultation.',
    };
  }

  // Transitions from WAITING
  if (currentStatus === 'Waiting') {
    if (targetStatus === 'Called' || targetStatus === 'Cancelled' || targetStatus === 'Consulting') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Cannot transition from Waiting directly to ${targetStatus}.`,
    };
  }

  // Transitions from CALLED
  if (currentStatus === 'Called') {
    if (targetStatus === 'Consulting' || targetStatus === 'No Show' || targetStatus === 'Completed') {
      return { allowed: true };
    }
    if (targetStatus === 'Waiting') {
      return {
        allowed: false,
        reason: 'Cannot transition a Called patient back to Waiting status.',
      };
    }
    return {
      allowed: false,
      reason: `Cannot transition from Called to ${targetStatus}.`,
    };
  }

  // Transitions from CONSULTING
  if (currentStatus === 'Consulting') {
    if (targetStatus === 'Completed') {
      return { allowed: true };
    }
    if (targetStatus === 'Waiting') {
      return {
        allowed: false,
        reason: 'Cannot transition a patient in consultation back to Waiting.',
      };
    }
    return {
      allowed: false,
      reason: `Cannot transition from Consulting to ${targetStatus}.`,
    };
  }

  return { allowed: true };
}

/**
 * Helper to get current formatted time string e.g. "10:42 AM"
 */
export function getCurrentTimeFormatted(): string {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Calculates readable waiting time text for patient records
 */
export function getWaitingDurationText(patient: PatientRecord): string {
  if (patient.status === 'Completed') {
    return patient.completedAt ? `Completed at ${patient.completedAt}` : 'Finished';
  }

  if (patient.status === 'No Show') {
    return patient.noShowAt ? `No show at ${patient.noShowAt}` : 'Did not arrive';
  }

  if (patient.status === 'Cancelled') {
    return 'Cancelled';
  }

  if (patient.status === 'Consulting') {
    if (patient.consultationStartedAt) {
      return `Started ${patient.consultationStartedAt}`;
    }
    return 'Consulting for ~8 min';
  }

  if (patient.status === 'Called') {
    if (patient.calledAt) {
      return `Called at ${patient.calledAt}`;
    }
    return 'Called 2 min ago';
  }

  // Default Waiting status calculation
  if (patient.registeredTime) {
    return `Waiting (~12 min)`;
  }

  return 'Waiting';
}

/**
 * Sort queue for doctor by status priority and creation order
 */
export function sortDoctorQueue(queue: PatientRecord[]): PatientRecord[] {
  const statusOrder: Record<TokenStatus, number> = {
    'Consulting': 1,
    'Called': 2,
    'Waiting': 3,
    'Completed': 4,
    'No Show': 5,
    'Cancelled': 6,
  };

  return [...queue].sort((a, b) => {
    const orderA = statusOrder[a.status] || 99;
    const orderB = statusOrder[b.status] || 99;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Secondary priority check for emergency
    if (a.status === 'Waiting' && b.status === 'Waiting') {
      if (a.priority === 'Emergency' && b.priority !== 'Emergency') return -1;
      if (b.priority === 'Emergency' && a.priority !== 'Emergency') return 1;
    }

    // Default to token creation / registered time order
    return a.tokenNumber.localeCompare(b.tokenNumber);
  });
}
