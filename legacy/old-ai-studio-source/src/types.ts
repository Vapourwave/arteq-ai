export type UserRole = 'receptionist' | 'doctor' | 'admin';

export type NavView = 
  | 'dashboard' 
  | 'new-patient' 
  | 'patients' 
  | 'tokens' 
  | 'settings'
  | 'profile'
  | 'my-queue'
  | 'schedule'
  | 'users'
  | 'doctors'
  | 'departments'
  | 'reports'
  | 'kiosk';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  staffId: string;
  department: string;
  doctorId?: string;
  avatarColor?: string;
  phone?: string;
  shiftHours?: string;
  lastLogin?: string;
}

export type PatientGender = 'Male' | 'Female' | 'Other' | 'Prefer not to say';

export type PatientStatus = 'Active' | 'In Visit' | 'Completed';

export interface Patient {
  id: string; // Auto-generated e.g. "PAT-000001"
  patientName: string;
  age: number;
  dob?: string;
  gender: PatientGender;
  phone: string;
  address?: string;
  registrationDate: string; // Formatted or ISO date e.g. "2026-08-12"
  status: PatientStatus;
  priority?: 'Normal' | 'Senior Citizen' | 'Emergency';
  visitCount?: number;
  lastVisitDate?: string;
}

export type TokenStatus = 'Waiting' | 'Called' | 'Consulting' | 'Completed' | 'Cancelled' | 'No Show';

export type WorkflowStep = 1 | 2 | 3 | 4 | 5;

export interface PatientFormState {
  patientId?: string; // Generated or selected patient ID
  name: string;
  age: string;
  dob?: string;
  useDob?: boolean;
  gender: PatientGender;
  phone: string;
  address?: string;
  priority: 'Normal' | 'Senior Citizen' | 'Emergency';
  notes?: string;
}

export interface ServiceRequestState {
  rawText: string;
  voiceSimulated: boolean;
  categoryTag?: string;
}

export interface Doctor {
  id: string;
  name: string;
  department: string;
  status: 'Available' | 'On Break' | 'In Consultation' | 'Off Duty';
  room: string;
  nextOpTime: string;
  experienceYears: number;
  specialty: string;
  avatarColor: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  prefix: string;
  iconName: string;
  description: string;
  doctorCount: number;
}

export interface AIRoutingRecommendation {
  understoodRequest: string;
  recommendedDepartmentId: string;
  recommendedDepartmentName: string;
  confidence: number;
  confidenceLabel: 'High' | 'Moderate' | 'Low';
  reason: string;
  recommendedDoctorIds: string[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
  isInvalidDepartment?: boolean;
}

export interface AIRoutingAudit {
  patientRequest: string;
  aiSuggestedDepartmentId?: string;
  aiSuggestedDepartmentName?: string;
  aiSuggestedDoctorIds?: string[];
  aiRoutingConfidence?: 'High' | 'Moderate' | 'Low';
  aiConfidenceValue?: number;
  aiReason?: string;
  selectedDepartmentId?: string;
  selectedDepartmentName: string;
  selectedDoctorId: string;
  selectedDoctorName: string;
  recommendationAccepted: boolean;
  recommendationTimestamp: string;
}

export interface PatientRecord {
  id: string;
  opNumber: string;
  tokenNumber: string;
  patientName: string;
  age: number;
  gender: PatientGender;
  phone: string;
  department: string;
  departmentId?: string;
  departmentPrefix?: string;
  doctorName: string;
  doctorId: string;
  doctorRoom: string;
  status: TokenStatus;
  registeredTime: string;
  date: string;
  serviceRequest: string;
  priority: 'Normal' | 'Senior Citizen' | 'Emergency';
  calledAt?: string;
  consultationStartedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  noShowAt?: string;
  createdAtTimestamp?: number;
  queuePosition?: number;
  patientId?: string;
  patientRequest?: string;
  visitSource?: 'RECEPTIONIST' | 'SELF_SERVICE';
  aiRecommendation?: AIRoutingRecommendation;
  aiRoutingAudit?: AIRoutingAudit;
}

export type OPVisit = PatientRecord;

export interface HospitalInfo {
  name: string;
  tagline: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  printerName: string;
  autoPrintOnGenerate: boolean;
  receptionDesk: string;
  receptionistName: string;
}
