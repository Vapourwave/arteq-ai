import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, Building2 } from 'lucide-react';
import { UserRole } from '../types';
import { getRoleBadgeStyle } from '../auth/permissions';

interface AccessDeniedProps {
  userRole?: UserRole;
  attemptedView?: string;
  onReturnToDashboard: () => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  userRole = 'receptionist',
  attemptedView = 'Admin View',
  onReturnToDashboard,
}) => {
  const badgeStyle = getRoleBadgeStyle(userRole);

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-lg">
        {/* Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-5 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Access Denied</h2>
        
        {/* Subtitle */}
        <p className="text-sm font-medium text-slate-600 mt-2">
          You don't have permission to access this page.
        </p>

        {/* Explanation Card */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Your Active Role:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
              {badgeStyle.label}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Requested Resource:</span>
            <span className="font-mono text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
              {attemptedView}
            </span>
          </div>
          <p className="text-slate-500 pt-1 text-[11px] leading-relaxed border-t border-slate-200/80 mt-2">
            This module requires higher security clearance or a different operational role. Role-Based Access Control (RBAC) keeps patient information safe.
          </p>
        </div>

        {/* Action Button */}
        <div className="mt-6">
          <button
            id="return-to-dashboard-btn"
            onClick={onReturnToDashboard}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all transform active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
