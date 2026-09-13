import React from 'react';
import { PatientFormState, Doctor, PatientRecord } from '../../types';
import { 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  Building2, 
  Stethoscope, 
  Ticket, 
  ArrowLeft, 
  ShieldCheck,
  AlertTriangle,
  Users,
  Sparkles
} from 'lucide-react';

interface Step4ConfirmOpProps {
  patientInfo: PatientFormState;
  doctor: Doctor;
  department: string;
  tokenNumber: string;
  opNumber: string;
  appointmentDate: string;
  appointmentTime: string;
  serviceRequestText: string;
  queuePositionInfo?: {
    position: number;
    totalWaitingInDept: number;
    estimatedWaitMinutes: number;
  };
  activeDuplicateVisit?: PatientRecord;
  aiRoutingAudit?: any;
  onGenerate: () => void;
  onBack: () => void;
}

export const Step4ConfirmOp: React.FC<Step4ConfirmOpProps> = ({
  patientInfo,
  doctor,
  department,
  tokenNumber,
  opNumber,
  appointmentDate,
  appointmentTime,
  serviceRequestText,
  queuePositionInfo,
  activeDuplicateVisit,
  aiRoutingAudit,
  onGenerate,
  onBack,
}) => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Active Visit Warning Banner if patient already has a token today in this dept */}
      {activeDuplicateVisit && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-sm text-amber-900 space-y-2">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-200 text-amber-800 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-amber-950 uppercase tracking-wide">
                  Active OP Visit Already Exists Today
                </h4>
                <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 rounded-full font-mono font-bold text-xs">
                  {activeDuplicateVisit.tokenNumber}
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Patient <strong className="font-bold text-amber-950">{patientInfo.name}</strong> already has an active visit token{' '}
                <span className="font-mono font-bold">{activeDuplicateVisit.tokenNumber}</span> for <strong className="font-bold text-amber-950">{department}</strong> today.
              </p>
              <div className="pt-1 flex items-center gap-4 text-xs font-semibold text-amber-900">
                <span>Status: <span className="uppercase font-bold text-amber-950">{activeDuplicateVisit.status}</span></span>
                <span>•</span>
                <span>Doctor: {activeDuplicateVisit.doctorName}</span>
                <span>•</span>
                <span>Time: {activeDuplicateVisit.registeredTime}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Confirmation Container */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-md">
        {/* Title */}
        <div className="pb-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verification & Sequence Check</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Confirm OP Ticket</h2>
            <p className="text-sm text-slate-500 mt-1">Verify details before issuing the patient OP ticket</p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">Next Sequential Token</span>
            <span className="text-2xl font-black font-mono text-blue-700 bg-blue-50 px-3.5 py-1.5 rounded-xl border border-blue-200 inline-block shadow-2xs mt-1">
              {tokenNumber}
            </span>
          </div>
        </div>

        {/* Structured Summary Card */}
        <div className="mt-6 space-y-6">
          {/* Queue Position Preview Banner */}
          {queuePositionInfo && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between border border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Estimated Queue Position</span>
                  <p className="text-sm font-extrabold text-white">
                    Position #{queuePositionInfo.position} in {department} Queue
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 font-bold uppercase block">Est. Wait</span>
                <span className="text-sm font-extrabold text-emerald-400 font-mono">
                  ~{queuePositionInfo.estimatedWaitMinutes} mins
                </span>
              </div>
            </div>
          )}

          {/* Patient Details Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" /> Patient Information
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">
                {patientInfo.patientId || 'NEW PATIENT'} • OP: {opNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div>
                <p className="text-xs text-slate-400 font-medium">Patient Name</p>
                <p className="font-extrabold text-slate-900 text-base">{patientInfo.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Age & Gender</p>
                <p className="font-bold text-slate-900 text-sm">{patientInfo.age} Yrs • {patientInfo.gender}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Phone</p>
                <p className="font-bold text-slate-900 text-sm">{patientInfo.phone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Category</p>
                <p className="font-bold text-slate-900 text-sm">{patientInfo.priority}</p>
              </div>
            </div>
          </div>

          {/* Department & Doctor Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-blue-600" /> Consultation Assignment
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono">
                {doctor.room}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <p className="text-xs text-slate-400 font-medium">Department</p>
                <p className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  {department}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Attending Doctor</p>
                <p className="font-extrabold text-blue-800 text-base">
                  {doctor.name} <span className="text-xs text-slate-500 font-normal">({doctor.specialty})</span>
                </p>
              </div>
            </div>
          </div>

          {/* Date & Time Schedule Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-semibold uppercase">Consultation Date</p>
                <p className="font-bold text-slate-900 text-sm">{appointmentDate}</p>
              </div>
            </div>

            <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-semibold uppercase">Estimated OP Time</p>
                <p className="font-bold text-slate-900 text-sm">{appointmentTime}</p>
              </div>
            </div>
          </div>

          {/* Service Complaint Note */}
          <div className="bg-slate-100/70 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Registered Complaint / Note
            </p>
            <p className="text-sm text-slate-800 italic">
              "{serviceRequestText || 'General medical consultation'}"
            </p>
          </div>

          {/* AI Routing Audit Information */}
          {aiRoutingAudit && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Routing Audit
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {aiRoutingAudit.recommendationAccepted ? (
                  <>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Selected Service</p>
                      <p className="font-bold text-slate-800">{department}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Selected Doctor</p>
                      <p className="font-bold text-slate-800">{doctor.name}</p>
                    </div>
                    <div className="col-span-2 bg-emerald-50 rounded-lg p-2 border border-emerald-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-emerald-600 font-medium">AI Recommendation</p>
                        <p className="font-bold text-emerald-800">{aiRoutingAudit.aiSuggestedDepartmentName} → {aiRoutingAudit.aiSuggestedDoctorIds?.includes(doctor.id) ? doctor.name : 'Any appropriate doctor'}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 bg-emerald-200 text-emerald-800 rounded-md">Recommendation Accepted</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">AI Suggested</p>
                      <p className="font-bold text-slate-800 line-through opacity-70">{aiRoutingAudit.aiSuggestedDepartmentName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Receptionist Selected</p>
                      <p className="font-bold text-blue-700">{department}</p>
                    </div>
                    <div className="col-span-2 bg-amber-50 rounded-lg p-2 border border-amber-100 flex items-center justify-between">
                      <span className="text-xs text-amber-700 font-medium">Manual Override Applied</span>
                      <span className="text-[10px] font-bold px-2 py-1 bg-amber-200 text-amber-800 rounded-md">Recommendation Rejected</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between gap-4">
          <button
            type="button"
            id="step4-back-btn"
            onClick={onBack}
            className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            type="button"
            id="generate-op-ticket-btn"
            onClick={onGenerate}
            className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-base shadow-lg shadow-emerald-600/30 flex items-center gap-3 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Ticket className="w-5 h-5" />
            <span>
              {activeDuplicateVisit ? 'Generate Secondary Token' : 'Generate OP Ticket'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
