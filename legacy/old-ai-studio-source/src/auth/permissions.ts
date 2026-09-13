import { UserRole, NavView } from '../types';

export const ROLE_ALLOWED_VIEWS: Record<UserRole, NavView[]> = {
  receptionist: [
    'dashboard',
    'new-patient',
    'patients',
    'tokens',
    'settings',
    'profile',
    'kiosk',
  ],
  doctor: [
    'dashboard',
    'my-queue',
    'patients',
    'schedule',
    'settings',
    'profile',
    'kiosk',
  ],
  admin: [
    'dashboard',
    'users',
    'doctors',
    'departments',
    'tokens',
    'reports',
    'settings',
    'profile',
    'kiosk',
  ],
};

export const ROLE_DEFAULT_VIEW: Record<UserRole, NavView> = {
  receptionist: 'dashboard',
  doctor: 'dashboard',
  admin: 'dashboard',
};

export function hasPermission(role: UserRole | undefined, view: NavView): boolean {
  if (!role) return false;
  const allowed = ROLE_ALLOWED_VIEWS[role];
  return allowed ? allowed.includes(view) : false;
}

export function getRoleBadgeStyle(role: UserRole | string | undefined): { label: string; bg: string; text: string; border: string } {
  switch (role) {
    case 'receptionist':
      return { label: 'Receptionist', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'doctor':
      return { label: 'Doctor', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'admin':
      return { label: 'Administrator', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    default:
      return { label: 'Staff', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
  }
}
