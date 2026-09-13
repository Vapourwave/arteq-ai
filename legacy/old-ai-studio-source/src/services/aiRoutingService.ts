import { AIRoutingRecommendation, Department, Doctor } from '../types';
import { MOCK_DEPARTMENTS, MOCK_DOCTORS } from '../data/mockData';

/**
 * Perform AI Routing analysis via backend endpoint /api/route-patient
 * with local fallback for offline / network error resilience.
 */
export async function analyzeServiceRequest(
  approvedRequest: string,
  departments: Department[] = MOCK_DEPARTMENTS,
  doctors: Doctor[] = MOCK_DOCTORS
): Promise<{
  recommendation: AIRoutingRecommendation;
  isFallback: boolean;
  error?: string;
}> {
  const cleanRequest = approvedRequest.trim();

  // Handle empty or extremely short inputs
  if (!cleanRequest || cleanRequest.length < 2) {
    return {
      recommendation: {
        understoodRequest: cleanRequest || 'No details provided.',
        recommendedDepartmentId: '',
        recommendedDepartmentName: 'General Medicine',
        confidence: 0.1,
        confidenceLabel: 'Low',
        reason: 'The request is too brief to identify a specific medical service.',
        recommendedDoctorIds: [],
        needsClarification: true,
        clarificationQuestion: 'Could you tell us what problem or service you need help with?',
      },
      isFallback: false,
    };
  }

  // 1. Try calling the backend API /api/route-patient with a 12-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch('/api/route-patient', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        approvedRequest: cleanRequest,
        patientRequest: cleanRequest,
        departments: departments.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          code: d.code,
        })),
        doctors: doctors.map((doc) => ({
          id: doc.id,
          name: doc.name,
          department: doc.department,
          specialty: doc.specialty,
          room: doc.room,
          status: doc.status,
        })),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        const data: AIRoutingRecommendation = result.data;
        return {
          recommendation: data,
          isFallback: false,
        };
      }
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('Backend AI routing service call failed or timed out. Utilizing local routing engine fallback.', err);
  }

  // 2. Local Fallback Rule-Based Engine (Guarantees system remains 100% operational)
  return {
    recommendation: getLocalRuleBasedRecommendation(cleanRequest, departments, doctors),
    isFallback: true,
    error: 'AI service temporarily unavailable. Generated using rule-based hospital fallback.',
  };
}

/**
 * Local Rule-Based Matching Algorithm for Fallback
 */
