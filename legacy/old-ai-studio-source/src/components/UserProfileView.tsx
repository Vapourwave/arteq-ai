import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { getRoleBadgeStyle, ROLE_ALLOWED_VIEWS } from '../auth/permissions';
import { UserRole } from '../types';
import { 
  User, 
  Mail, 
  ShieldCheck, 
  Building2, 
  Clock, 
  LogOut, 
  Key, 
  CheckCircle2, 
  Sparkles,
  Phone,
  ShieldAlert
} from 'lucide-react';

export const UserProfileView: React.FC = () => {
  const { user, logout, demoLogin } = useAuth();

  if (!user) return null;

  const badge = getRoleBadgeStyle(user.role);
  const allowedViews = ROLE_ALLOWED_VIEWS[user.role] || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Staff Account Profile</h1>
          <p className="text-xs text-slate-500">Authenticated session details, role permissions, and active credentials.</p>
        </div>

        <button
          onClick={logout}
          className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 flex items-center gap-2 transition-colors self-start sm:self-auto shadow-xs"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 border-b border-slate-100 pb-6">
          <div className={`w-16 h-16 rounded-2xl ${user.avatarColor || 'bg-blue-600'} text-white font-bold text-2xl flex items-center justify-center shadow-lg`}>
            {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
              <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-2 font-medium">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> {user.email}
              <span className="text-slate-300">•</span>
              <span className="font-mono text-slate-700 font-bold">Staff ID: {user.staffId}</span>
            </p>
          </div>
        </div>

        {/* Profile Details Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-400 font-medium block mb-1">Department Wing</span>
            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              {user.department}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-400 font-medium block mb-1">Active Duty Shift</span>
            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              {user.shiftHours || '08:00 AM - 04:00 PM'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-400 font-medium block mb-1">Last Session Login</span>
            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              {user.lastLogin || 'Active Session'}
            </span>
          </div>
        </div>

        {/* Role Permissions Section */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
            <Key className="w-4 h-4 text-amber-500" />
            Role Navigation & System Capabilities Matrix
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Below are the authorized views available to your system role (<strong className="capitalize">{user.role}</strong>). Any attempt to navigate outside this matrix triggers Role-Based Route Protection.
          </p>

          <div className="flex flex-wrap gap-2">
            {allowedViews.map((v) => (
              <span
                key={v}
                className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold capitalize flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {v.replace('-', ' ')}
              </span>
            ))}
          </div>
        </div>

        {/* Demo Switcher Helper for Step 2 Testing */}
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Quick Role Switcher (Step 2 Prototype Testing)
            </span>
            <span className="text-[11px] text-purple-700">1-Click Role Swap</span>
          </div>
          <p className="text-xs text-purple-700">
            Easily test different roles without logging out manually:
          </p>
          <div className="flex items-center gap-2 pt-1">
            {(['receptionist', 'doctor', 'admin'] as UserRole[]).map((r) => (
              <button
                key={r}
                onClick={() => demoLogin(r)}
                disabled={user.role === r}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                  user.role === r
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-white text-purple-900 border border-purple-300 hover:bg-purple-100'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
