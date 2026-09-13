import React from 'react';
import { NavView, UserRole } from '../types';
import { useAuth } from '../auth/AuthContext';
import { getRoleBadgeStyle } from '../auth/permissions';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  Ticket, 
  Settings, 
  Building2, 
  UserCheck,
  Activity,
  X,
  Stethoscope,
  BarChart3,
  Calendar,
  ShieldCheck,
  User,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  onStartNewPatient: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  hospitalName: string;
  waitingCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onStartNewPatient,
  isOpenMobile,
  onCloseMobile,
  hospitalName,
  waitingCount,
}) => {
  const { user, logout } = useAuth();

  const userRole: UserRole = user?.role || 'receptionist';
  const roleBadge = getRoleBadgeStyle(userRole);

  // Dynamic Nav Items based on Role
  const getNavItems = () => {
    switch (userRole) {
      case 'doctor':
        return [
          { id: 'dashboard' as NavView, label: 'Dashboard', icon: LayoutDashboard },
          { id: 'my-queue' as NavView, label: 'My Queue', icon: Ticket, badge: waitingCount > 0 ? `${waitingCount} waiting` : null },
          { id: 'patients' as NavView, label: 'Patients', icon: Users },
          { id: 'schedule' as NavView, label: 'Schedule', icon: Calendar },
          { id: 'profile' as NavView, label: 'Profile', icon: User },
        ];
      case 'admin':
        return [
          { id: 'dashboard' as NavView, label: 'Dashboard', icon: LayoutDashboard },
          { id: 'users' as NavView, label: 'Users', icon: Users, badge: '28' },
          { id: 'doctors' as NavView, label: 'Doctors', icon: Stethoscope },
          { id: 'departments' as NavView, label: 'Departments', icon: Building2 },
          { id: 'tokens' as NavView, label: 'OP / Tokens', icon: Ticket, badge: waitingCount > 0 ? `${waitingCount}` : null },
          { id: 'reports' as NavView, label: 'Reports', icon: BarChart3 },
          { id: 'settings' as NavView, label: 'Settings', icon: Settings },
        ];
      case 'receptionist':
      default:
        return [
          { id: 'dashboard' as NavView, label: 'Dashboard', icon: LayoutDashboard },
          { id: 'new-patient' as NavView, label: 'New Patient', icon: UserPlus, isProminent: true },
          { id: 'kiosk' as NavView, label: 'Patient Kiosk Mode', icon: Activity, badge: 'Self-Service' },
          { id: 'patients' as NavView, label: 'Patients', icon: Users },
          { id: 'tokens' as NavView, label: 'OP / Tokens', icon: Ticket, badge: waitingCount > 0 ? `${waitingCount} waiting` : null },
          { id: 'settings' as NavView, label: 'Settings', icon: Settings },
        ];
    }
  };

  const navItems = getNavItems();

  const handleNavClick = (view: NavView) => {
    if (view === 'new-patient') {
      onStartNewPatient();
    } else {
      onNavigate(view);
    }
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        id="app-sidebar"
        className={`fixed lg:static top-0 left-0 bottom-0 z-50 w-72 bg-slate-900 text-slate-100 flex flex-col justify-between transition-transform duration-200 ease-in-out border-r border-slate-800 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header & Brand */}
        <div>
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 border border-blue-400/30">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  {hospitalName}
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </h1>
                <p className="text-xs text-slate-400 font-medium">Hospital Management</p>
              </div>
            </div>
            <button
              id="close-sidebar-mobile-btn"
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              if (item.isProminent) {
                return (
                  <button
                    key={item.id}
                    id={`nav-btn-${item.id}`}
                    onClick={() => handleNavClick(item.id)}
                    className="w-full mt-2 mb-4 p-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold flex items-center justify-between shadow-lg shadow-blue-600/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 border border-blue-400/30 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-semibold tracking-wide">➕ New Patient</span>
                    </div>
                    <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
                      Workflow
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  id={`nav-btn-${item.id}`}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full px-3.5 py-3 rounded-xl flex items-center justify-between text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white border-l-4 border-blue-500 shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Role-Aware Profile Widget */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90">
          <div 
            onClick={() => {
              onNavigate('profile');
              onCloseMobile();
            }}
            className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-lg ${user?.avatarColor || 'bg-blue-600'} text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-xs`}>
                {user?.name.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'ST'}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium truncate">
                  {user?.department || 'Front Desk'}
                </p>
                <p className="text-sm font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                  {user?.name || 'Sarah Thomas'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                userRole === 'admin' 
                  ? 'bg-purple-900/60 text-purple-300 border-purple-700'
                  : userRole === 'doctor'
                  ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700'
                  : 'bg-blue-900/60 text-blue-300 border-blue-700'
              }`}>
                {userRole}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> Active Session
            </span>
            <button
              id="sidebar-sign-out-btn"
              onClick={logout}
              className="text-slate-400 hover:text-rose-400 flex items-center gap-1 font-medium transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
