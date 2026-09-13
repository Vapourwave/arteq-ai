import React, { useState, useRef, useEffect } from 'react';
import { Menu, Calendar, UserPlus, Clock, ChevronDown, User, LogOut, ShieldCheck, Stethoscope, UserCheck, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getRoleBadgeStyle } from '../auth/permissions';
import { NavView } from '../types';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  onStartNewPatient: () => void;
  onNavigate: (view: NavView) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  onStartNewPatient,
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const role = user?.role || 'receptionist';
  const badgeStyle = getRoleBadgeStyle(role);
  const firstName = user?.name ? user.name.split(' ')[0] : 'Staff';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 lg:px-8 py-3.5 shadow-xs">
      <div className="flex items-center justify-between gap-4">
        
        {/* Left: Mobile Toggle & Greeting */}
        <div className="flex items-center gap-3">
          <button
            id="open-mobile-sidebar-btn"
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 border border-slate-200"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Good morning, {firstName}
              </h2>
              <span className={`hidden sm:inline-block px-2.5 py-0.5 text-xs font-semibold rounded-md border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                {badgeStyle.label} • {user?.department || 'Front Desk'}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentDateFormatted}</span>
              <span className="text-slate-300 mx-1">•</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Shift: {user?.shiftHours || 'Active Session'}</span>
            </p>
          </div>
        </div>

        {/* Right: Quick Actions & Profile Dropdown */}
        <div className="flex items-center gap-3">
          
          {/* New Patient Button (For Receptionist & Admin) */}
          {(role === 'receptionist' || role === 'admin') && (
            <div className="flex items-center gap-2">
              <button
                id="header-kiosk-mode-btn"
                onClick={() => onNavigate('kiosk')}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-amber-300 border border-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-all"
                title="Switch Terminal to Self-Service Patient Kiosk Mode"
              >
                <span>🖥️</span>
                <span className="hidden md:inline">Patient Kiosk</span>
              </button>

              <button
                id="header-new-patient-btn"
                onClick={onStartNewPatient}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all transform active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">+ New Patient</span>
                <span className="sm:hidden">+ Register</span>
              </button>
            </div>
          )}

          {/* Doctor Quick Queue Shortcut */}
          {role === 'doctor' && (
            <button
              id="header-doctor-queue-btn"
              onClick={() => onNavigate('my-queue')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">My Queue</span>
            </button>
          )}

          {/* Profile Menu Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              id="user-profile-menu-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 flex items-center gap-2 transition-all"
            >
              <div className={`w-7 h-7 rounded-lg ${user?.avatarColor || 'bg-blue-600'} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                {user?.name.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'ST'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">{user?.name}</p>
                <p className="text-[10px] text-slate-500 capitalize">{role}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {/* Dropdown Card */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 text-slate-800 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="font-bold text-slate-900 text-xs">{user?.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">{user?.email}</p>
                  <div className="mt-2 inline-block">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                      Staff ID: {user?.staffId}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    id="menu-my-profile-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate('profile');
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-50 font-medium flex items-center gap-2 text-slate-700"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>My Account Profile</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    id="menu-sign-out-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-rose-50 text-rose-600 font-semibold flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
