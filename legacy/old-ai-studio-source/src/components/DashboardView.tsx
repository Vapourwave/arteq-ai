import React, { useState } from 'react';
import { PatientRecord, Doctor } from '../types';
import { getPatientsTodayCount } from '../services/patientStore';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  UserPlus, 
  Search, 
  Filter, 
  Stethoscope, 
  Activity,
  ArrowRight,
  Eye,
  ChevronRight,
  Sparkles,
  PhoneCall
} from 'lucide-react';

interface DashboardViewProps {
  queue: PatientRecord[];
  doctors: Doctor[];
  onStartNewPatient: () => void;
  onViewAllQueue: () => void;
  onSelectPatient: (patient: PatientRecord) => void;
  onUpdatePatientStatus: (patientId: string, newStatus: PatientRecord['status']) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  queue,
  doctors,
  onStartNewPatient,
  onViewAllQueue,
  onSelectPatient,
  onUpdatePatientStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Compute metrics dynamically from queue & store
  const registeredTodayCount = getPatientsTodayCount();
  const totalPatientsToday = Math.max(queue.length, registeredTodayCount, 8);
  const waitingCount = queue.filter((p) => p.status === 'Waiting').length;
  const calledCount = queue.filter((p) => p.status === 'Called').length;
  const consultingCount = queue.filter((p) => p.status === 'Consulting').length;
  const completedCount = queue.filter((p) => p.status === 'Completed').length;

  const currentlyServing = queue.filter((p) => p.status === 'Consulting' || p.status === 'Called');

  const filteredQueue = queue.filter((item) => {
    const matchesSearch =
      item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tokenNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ? true : item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: PatientRecord['status']) => {
    switch (status) {
      case 'Waiting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Waiting
          </span>
        );
      case 'Called':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            Called
          </span>
        );
      case 'Consulting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
            Consulting
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'No Show':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            No Show
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner / Hero Action */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-medium border border-blue-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Receptionist Flow Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Patient Flow & Registration
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Process patient check-ins, record service requirements, choose available doctors, and issue OP tickets seamlessly.
            </p>
          </div>

          <button
            id="dashboard-hero-new-patient-btn"
            onClick={onStartNewPatient}
            className="px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-base shrink-0 border border-blue-400/40 group"
          >
            <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>+ New Patient</span>
            <ChevronRight className="w-5 h-5 text-blue-200" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
        {/* Patients Today */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Patients Today
            </p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
              {totalPatientsToday}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">{registeredTodayCount} registered</span> today
            </p>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Waiting */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Waiting in Queue
            </p>
            <h3 className="text-3xl font-extrabold text-amber-600 mt-1">
              {waitingCount}
            </h3>
            <p className="text-xs text-amber-700 font-medium mt-1">
              Avg. wait time: ~12 mins
            </p>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed
            </p>
            <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">
              {completedCount}
            </h3>
            <p className="text-xs text-emerald-700 font-medium mt-1">
              Consultations finished
            </p>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Currently Serving Active Panel */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 border border-slate-700 shadow-md">
        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <h3 className="font-bold text-white text-sm tracking-wide uppercase">Currently Serving across Consultation Rooms</h3>
          </div>
          <span className="text-xs text-slate-300 font-mono font-bold">
            {currentlyServing.length} Active
          </span>
        </div>

        {currentlyServing.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">
            No active consultations right now. Doctors are ready for next patients.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentlyServing.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-white/10 border border-white/15 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-blue-300 text-sm">{item.tokenNumber}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.status === 'Consulting' ? 'bg-blue-500 text-white' : 'bg-indigo-500 text-white'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="font-bold text-white mt-1">{item.patientName}</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">{item.doctorName} • <span className="text-emerald-300">{item.doctorRoom}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Doctors Availability Quick Strip */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Active Doctors & Room Status</h3>
          </div>
          <span className="text-xs text-slate-500">{doctors.filter(d => d.status === 'Available').length} Doctors Available</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {doctors.map((doc) => (
            <div
              key={doc.id}
              className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition-all text-left"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{doc.room}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    doc.status === 'Available'
                      ? 'bg-emerald-500 ring-2 ring-emerald-200'
                      : doc.status === 'In Consultation'
                      ? 'bg-blue-500'
                      : 'bg-amber-500'
                  }`}
                  title={doc.status}
                />
              </div>
              <p className="font-bold text-slate-900 text-xs truncate">{doc.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{doc.department}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Queue Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Current OP Queue
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live receptionist token status and patient consulting order
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="queue-search-input"
                type="text"
                placeholder="Search token, patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Status Filter buttons */}
            <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5">
              {['All', 'Waiting', 'Consulting', 'Completed'].map((status) => (
                <button
                  key={status}
                  id={`queue-filter-${status.toLowerCase()}`}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <button
              id="view-all-queue-btn"
              onClick={onViewAllQueue}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline ml-1"
            >
              Full Queue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="current-op-queue-table">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 font-bold">Token</th>
                <th className="py-3.5 px-4 font-bold">Patient</th>
                <th className="py-3.5 px-4 font-bold">Doctor</th>
                <th className="py-3.5 px-4 font-bold">Department</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                    No matching patient records found in queue.
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectPatient(item)}
                  >
                    {/* Token */}
                    <td className="py-3.5 px-4 font-extrabold text-blue-700">
                      <span className="px-2.5 py-1 bg-blue-100/80 text-blue-800 rounded-lg border border-blue-200/80 font-mono text-xs shadow-2xs">
                        {item.tokenNumber}
                      </span>
                    </td>

                    {/* Patient */}
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {item.patientName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.age} yrs • {item.gender} • {item.phone}
                        </p>
                      </div>
                    </td>

                    {/* Doctor */}
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{item.doctorName}</p>
                      <p className="text-xs text-slate-500">{item.doctorRoom}</p>
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {item.department}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {item.status === 'Waiting' && (
                          <button
                            id={`call-token-btn-${item.id}`}
                            onClick={() => onUpdatePatientStatus(item.id, 'Consulting')}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-2xs"
                            title="Call to Doctor Consultation"
                          >
                            <PhoneCall className="w-3 h-3" /> Call
                          </button>
                        )}
                        {item.status === 'Consulting' && (
                          <button
                            id={`complete-token-btn-${item.id}`}
                            onClick={() => onUpdatePatientStatus(item.id, 'Completed')}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-2xs"
                            title="Mark Consultation Complete"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Complete
                          </button>
                        )}
                        <button
                          id={`view-patient-btn-${item.id}`}
                          onClick={() => onSelectPatient(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
