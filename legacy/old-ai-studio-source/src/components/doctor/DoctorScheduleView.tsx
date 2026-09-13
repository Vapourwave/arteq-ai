import React, { useState } from 'react';
import { Calendar, Clock, Building2, UserCheck, CheckCircle2, ShieldCheck } from 'lucide-react';

interface DoctorScheduleViewProps {
  doctorName: string;
  department: string;
  room?: string;
}

export const DoctorScheduleView: React.FC<DoctorScheduleViewProps> = ({
  doctorName,
  department,
  room = '102',
}) => {
  const [isOnDuty, setIsOnDuty] = useState(true);

  const scheduleDays = [
    { day: 'Monday', hours: '09:00 AM - 05:00 PM', maxPatients: 30, status: 'Active' },
    { day: 'Tuesday', hours: '09:00 AM - 05:00 PM', maxPatients: 30, status: 'Active' },
    { day: 'Wednesday', hours: '09:00 AM - 01:00 PM', maxPatients: 15, status: 'Half Day' },
    { day: 'Thursday', hours: '09:00 AM - 05:00 PM', maxPatients: 30, status: 'Active' },
    { day: 'Friday', hours: '09:00 AM - 05:00 PM', maxPatients: 30, status: 'Active' },
    { day: 'Saturday', hours: '10:00 AM - 02:00 PM', maxPatients: 15, status: 'Active' },
    { day: 'Sunday', hours: 'Off Duty', maxPatients: 0, status: 'Off' },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Duty Schedule & Consultation Hours</h1>
          <p className="text-xs text-slate-500">Weekly shift allocation for {doctorName} ({department})</p>
        </div>

        {/* Status Toggle */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-700 pl-2">Console Availability Status:</span>
          <button
            onClick={() => setIsOnDuty(!isOnDuty)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              isOnDuty
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOnDuty ? 'bg-white animate-ping' : 'bg-amber-600'}`} />
            {isOnDuty ? 'Available for Tokens' : 'On Break / Paused'}
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Assigned Consultation Room</p>
          <p className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" /> Room {room}
          </p>
          <p className="text-xs text-slate-400 mt-1">{department} Wing • First Floor</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Weekly Capacity</p>
          <p className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" /> 150 Patients
          </p>
          <p className="text-xs text-slate-400 mt-1">Average 30 tokens/day</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Token Slot Duration</p>
          <p className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" /> ~15 Mins
          </p>
          <p className="text-xs text-slate-400 mt-1">Estimated per patient</p>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">
          Weekly Shift Matrix
        </div>
        <div className="divide-y divide-slate-100">
          {scheduleDays.map((item, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  {item.day.slice(0, 3)}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{item.day}</p>
                  <p className="text-slate-400 font-medium">{item.hours}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="hidden sm:inline text-slate-500">
                  Capacity: <strong className="text-slate-700">{item.maxPatients} patients</strong>
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full font-semibold text-[11px] border ${
                    item.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : item.status === 'Half Day'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
