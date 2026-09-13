import React, { useState } from 'react';
import { PatientRecord, TokenStatus } from '../../types';
import { getWaitingDurationText, sortDoctorQueue } from '../../services/queueService';
import { PatientDetailsModal } from '../PatientDetailsModal';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  Stethoscope, 
  Search, 
  PhoneCall, 
  Play, 
  UserX, 
  AlertTriangle, 
  Building2, 
  Sparkles, 
  ArrowRight, 
  Calendar,
  X,
  Info
} from 'lucide-react';

interface DoctorDashboardViewProps {
  queue: PatientRecord[];
  doctorName: string;
  department: string;
  room?: string;
  onUpdatePatientStatus: (patientId: string, newStatus: TokenStatus) => void;
  onViewFullQueue: () => void;
  onViewPatients: () => void;
}

export const DoctorDashboardView: React.FC<DoctorDashboardViewProps> = ({
  queue,
  doctorName,
  department,
  room = 'Room 3',
  onUpdatePatientStatus,
  onViewFullQueue,
  onViewPatients,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Waiting' | 'Called' | 'Consulting' | 'Completed' | 'No Show'>('All');
  
  // Selected patient for details modal
  const [selectedPatientForDetails, setSelectedPatientForDetails] = useState<PatientRecord | null>(null);

  // Modals state
  const [patientToComplete, setPatientToComplete] = useState<PatientRecord | null>(null);
  const [patientToNoShow, setPatientToNoShow] = useState<PatientRecord | null>(null);
  const [showConsultationInProgressModal, setShowConsultationInProgressModal] = useState<boolean>(false);

  // Filter queue for logged-in doctor
  const doctorQueue = queue.filter(
    (p) => p.doctorName === doctorName || p.department === department
  );

  const sortedQueue = sortDoctorQueue(doctorQueue);

  // Counts
  const waitingTokens = doctorQueue.filter((p) => p.status === 'Waiting');
  const calledTokens = doctorQueue.filter((p) => p.status === 'Called');
  const consultingTokens = doctorQueue.filter((p) => p.status === 'Consulting');
  const completedTokens = doctorQueue.filter((p) => p.status === 'Completed');
  const noShowTokens = doctorQueue.filter((p) => p.status === 'No Show');

  const waitingCount = waitingTokens.length;
  const calledCount = calledTokens.length;
  const consultingCount = consultingTokens.length;
  const completedCount = completedTokens.length;

  // Active items
  const activeConsultingPatient = consultingTokens[0] || null;
  const activeCalledPatient = calledTokens[0] || null;

  // Handler for Call Next Patient button
  const handleCallNextPatient = () => {
    // Protection: doctor cannot call another patient if already consulting
    if (activeConsultingPatient) {
      setShowConsultationInProgressModal(true);
      return;
    }

    // Find earliest eligible waiting token
    const nextWaiting = waitingTokens[0];
    if (nextWaiting) {
      onUpdatePatientStatus(nextWaiting.id, 'Called');
    } else {
      alert('No waiting patients in your queue.');
    }
  };

  const handleCallSpecificPatient = (patient: PatientRecord) => {
    if (activeConsultingPatient && activeConsultingPatient.id !== patient.id) {
      setShowConsultationInProgressModal(true);
      return;
    }
    onUpdatePatientStatus(patient.id, 'Called');
  };

  const handleStartConsultation = (patient: PatientRecord) => {
    onUpdatePatientStatus(patient.id, 'Consulting');
  };

  const handleConfirmCompleteVisit = () => {
    if (patientToComplete) {
      onUpdatePatientStatus(patientToComplete.id, 'Completed');
      setPatientToComplete(null);
    }
  };

  const handleConfirmNoShow = () => {
    if (patientToNoShow) {
      onUpdatePatientStatus(patientToNoShow.id, 'No Show');
      setPatientToNoShow(null);
    }
  };

  const filteredQueue = sortedQueue.filter((p) => {
    const matchesSearch =
      p.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tokenNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.opNumber.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'All') return matchesSearch;
    return matchesSearch && p.status === statusFilter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-teal-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
              Doctor Console
            </span>
            <span className="text-emerald-200 text-xs font-medium">• {department} Department</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Good morning, {doctorName}
          </h1>
          <div className="text-xs text-slate-300 flex items-center gap-3 pt-1 flex-wrap">
            <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 font-medium">
              <Building2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>{room}</span>
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 font-medium">
              <Calendar className="w-3.5 h-3.5 text-emerald-300" />
              <span>12 August 2026</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={onViewFullQueue}
            className="w-full md:w-auto px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <span>My Full Queue ({doctorQueue.length})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Waiting */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Waiting</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-200">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-amber-900 mt-2">{waitingCount}</p>
          <p className="text-xs text-amber-600 mt-1 font-medium">Patients waiting</p>
        </div>

        {/* Called */}
        <div className="bg-white rounded-2xl p-5 border border-indigo-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Called</span>
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-200">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-indigo-900 mt-2">{calledCount}</p>
          <p className="text-xs text-indigo-600 mt-1 font-medium">Summoned to room</p>
        </div>

        {/* Consulting */}
        <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Consulting</span>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600 border border-blue-200">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-blue-900 mt-2">{consultingCount}</p>
          <p className="text-xs text-blue-600 mt-1 font-medium">In consultation</p>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Completed</span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-900 mt-2">{completedCount}</p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">Visits finished today</p>
        </div>
      </div>

      {/* PROMINENT VISUAL ACTIVE PATIENT SECTION */}
      {activeConsultingPatient ? (
        /* Case 1: NOW CONSULTING (Visually Dominant) */
        <div className="bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-blue-500/40 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 text-center md:text-left w-full">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold border border-blue-400/30 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                NOW CONSULTING
              </div>

              <div>
                <span className="text-4xl sm:text-5xl font-black font-mono text-blue-300 block tracking-tight">
                  {activeConsultingPatient.tokenNumber}
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  {activeConsultingPatient.patientName}
                </h2>
                <p className="text-xs sm:text-sm text-blue-200 font-medium mt-1">
                  {activeConsultingPatient.age} yrs • {activeConsultingPatient.gender} • <span className="font-mono">OP: {activeConsultingPatient.opNumber}</span>
                </p>
              </div>

              <div className="flex items-center justify-center md:justify-start gap-4 text-xs text-slate-300 pt-1 flex-wrap">
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                  <Building2 className="w-4 h-4 text-blue-300" />
                  <span>{room}</span>
                </span>
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                  <Clock className="w-4 h-4 text-blue-300" />
                  <span>{getWaitingDurationText(activeConsultingPatient)}</span>
                </span>
              </div>
            </div>

            {/* Action Area */}
            <div className="flex flex-col items-center md:items-end justify-center gap-3 w-full md:w-auto shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-white/10">
              <button
                id="doc-complete-visit-btn"
                onClick={() => setPatientToComplete(activeConsultingPatient)}
                className="w-full sm:w-64 py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2.5 transition-all text-base border border-emerald-400/40"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Complete Visit</span>
              </button>
              <button
                onClick={() => setSelectedPatientForDetails(activeConsultingPatient)}
                className="text-xs text-blue-300 hover:text-white underline font-medium"
              >
                View Patient Details
              </button>
            </div>
          </div>
        </div>
      ) : activeCalledPatient ? (
        /* Case 2: NOW CALLING (Called State) */
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-indigo-500/40 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 text-center md:text-left w-full">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold border border-indigo-400/30 uppercase tracking-wider">
                <PhoneCall className="w-3.5 h-3.5 text-indigo-300 animate-bounce" />
                NOW CALLING
              </div>

              <div>
                <span className="text-4xl sm:text-5xl font-black font-mono text-indigo-300 block tracking-tight">
                  {activeCalledPatient.tokenNumber}
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  {activeCalledPatient.patientName}
                </h2>
                <p className="text-xs sm:text-sm text-indigo-200 font-medium mt-1">
                  Please proceed to: <strong className="text-white font-bold">{room}</strong>
                </p>
              </div>

              <div className="flex items-center justify-center md:justify-start gap-3 text-xs text-slate-300 pt-1">
                <span className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-300" />
                  <span>{getWaitingDurationText(activeCalledPatient)}</span>
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row md:flex-col items-center justify-center gap-3 w-full md:w-auto shrink-0">
              <button
                id="doc-start-consultation-btn"
                onClick={() => handleStartConsultation(activeCalledPatient)}
                className="w-full sm:w-56 py-3.5 px-5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2 transition-all text-sm border border-blue-400/40"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Consultation</span>
              </button>

              <button
                id="doc-no-show-btn"
                onClick={() => setPatientToNoShow(activeCalledPatient)}
                className="w-full sm:w-56 py-3 px-5 bg-white/10 hover:bg-rose-500/20 text-rose-200 font-semibold rounded-2xl border border-white/20 hover:border-rose-400/50 flex items-center justify-center gap-2 transition-all text-xs"
              >
                <UserX className="w-4 h-4" />
                <span>Patient Did Not Arrive</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Case 3: READY FOR NEXT PATIENT */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
              READY FOR NEXT
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900">
              {waitingCount > 0 ? `${waitingCount} patients waiting in lobby` : 'No patients currently waiting'}
            </h2>
            <p className="text-xs text-slate-500">
              Click below to summon the earliest waiting token to {room}.
            </p>
          </div>

          <button
            id="doc-call-next-btn"
            onClick={handleCallNextPatient}
            disabled={waitingCount === 0}
            className={`px-8 py-4 rounded-2xl font-black text-base shadow-lg transition-all flex items-center justify-center gap-3 shrink-0 ${
              waitingCount > 0
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 transform hover:-translate-y-0.5 active:translate-y-0'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            <Play className="w-5 h-5 fill-current" />
            <span>▶ Call Next Patient</span>
          </button>
        </div>
      )}

      {/* TODAY'S QUEUE SECTION */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              Today's Consultation Queue
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {doctorQueue.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Assigned OP tokens ordered by registration queue sequence
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            {/* Search */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search patient or token..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 overflow-x-auto shrink-0">
              {(['All', 'Waiting', 'Called', 'Consulting', 'Completed', 'No Show'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-2.5 py-1 rounded-lg transition-all text-xs ${
                    statusFilter === tab
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4">Token #</th>
                <th className="py-3.5 px-4">Patient Name</th>
                <th className="py-3.5 px-4">Queue Position</th>
                <th className="py-3.5 px-4">Waiting / Status Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No tokens match your search or filter selection.
                  </td>
                </tr>
              ) : (
                filteredQueue.map((patient, index) => {
                  const isWaiting = patient.status === 'Waiting';
                  const isCalled = patient.status === 'Called';
                  const isConsulting = patient.status === 'Consulting';
                  const isCompleted = patient.status === 'Completed';
                  const isNoShow = patient.status === 'No Show';

                  // Calculate position among waiting
                  const waitingIndex = waitingTokens.findIndex((w) => w.id === patient.id);
                  const queuePosText = isWaiting
                    ? waitingIndex === 0
                      ? 'Next in line (#1)'
                      : `Position #${waitingIndex + 1} (${waitingIndex} ahead)`
                    : '—';

                  return (
                    <tr 
                      key={patient.id} 
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isConsulting ? 'bg-blue-50/40' : isCalled ? 'bg-indigo-50/30' : ''
                      }`}
                      onClick={() => setSelectedPatientForDetails(patient)}
                    >
                      {/* Token */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <span className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-xs ${
                          isConsulting ? 'bg-blue-100 text-blue-900 border-blue-300' :
                          isCalled ? 'bg-indigo-100 text-indigo-900 border-indigo-300' :
                          isWaiting ? 'bg-amber-50 text-amber-900 border-amber-300' :
                          isCompleted ? 'bg-emerald-50 text-emerald-900 border-emerald-300' :
                          'bg-slate-100 text-slate-700 border-slate-300'
                        }`}>
                          {patient.tokenNumber}
                        </span>
                      </td>

                      {/* Patient Name */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-900">{patient.patientName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {patient.age} yrs • {patient.gender} • OP: {patient.opNumber}
                          </p>
                        </div>
                      </td>

                      {/* Queue Position */}
                      <td className="py-3.5 px-4 font-semibold text-slate-600">
                        {queuePosText}
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {getWaitingDurationText(patient)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            isWaiting
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : isCalled
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : isConsulting
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : isCompleted
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isWaiting
                                ? 'bg-amber-500'
                                : isCalled
                                ? 'bg-indigo-500 animate-pulse'
                                : isConsulting
                                ? 'bg-blue-500 animate-ping'
                                : isCompleted
                                ? 'bg-emerald-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          {patient.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isWaiting && (
                            <button
                              onClick={() => handleCallSpecificPatient(patient)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-colors flex items-center gap-1"
                            >
                              <PhoneCall className="w-3.5 h-3.5" /> Call
                            </button>
                          )}

                          {isCalled && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartConsultation(patient)}
                                className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-colors"
                              >
                                Start Consultation
                              </button>
                              <button
                                onClick={() => setPatientToNoShow(patient)}
                                className="px-2 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold"
                                title="Patient Did Not Arrive"
                              >
                                No Show
                              </button>
                            </div>
                          )}

                          {isConsulting && (
                            <button
                              onClick={() => setPatientToComplete(patient)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors"
                            >
                              Complete Visit
                            </button>
                          )}

                          {isCompleted && (
                            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Done
                            </span>
                          )}

                          {isNoShow && (
                            <span className="text-xs text-slate-400 font-medium">
                              No Show
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRMATION DIALOG: COMPLETE VISIT */}
      {patientToComplete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Complete this visit?</h3>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Patient:</span>
                <strong className="text-slate-900 font-bold">{patientToComplete.patientName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Token Number:</span>
                <strong className="text-blue-700 font-mono font-extrabold">{patientToComplete.tokenNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Department:</span>
                <span className="text-slate-800 font-semibold">{patientToComplete.department}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Marking this consultation as finished will update the patient status to Completed and return you to the queue.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPatientToComplete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                id="doc-modal-confirm-complete-btn"
                onClick={handleConfirmCompleteVisit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                Complete Visit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: NO SHOW */}
      {patientToNoShow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-200">
                <UserX className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Mark {patientToNoShow.tokenNumber} as No Show?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Patient <strong className="text-slate-900 font-bold">{patientToNoShow.patientName}</strong> did not arrive when summoned to {room}.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-1">
              <p>• The token number <strong className="text-slate-700">{patientToNoShow.tokenNumber}</strong> will NOT be deleted or reused.</p>
              <p>• The visit will remain in today's historical log with status <strong>No Show</strong>.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPatientToNoShow(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                id="doc-modal-confirm-noshow-btn"
                onClick={handleConfirmNoShow}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
              >
                Mark No Show
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONSULTATION IN PROGRESS QUEUE PROTECTION MODAL */}
      {showConsultationInProgressModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Consultation in Progress</h3>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              You must complete the current consultation with{' '}
              <strong className="text-slate-900 font-bold">
                {activeConsultingPatient?.patientName} ({activeConsultingPatient?.tokenNumber})
              </strong>{' '}
              before calling another patient.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConsultationInProgressModal(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                View Current Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PATIENT BASIC INFORMATION MODAL */}
      <PatientDetailsModal
        patient={selectedPatientForDetails}
        allVisits={queue}
        onClose={() => setSelectedPatientForDetails(null)}
      />
    </div>
  );
};
