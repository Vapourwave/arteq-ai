import React, { useState } from 'react';
import { PatientRecord, TokenStatus } from '../types';
import { PatientDetailsModal } from './PatientDetailsModal';
import { PrintTicketModal } from './PrintTicketModal';
import { INITIAL_HOSPITAL_INFO } from '../data/mockData';
import { getWaitingDurationText } from '../services/queueService';
import { Ticket, Clock, CheckCircle2, PhoneCall, Search, AlertCircle, XCircle, Printer } from 'lucide-react';

interface TokensViewProps {
  queue: PatientRecord[];
  onUpdateStatus: (patientId: string, newStatus: PatientRecord['status']) => void;
  onStartNewPatient: () => void;
}

export const TokensView: React.FC<TokensViewProps> = ({
  queue,
  onUpdateStatus,
  onStartNewPatient,
}) => {
  const [filter, setFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [printingTicket, setPrintingTicket] = useState<PatientRecord | null>(null);

  const filteredQueue = queue.filter((item) => {
    const matchesFilter = filter === 'All' ? true : item.status === filter;
    const matchesSearch =
      item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tokenNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.opNumber.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const waitingCount = queue.filter((q) => q.status === 'Waiting').length;
  const calledCount = queue.filter((q) => q.status === 'Called').length;
  const consultingCount = queue.filter((q) => q.status === 'Consulting').length;
  const completedCount = queue.filter((q) => q.status === 'Completed').length;
  const noShowCount = queue.filter((q) => q.status === 'No Show').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Title & Stats */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Ticket className="w-6 h-6 text-blue-600" />
            Today's OP & Tokens
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time OP token status, queue movements, and patient flow monitoring
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="tokens-new-patient-btn"
            onClick={onStartNewPatient}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-sm transition-colors"
          >
            + Issue New Token
          </button>
        </div>
      </div>

      {/* Filter Tabs Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'All', label: 'All Tokens', count: queue.length },
            { id: 'Waiting', label: 'Waiting', count: waitingCount },
            { id: 'Called', label: 'Called', count: calledCount },
            { id: 'Consulting', label: 'Consulting', count: consultingCount },
            { id: 'Completed', label: 'Completed', count: completedCount },
            { id: 'No Show', label: 'No Show', count: noShowCount },
          ].map((tab) => (
            <button
              key={tab.id}
              id={`tokens-filter-tab-${tab.id.toLowerCase()}`}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                filter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  filter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="tokens-search-input"
            type="text"
            placeholder="Search token, name, OP, doctor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="todays-op-tokens-table">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 font-bold">Token</th>
                <th className="py-3.5 px-4 font-bold">Patient Name</th>
                <th className="py-3.5 px-4 font-bold">Department</th>
                <th className="py-3.5 px-4 font-bold">Doctor & Room</th>
                <th className="py-3.5 px-4 font-bold">Waiting / Call Time</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No tokens found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedPatient(item)}
                  >
                    {/* Token */}
                    <td className="py-3.5 px-4 font-extrabold text-blue-700">
                      <span className="px-3 py-1 bg-blue-100/90 text-blue-900 rounded-lg border border-blue-200 font-mono text-xs shadow-2xs font-bold">
                        {item.tokenNumber}
                      </span>
                    </td>

                    {/* Patient */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{item.patientName}</p>
                      <p className="text-[11px] text-slate-500">
                        {item.age} yrs • {item.gender} • <span className="font-mono text-slate-700">OP: {item.opNumber}</span>
                      </p>
                    </td>

                    {/* Dept */}
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {item.department}
                    </td>

                    {/* Doctor */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{item.doctorName}</p>
                      <p className="text-[11px] text-slate-500">{item.doctorRoom}</p>
                    </td>

                    {/* Duration */}
                    <td className="py-3.5 px-4 text-slate-600">
                      {getWaitingDurationText(item)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          item.status === 'Waiting'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : item.status === 'Called'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : item.status === 'Consulting'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : item.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.status === 'Waiting'
                              ? 'bg-amber-500'
                              : item.status === 'Called'
                              ? 'bg-indigo-600 animate-pulse'
                              : item.status === 'Consulting'
                              ? 'bg-blue-600 animate-ping'
                              : item.status === 'Completed'
                              ? 'bg-emerald-500'
                              : 'bg-slate-400'
                          }`}
                        />
                        {item.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          id={`reprint-token-btn-${item.tokenNumber}`}
                          onClick={() => setPrintingTicket(item)}
                          className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg font-semibold transition-colors flex items-center gap-1"
                          title="Reprint OP Ticket"
                        >
                          <Printer className="w-3 h-3 text-slate-500" />
                          <span>Ticket</span>
                        </button>

                        {item.status === 'Waiting' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(item.id, 'Cancelled')}
                            className="px-2.5 py-1 text-[11px] bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg font-semibold transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                        {item.status === 'Completed' && (
                          <span className="text-[11px] text-emerald-600 font-bold">Finished ✓</span>
                        )}
                        {item.status === 'No Show' && (
                          <span className="text-[11px] text-slate-400 font-medium">No Show</span>
                        )}
                        {item.status === 'Cancelled' && (
                          <span className="text-[11px] text-rose-500 font-medium">Cancelled</span>
                        )}
                        {(item.status === 'Called' || item.status === 'Consulting') && (
                          <span className="text-[11px] text-blue-700 font-semibold italic">Doctor Active</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Details Modal */}
      <PatientDetailsModal
        patient={selectedPatient}
        allVisits={queue}
        onClose={() => setSelectedPatient(null)}
        onPrintTicket={(patientRec) => {
          setSelectedPatient(null);
          setPrintingTicket(patientRec);
        }}
      />

      {/* Print Ticket Modal */}
      {printingTicket && (
        <PrintTicketModal
          patientRecord={printingTicket}
          hospitalInfo={INITIAL_HOSPITAL_INFO}
          onClose={() => setPrintingTicket(null)}
          onConfirmPrint={() => setPrintingTicket(null)}
        />
      )}
    </div>
  );
};
