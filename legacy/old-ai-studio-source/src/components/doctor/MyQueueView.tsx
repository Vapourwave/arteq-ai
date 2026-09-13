import React, { useState } from 'react';
import { PatientRecord, TokenStatus } from '../../types';
import { getWaitingDurationText, sortDoctorQueue } from '../../services/queueService';
import { PatientDetailsModal } from '../PatientDetailsModal';
import { Search, Clock, CheckCircle2, PhoneCall, Play, UserX, AlertTriangle, Stethoscope, User } from 'lucide-react';

interface MyQueueViewProps {
  queue: PatientRecord[];
  doctorName: string;
  department: string;
  onUpdatePatientStatus: (patientId: string, newStatus: TokenStatus) => void;
}

export const MyQueueView: React.FC<MyQueueViewProps> = ({
  queue,
  doctorName,
  department,
  onUpdatePatientStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'All' | 'Waiting' | 'Called' | 'Consulting' | 'Completed' | 'No Show'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected patient for details modal
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);

  // Modal confirmations
  const [patientToComplete, setPatientToComplete] = useState<PatientRecord | null>(null);
  const [patientToNoShow, setPatientToNoShow] = useState<PatientRecord | null>(null);
  const [showConsultationInProgressModal, setShowConsultationInProgressModal] = useState<boolean>(false);

  // Filter for doctor
  const myQueue = queue.filter(
    (p) => p.doctorName === doctorName || p.department === department
  );

  const sortedQueue = sortDoctorQueue(myQueue);

  // Currently consulting check
  const activeConsulting = myQueue.find((p) => p.status === 'Consulting');

  const filteredQueue = sortedQueue.filter((item) => {
    const matchesTab = activeTab === 'All' || item.status === activeTab;
    const matchesSearch =
      item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tokenNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.opNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleCallPatient = (patient: PatientRecord) => {
    if (activeConsulting && activeConsulting.id !== patient.id) {
      setShowConsultationInProgressModal(true);
      return;
    }
    onUpdatePatientStatus(patient.id, 'Called');
  };

  const handleStartConsultation = (patient: PatientRecord) => {
    onUpdatePatientStatus(patient.id, 'Consulting');
  };

  const handleConfirmComplete = () => {
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* View Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Doctor Consultation Queue</h1>
          <p className="text-xs text-slate-500">Live OP token queue for {doctorName} ({department})</p>
        </div>
      </div>

      {/* Tabs & Search Header */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 w-full md:w-auto overflow-x-auto">
          {(['All', 'Waiting', 'Called', 'Consulting', 'Completed', 'No Show'] as const).map((tab) => {
            const count = tab === 'All' ? myQueue.length : myQueue.filter((p) => p.status === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === tab
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                <span>{tab}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search token, name, or OP..."
            className="w-full pl-10 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Queue Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredQueue.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">No tokens found</p>
            <p className="text-xs text-slate-400 mt-0.5">There are no patients matching your current tab or search filters.</p>
          </div>
        ) : (
          filteredQueue.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedPatient(item)}
              className={`bg-white rounded-2xl border p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between space-y-4 cursor-pointer ${
                item.status === 'Consulting' ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/20' :
                item.status === 'Called' ? 'border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/20' :
                'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-mono font-bold text-sm border border-emerald-200">
                    {item.tokenNumber}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      item.status === 'Waiting' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                      item.status === 'Called' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                      item.status === 'Consulting' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                      item.status === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                      'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900">{item.patientName}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {item.age} yrs • {item.gender} • <span className="font-mono text-slate-700">OP: {item.opNumber}</span>
                </p>

                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                  <p className="text-slate-500 font-medium">Chief Complaint / Service:</p>
                  <p className="text-slate-800 font-semibold italic">"{item.serviceRequest || 'General Consultation'}"</p>
                </div>
              </div>

              {/* Status & Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-[11px] text-slate-500 font-medium">
                  {getWaitingDurationText(item)}
                </span>

                <div>
                  {item.status === 'Waiting' && (
                    <button
                      onClick={() => handleCallPatient(item)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1"
                    >
                      <PhoneCall className="w-3.5 h-3.5" /> Call Patient
                    </button>
                  )}

                  {item.status === 'Called' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartConsultation(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                      >
                        Start
                      </button>
                      <button
                        onClick={() => setPatientToNoShow(item)}
                        className="px-2 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold"
                      >
                        No Show
                      </button>
                    </div>
                  )}

                  {item.status === 'Consulting' && (
                    <button
                      onClick={() => setPatientToComplete(item)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                    >
                      Complete
                    </button>
                  )}

                  {item.status === 'Completed' && (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Finished
                    </span>
                  )}

                  {item.status === 'No Show' && (
                    <span className="text-xs text-slate-400 font-medium">
                      No Show
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CONFIRMATION DIALOG: COMPLETE */}
      {patientToComplete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Complete this visit?</h3>
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <p><span className="text-slate-500">Patient:</span> <strong>{patientToComplete.patientName}</strong></p>
              <p><span className="text-slate-500">Token:</span> <strong className="font-mono text-blue-700">{patientToComplete.tokenNumber}</strong></p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setPatientToComplete(null)} className="px-4 py-2 text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleConfirmComplete} className="px-5 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl shadow-xs">Complete Visit</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: NO SHOW */}
      {patientToNoShow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Mark {patientToNoShow.tokenNumber} as No Show?</h3>
            <p className="text-xs text-slate-600">The token number will NOT be deleted or reused and remains in history.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setPatientToNoShow(null)} className="px-4 py-2 text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleConfirmNoShow} className="px-5 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl shadow-xs">Mark No Show</button>
            </div>
          </div>
        </div>
      )}

      {/* CONSULTATION IN PROGRESS MODAL */}
      {showConsultationInProgressModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900">Consultation in Progress</h3>
            </div>
            <p className="text-xs text-slate-700">You must complete the current consultation before calling another patient.</p>
            <div className="flex justify-end">
              <button onClick={() => setShowConsultationInProgressModal(false)} className="px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl">View Current Patient</button>
            </div>
          </div>
        </div>
      )}

      {/* PATIENT DETAILS MODAL */}
      <PatientDetailsModal
        patient={selectedPatient}
        allVisits={queue}
        onClose={() => setSelectedPatient(null)}
      />
    </div>
  );
};
