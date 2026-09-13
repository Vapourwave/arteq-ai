import React from 'react';
import { PatientFormState } from '../../types';
import { UserCheck, Phone, Tag, Calendar } from 'lucide-react';

interface PatientContextCardProps {
  patientInfo: PatientFormState;
  onChangePatient?: () => void;
}

export const PatientContextCard: React.FC<PatientContextCardProps> = ({
  patientInfo,
  onChangePatient,
}) => {
  return (
    <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-4 shadow-md border border-blue-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-blue-600/80 border border-blue-400/40 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-inner">
          {patientInfo.name ? patientInfo.name.charAt(0).toUpperCase() : 'P'}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-blue-200 font-bold uppercase tracking-wider flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-blue-300" /> Active Patient Workflow
            </span>
            {patientInfo.patientId && (
              <span className="text-xs bg-blue-500/30 text-blue-200 font-mono font-bold px-2 py-0.5 rounded border border-blue-400/30">
                {patientInfo.patientId}
              </span>
            )}
            {patientInfo.priority && patientInfo.priority !== 'Normal' && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                patientInfo.priority === 'Emergency'
                  ? 'bg-rose-500/80 text-white'
                  : 'bg-amber-500/80 text-white'
              }`}>
                {patientInfo.priority}
              </span>
            )}
          </div>

          <h3 className="font-extrabold text-base text-white truncate mt-0.5">
            {patientInfo.name || 'Unnamed Patient'}
          </h3>

          <p className="text-xs text-blue-200 flex items-center gap-2 mt-0.5 flex-wrap">
            <span>{patientInfo.age} Yrs</span>
            <span>•</span>
            <span>{patientInfo.gender}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-blue-300" />
              {patientInfo.phone || 'No phone'}
            </span>
            {patientInfo.address && (
              <>
                <span>•</span>
                <span className="truncate max-w-[200px]" title={patientInfo.address}>
                  📍 {patientInfo.address}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {onChangePatient && (
        <button
          type="button"
          id="change-active-patient-btn"
          onClick={onChangePatient}
          className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-blue-800/80 hover:bg-blue-700 text-blue-100 border border-blue-600 text-xs font-semibold transition-colors shrink-0"
        >
          Change Patient
        </button>
      )}
    </div>
  );
};
