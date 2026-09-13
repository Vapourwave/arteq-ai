import React, { useState } from 'react';
import { Doctor } from '../../types';
import { Stethoscope, Plus, Search, Building2, UserCheck, Clock, CheckCircle2, X } from 'lucide-react';

interface DoctorsManagementViewProps {
  doctors: Doctor[];
  onUpdateDoctorStatus?: (doctorId: string, status: Doctor['status']) => void;
}

export const DoctorsManagementView: React.FC<DoctorsManagementViewProps> = ({
  doctors,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const filteredDoctors = doctors.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.room.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Doctor Roster & Room Assignments</h1>
          <p className="text-xs text-slate-500">Manage medical specialists, consultation rooms, and duty availability.</p>
        </div>

        <button
          onClick={() => {
            setNotification('Add Doctor form modal triggered (Admin Feature).');
            setTimeout(() => setNotification(null), 3000);
          }}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Specialist Doctor</span>
        </button>
      </div>

      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)}>
            <X className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      )}

      {/* Search Header */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search doctor, department, specialty, or room..."
            className="w-full pl-10 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Showing {filteredDoctors.length} Doctors
        </div>
      </div>

      {/* Doctor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDoctors.map((doc) => (
          <div
            key={doc.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${doc.avatarColor} text-white font-bold flex items-center justify-center text-sm shadow-xs`}>
                  {doc.name.replace('Dr. ', '').slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    doc.status === 'Available'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : doc.status === 'In Consultation'
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {doc.status}
                </span>
              </div>

              <h3 className="font-bold text-base text-slate-900">{doc.name}</h3>
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">{doc.specialty}</p>

              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Department:</span>
                  <span className="font-semibold text-slate-900">{doc.department}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Assigned Room:</span>
                  <span className="font-mono font-bold text-slate-900">Room {doc.room}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Experience:</span>
                  <span className="font-semibold text-slate-900">{doc.experienceYears} Years</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> {doc.nextOpTime}
              </span>
              <button
                onClick={() => {
                  setNotification(`Room assignment updated for ${doc.name}.`);
                  setTimeout(() => setNotification(null), 3000);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px]"
              >
                Edit Roster
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
