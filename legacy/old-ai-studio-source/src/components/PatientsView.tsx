import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { getPatients, subscribePatients } from '../services/patientStore';
import { EditPatientModal } from './EditPatientModal';
import { useAuth } from '../auth/AuthContext';
import { Search, Users, User, Phone, Calendar, ChevronRight, X, Edit3, UserPlus, FileText, CheckCircle2, Clock } from 'lucide-react';

interface PatientsViewProps {
  onStartNewPatient: () => void;
}

export const PatientsView: React.FC<PatientsViewProps> = ({ onStartNewPatient }) => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>(getPatients());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Today' | 'Active' | 'Completed'>('All');
  
  // Selected Patient for Drawer
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  // Patient Editing Modal
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  // Subscribe to live updates from patientStore
  useEffect(() => {
    setPatients(getPatients());
    const unsubscribe = subscribePatients((updatedList) => {
      setPatients(updatedList);
      if (selectedPatient) {
        const refreshed = updatedList.find((p) => p.id === selectedPatient.id);
        if (refreshed) setSelectedPatient(refreshed);
      }
    });
    return () => unsubscribe();
  }, []);

  const canEdit = user?.role === 'receptionist' || user?.role === 'admin';
  const todayStr = new Date().toISOString().split('T')[0];

  // Filter patients by search term & category filter
  const filteredPatients = patients.filter((p) => {
    // 1. Search Query Match
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !query ||
      p.patientName.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query) ||
      p.phone.replace(/\D/g, '').includes(query.replace(/\D/g, '')) ||
      (p.address && p.address.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    // 2. Tab Filter Match
    if (statusFilter === 'Today') {
      return p.registrationDate === todayStr;
    }
    if (statusFilter === 'Active') {
      return p.status === 'Active' || p.status === 'In Visit';
    }
    if (statusFilter === 'Completed') {
      return p.status === 'Completed';
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Patients Directory
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Search, view, and manage basic patient registration records
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            id="patients-register-btn"
            onClick={onStartNewPatient}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all flex items-center gap-2 self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Register Patient</span>
          </button>
        )}
      </div>

      {/* Search Bar & Filter Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="patients-search-input"
            type="text"
            placeholder="🔍 Search patient by ID, name, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filter Strip */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['All', 'Today', 'Active', 'Completed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              id={`filter-tab-${tab.toLowerCase()}`}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab === 'Today' ? 'Registered Today' : tab}
            </button>
          ))}
          <span className="text-xs font-semibold text-slate-400 ml-2 hidden lg:inline">
            ({filteredPatients.length} records)
          </span>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="patients-directory-table">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Patient ID</th>
                <th className="py-3.5 px-4">Patient Name</th>
                <th className="py-3.5 px-4">Age / Gender</th>
                <th className="py-3.5 px-4">Phone Number</th>
                <th className="py-3.5 px-4">Registration Date</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 space-y-3">
                    <p className="text-base font-bold text-slate-700">No patients found</p>
                    <p className="text-xs text-slate-400">
                      No matching records for "{searchTerm}" in category "{statusFilter}"
                    </p>
                    {canEdit && (
                      <button
                        type="button"
                        id="empty-search-register-btn"
                        onClick={onStartNewPatient}
                        className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Register New Patient</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-black text-blue-700 text-xs">
                      {p.id}
                    </td>

                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {p.patientName}
                        </p>
                        {p.address && (
                          <p className="text-xs text-slate-400 truncate max-w-[200px]">
                            {p.address}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {p.age} Yrs • {p.gender}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {p.phone}
                    </td>

                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                      {p.registrationDate === todayStr ? (
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Today
                        </span>
                      ) : (
                        p.registrationDate
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          p.status === 'Active'
                            ? 'bg-blue-100 text-blue-800'
                            : p.status === 'In Visit'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <button
                            type="button"
                            id={`edit-patient-btn-${p.id}`}
                            onClick={() => setEditingPatient(p)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Edit Patient Info"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          id={`view-patient-btn-${p.id}`}
                          onClick={() => setSelectedPatient(p)}
                          className="p-1.5 text-slate-400 group-hover:text-blue-600 transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
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

      {/* Patient Detail Slideover Drawer */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full p-6 overflow-y-auto shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200 flex flex-col justify-between">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-900 text-lg">Patient Registration Profile</h3>
                <button
                  type="button"
                  id="close-patient-drawer-btn"
                  onClick={() => setSelectedPatient(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-6">
                {/* Header Info Banner */}
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shadow-xs">
                    {selectedPatient.patientName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-lg">{selectedPatient.patientName}</h4>
                    <p className="text-xs text-slate-500">
                      {selectedPatient.age} Yrs • {selectedPatient.gender}
                    </p>
                    <p className="text-xs font-mono font-black text-blue-700 mt-1">
                      {selectedPatient.id}
                    </p>
                  </div>
                </div>

                {/* Registration Details */}
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Patient ID:</span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {selectedPatient.id}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Phone Number:</span>
                    <span className="font-bold text-slate-900">{selectedPatient.phone}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Age & Gender:</span>
                    <span className="font-bold text-slate-900">{selectedPatient.age} Yrs ({selectedPatient.gender})</span>
                  </div>

                  {selectedPatient.dob && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500 font-medium">Date of Birth:</span>
                      <span className="font-bold text-slate-900">{selectedPatient.dob}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Registration Date:</span>
                    <span className="font-bold text-slate-800">{selectedPatient.registrationDate}</span>
                  </div>

                  <div className="py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium block mb-1">Address:</span>
                    <span className="font-semibold text-slate-800 text-xs">
                      {selectedPatient.address || 'No address provided'}
                    </span>
                  </div>
                </div>

                {/* Visit History Section */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h5 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    Visit History
                  </h5>
                  {selectedPatient.visitCount && selectedPatient.visitCount > 0 ? (
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between py-1 bg-white p-2 rounded-lg border border-slate-200">
                        <span>Total Registered Visits:</span>
                        <span className="font-bold text-slate-900">{selectedPatient.visitCount} visits</span>
                      </div>
                      <div className="flex justify-between py-1 bg-white p-2 rounded-lg border border-slate-200">
                        <span>Last Visit Date:</span>
                        <span className="font-bold text-slate-900">{selectedPatient.lastVisitDate}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic py-2">
                      No previous medical visits recorded yet.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 border-t border-slate-100 flex gap-2">
              {canEdit && (
                <button
                  type="button"
                  id="drawer-edit-patient-btn"
                  onClick={() => {
                    setEditingPatient(selectedPatient);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Patient</span>
                </button>
              )}

              <button
                type="button"
                id="drawer-close-btn"
                onClick={() => setSelectedPatient(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-300 font-semibold text-slate-700 text-xs hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {editingPatient && (
        <EditPatientModal
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          onPatientUpdated={(updated) => {
            setSelectedPatient(updated);
          }}
        />
      )}
    </div>
  );
};