export function getLocalRuleBasedRecommendation(
  request: string,
  departments: Department[] = MOCK_DEPARTMENTS,
  doctors: Doctor[] = MOCK_DOCTORS
): AIRoutingRecommendation {
  const reqLower = request.toLowerCase();

  let targetDeptName = '';
  let confidenceLabel: 'High' | 'Moderate' | 'Low' = 'Moderate';
  let confidenceScore = 0.8;
  let reason = '';
  let needsClarification = false;
  let clarificationQuestion: string | null = null;

  if (
    reqLower.includes('tooth') ||
    reqLower.includes('teeth') ||
    reqLower.includes('dental') ||
    reqLower.includes('molar') ||
    reqLower.includes('dentist') ||
    reqLower.includes('dentistine') ||
    reqLower.includes('pallu') ||
    reqLower.includes('pakkamballu') ||
    reqLower.includes('palluvedhana') ||
    reqLower.includes('പല്ലുവേദനയാണ്') ||
    reqLower.includes(' root canal') ||
    reqLower.includes('extraction') ||
    reqLower.includes('gum')
  ) {
    targetDeptName = 'Dentistry';
    confidenceLabel = 'High';
    confidenceScore = 0.95;
    reason = 'The request explicitly concerns dental health and tooth discomfort.';
  } else if (
    reqLower.includes('heart') ||
    reqLower.includes('chest') ||
    reqLower.includes('cardio') ||
    reqLower.includes('blood pressure') ||
    reqLower.includes('palpitation') ||
    reqLower.includes('hypertension')
  ) {
    targetDeptName = 'Cardiology';
    confidenceLabel = 'High';
    confidenceScore = 0.92;
    reason = 'The request relates to cardiovascular symptoms and heart consultation.';
  } else if (
    reqLower.includes('child') ||
    reqLower.includes('baby') ||
    reqLower.includes('pediatric') ||
    reqLower.includes('vaccin') ||
    reqLower.includes('growth') ||
    reqLower.includes('toddler') ||
    reqLower.includes('kid')
  ) {
    targetDeptName = 'Pediatrics';
    confidenceLabel = 'High';
    confidenceScore = 0.9;
    reason = 'The request pertains to child healthcare, vaccination, or growth monitoring.';
  } else if (
    reqLower.includes('bone') ||
    reqLower.includes('knee') ||
    reqLower.includes('fracture') ||
    reqLower.includes('joint') ||
    reqLower.includes('sprain') ||
    reqLower.includes('spine') ||
    reqLower.includes('ortho')
  ) {
    targetDeptName = 'Orthopedics';
    confidenceLabel = 'High';
    confidenceScore = 0.91;
    reason = 'The request relates to musculoskeletal issues, bone fractures, or joint pain.';
  } else if (
    reqLower.includes('migraine') ||
    reqLower.includes('dizzy') ||
    reqLower.includes('dizziness') ||
    reqLower.includes('neuro') ||
    reqLower.includes('nerve') ||
    reqLower.includes('seizure') ||
    reqLower.includes('headache')
  ) {
    targetDeptName = 'Neurology';
    confidenceLabel = 'High';
    confidenceScore = 0.88;
    reason = 'The request indicates neurological evaluation for severe headache or nerve pain.';
  } else if (
    reqLower.includes('fever') ||
    reqLower.includes('cough') ||
    reqLower.includes('flu') ||
    reqLower.includes('cold') ||
    reqLower.includes('viral') ||
    reqLower.includes('throat') ||
    reqLower.includes('general') ||
    reqLower.includes('checkup')
  ) {
    targetDeptName = 'General Medicine';
    confidenceLabel = 'High';
    confidenceScore = 0.89;
    reason = 'The request matches general medical consultation for systemic illness or viral symptoms.';
  } else if (
    reqLower.includes('not feeling well') ||
    reqLower.includes("don't feel well") ||
    reqLower.includes("don't know") ||
    reqLower.includes('sick') ||
    reqLower.includes('unwell') ||
    reqLower.includes('help')
  ) {
    targetDeptName = 'General Medicine';
    confidenceLabel = 'Low';
    confidenceScore = 0.3;
    reason = 'The request is non-specific. General Medicine is suggested as default for general triage.';
    needsClarification = true;
    clarificationQuestion = 'Could you tell me what specific symptoms or concerns the patient is experiencing?';
  } else {
    // Unclassified -> General Medicine with low confidence
    targetDeptName = 'General Medicine';
    confidenceLabel = 'Low';
    confidenceScore = 0.4;
    reason = 'Unable to confidently match request to a specialized department. Recommending General Medicine for initial evaluation.';
    needsClarification = true;
    clarificationQuestion = 'Could you specify what kind of medical department or doctor you would like to consult?';
  }

  const deptObj =
    departments.find((d) => d.name.toLowerCase() === targetDeptName.toLowerCase()) ||
    departments[0];

  const matchingDocIds = doctors
    .filter((doc) => doc.department.toLowerCase() === deptObj.name.toLowerCase())
    .map((doc) => doc.id);

  return {
    understoodRequest: `Patient requesting consultation for: "${request}"`,
    recommendedDepartmentId: deptObj.id,
    recommendedDepartmentName: deptObj.name,
    confidence: confidenceScore,
    confidenceLabel,
    reason,
    recommendedDoctorIds: matchingDocIds,
    needsClarification,
    clarificationQuestion,
  };
}
