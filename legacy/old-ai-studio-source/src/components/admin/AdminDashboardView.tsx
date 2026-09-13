import React from 'react';
import { 
  Users, 
  Stethoscope, 
  Building2, 
  Ticket, 
  ShieldCheck, 
  TrendingUp, 
  BarChart3, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Plus,
  Settings,
  UserPlus
} from 'lucide-react';
import { Doctor, Department, PatientRecord } from '../../types';

interface AdminDashboardViewProps {
  doctors: Doctor[];
  departments: Department[];
  queue: PatientRecord[];
  onNavigateView: (view: 'users' | 'doctors' | 'departments' | 'reports' | 'tokens' | 'settings') => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  doctors,
  departments,
  queue,
  onNavigateView,
}) => {
  const activeDoctorsCount = doctors.filter((d) => d.status === 'Available' || d.status === 'In Consultation').length;
  const waitingCount = queue.filter((p) => p.status === 'Waiting').length;
  const completedCount = queue.filter((p) => p.status === 'Completed').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-800 via-indigo-800 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-purple-700/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-200 text-xs font-semibold border border-purple-400/30">
              System Administration
            </span>
            <span className="text-purple-300 text-xs">• Hospital Operations Control</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">System Overview Dashboard</h1>
          <p className="text-xs text-purple-200/80">
            Monitor staff access, department allocations, live OP volume, and system configuration.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigateView('users')}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Manage Users</span>
          </button>
          <button
            onClick={() => onNavigateView('reports')}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-all flex items-center gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>View Reports</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Staff Users */}
        <div 
          onClick={() => onNavigateView('users')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-purple-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Staff</span>
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600 border border-purple-200 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">28</p>
          <p className="text-xs text-purple-600 font-semibold mt-1 flex items-center gap-1">
            <span>3 Roles Configured</span>
            <ArrowUpRight className="w-3 h-3" />
          </p>
        </div>

        {/* Active Doctors */}
        <div 
          onClick={() => onNavigateView('doctors')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Doctors</span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-200 group-hover:scale-105 transition-transform">
              <Stethoscope className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{activeDoctorsCount} / {doctors.length}</p>
          <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <span>Roster On Duty</span>
            <ArrowUpRight className="w-3 h-3" />
          </p>
        </div>

        {/* Departments */}
        <div 
          onClick={() => onNavigateView('departments')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Departments</span>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600 border border-blue-200 group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{departments.length}</p>
          <p className="text-xs text-blue-600 font-semibold mt-1 flex items-center gap-1">
            <span>All Operational</span>
            <ArrowUpRight className="w-3 h-3" />
          </p>
        </div>

        {/* Today's OP Volume */}
        <div 
          onClick={() => onNavigateView('tokens')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">OP Volume Today</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-200 group-hover:scale-105 transition-transform">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{queue.length}</p>
          <p className="text-xs text-amber-600 font-semibold mt-1 flex items-center gap-1">
            <span>{waitingCount} Waiting • {completedCount} Done</span>
            <ArrowUpRight className="w-3 h-3" />
          </p>
        </div>
      </div>

      {/* Admin Quick Action Shortcuts & Department Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Management Shortcuts */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            Admin Control Center
          </h2>
          <p className="text-xs text-slate-500">Configure core hospital system entities and staff permissions.</p>

          <div className="space-y-2.5 pt-1">
            <button
              onClick={() => onNavigateView('users')}
              className="w-full p-3 rounded-xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-200 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-purple-700">Manage Staff Accounts</p>
                  <p className="text-[11px] text-slate-400">Receptionist, Doctor & Admin credentials</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
            </button>

            <button
              onClick={() => onNavigateView('doctors')}
              className="w-full p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-200 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">Doctor Roster & Rooms</p>
                  <p className="text-[11px] text-slate-400">Duty schedules and consultation room map</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </button>

            <button
              onClick={() => onNavigateView('departments')}
              className="w-full p-3 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-200 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700">Departments & Services</p>
                  <p className="text-[11px] text-slate-400">Configure medical wings and service tags</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>

            <button
              onClick={() => onNavigateView('settings')}
              className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200 text-slate-700 rounded-lg">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-slate-900">Hospital-Wide Settings</p>
                  <p className="text-[11px] text-slate-400">Thermal ticket printers, desk names & headers</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
            </button>
          </div>
        </div>

        {/* Department Roster & Live Queue Summary */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-bold text-slate-900 text-base">Department OP Traffic & Doctor Allocation</h2>
            <button 
              onClick={() => onNavigateView('departments')}
              className="text-xs text-purple-600 hover:text-purple-700 font-semibold"
            >
              View All ({departments.length}) →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {departments.map((dept) => {
              const deptQueue = queue.filter((p) => p.department === dept.name);
              const deptDoctors = doctors.filter((d) => d.department === dept.name);

              return (
                <div key={dept.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-mono text-[10px]">
                        {dept.code}
                      </span>
                      {dept.name}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {deptDoctors.length} {deptDoctors.length === 1 ? 'Doctor' : 'Doctors'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-1">{dept.description}</p>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Today's Tokens:</span>
                    <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {deptQueue.length} Patients
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
