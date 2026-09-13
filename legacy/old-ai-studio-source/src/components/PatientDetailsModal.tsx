import React from 'react';
import { PatientRecord } from '../types';
import { X, User, Phone, Calendar, Clock, Stethoscope, Building2, Ticket, CheckCircle2, AlertCircle } from 'lucide-react';

interface PatientDetailsModalProps {
  patient: PatientRecord | null;
  allVisits?: PatientRecord[];
  onClose: () => void;
  onPrintTicket?: (patient: PatientRecord) => void;
}

export const PatientDetailsModal: React.FC<PatientDetailsModalProps> = ({
  patient,
  allVisits = [],
  onClose,
  onPrintTicket,
}) => {
  if (!patient) return null;

  // Filter previous visits for this patient
  const patientPreviousVisits = allVisits.filter(
    (v) => (v.patientId && v.patientId === patient.patientId) || 
           (v.phone === patient.phone && v.id !== patient.id)
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20 font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white">{patient.patientName}</h3>
              <p className="text-xs text-slate-300 font-mono">
                ID: {patient.patientId || 'PAT-RECORD'} • OP: {patient.opNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Current Token Card */}
          <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Current Token</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-blue-900 font-mono">{patient.tokenNumber}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  patient.status === 'Waiting' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                  patient.status === 'Called' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                  patient.status === 'Consulting' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                  patient.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                  patient.status === 'No Show' ? 'bg-slate-200 text-slate-800 border-slate-300' :
                  'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  {patient.status}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-[11px] font-medium">Priority</p>
              <p className="font-bold text-slate-900">{patient.priority}</p>
            </div>
          </div>

          {/* Demographics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Age & Gender</span>
              <p className="font-bold text-slate-900 text-sm">{patient.age} yrs • {patient.gender}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Phone Number</span>
              <p className="font-bold text-slate-900 text-sm flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {patient.phone}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Department</span>
              <p className="font-bold text-slate-900 text-sm">{patient.department}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Assigned Doctor</span>
              <p className="font-bold text-slate-900 text-sm">{patient.doctorName} <span className="text-xs text-slate-500">({patient.doctorRoom})</span></p>
            </div>
          </div>

          {/* Service Request */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Service / Complaint Description</span>
            <p className="text-slate-800 font-medium italic">"{patient.serviceRequest || 'General Consultation'}"</p>
          </div>

          {/* Registration & Timing */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-2 text-slate-600">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Registered Time</span>
              <p className="font-semibold text-slate-800">{patient.registeredTime} ({patient.date})</p>
            </div>
            {patient.calledAt && (
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Called At</span>
                <p className="font-semibold text-slate-800">{patient.calledAt}</p>
              </div>
            )}
            {patient.consultationStartedAt && (
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Consultation Started</span>
                <p className="font-semibold text-slate-800">{patient.consultationStartedAt}</p>
              </div>
            )}
            {patient.completedAt && (
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Completed At</span>
                <p className="font-semibold text-emerald-700">{patient.completedAt}</p>
              </div>
            )}
            {patient.noShowAt && (
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Marked No Show</span>
                <p className="font-semibold text-slate-700">{patient.noShowAt}</p>
              </div>
            )}
          </div>

          {/* Previous Visits Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 text-xs flex items-center justify-between">
              <span>Previous Visits</span>
              <span className="text-[10px] text-slate-400 font-normal">Registered patient history</span>
            </h4>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {/* Current visit row */}
              <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-200/60 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-bold text-slate-900">{patient.date}</span>
                  <span className="font-mono text-blue-700 font-semibold">[{patient.tokenNumber}]</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold">
                  Current Visit
                </span>
              </div>

              {/* Historical visit rows */}
              {patientPreviousVisits.length === 0 ? (
                <div className="p-2.5 text-slate-400 text-center italic text-[11px]">
                  No earlier visits recorded for this patient.
                </div>
              ) : (
                patientPreviousVisits.map((visit) => (
                  <div key={visit.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700">{visit.date}</span>
                      <span className="font-mono text-slate-600">[{visit.tokenNumber}]</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold">
                      {visit.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          {onPrintTicket ? (
            <button
              type="button"
              id="modal-print-ticket-btn"
              onClick={() => onPrintTicket(patient)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Ticket className="w-4 h-4" />
              <span>Print OP Ticket</span>
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 text-xs shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
