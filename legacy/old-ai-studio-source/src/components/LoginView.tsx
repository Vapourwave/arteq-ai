import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DEMO_CREDENTIALS_LIST } from '../auth/demoUsers';
import { UserRole } from '../types';
import { 
  Building2, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle,
  HelpCircle,
  X,
  CheckCircle2,
  Stethoscope,
  UserCheck,
  ShieldAlert
} from 'lucide-react';

interface LoginViewProps {
  onLaunchKiosk?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLaunchKiosk }) => {
  const { login, demoLogin } = useAuth();
  
  const [emailOrStaffId, setEmailOrStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!emailOrStaffId.trim()) {
      setError('Please enter your Email or Staff ID.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const result = login(emailOrStaffId, password);
      setIsSubmitting(false);
      if (!result.success && result.error) {
        setError(result.error);
      }
    }, 400);
  };

  const handleDemoClick = (role: UserRole, demoEmail: string, demoPass: string) => {
    setEmailOrStaffId(demoEmail);
    setPassword(demoPass);
    setError(null);
    demoLogin(role);
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'receptionist':
        return <UserCheck className="w-4 h-4 text-blue-600" />;
      case 'doctor':
        return <Stethoscope className="w-4 h-4 text-emerald-600" />;
      case 'admin':
        return <ShieldAlert className="w-4 h-4 text-purple-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden font-sans">
      {/* Background Subtle Medical Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      {/* Top Banner Accent */}
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 w-full" />

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10 my-6">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Brand Overview & System Intro */}
          <div className="lg:col-span-5 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ABC Hospital Core Operations • v1.0
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/25 border border-blue-400/30">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">ABC HOSPITAL</h1>
                <p className="text-sm font-medium text-slate-400">Hospital Management System</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto lg:mx-0">
              Secure staff entry portal for Receptionists, Doctors, and System Administrators. Please sign in with your authorized credentials to manage patient workflows and OP queues.
            </p>

            {/* Patient Kiosk Launch Prompt */}
            {onLaunchKiosk && (
              <div className="pt-2">
                <button
                  type="button"
                  id="launch-patient-kiosk-btn"
                  onClick={onLaunchKiosk}
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/25 border border-emerald-400/30 transition-all transform active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>🖥️ Patient Self-Service Kiosk Mode</span>
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </button>
              </div>
            )}

            {/* Quick System Highlights */}
            <div className="pt-2 hidden sm:grid grid-cols-2 gap-3 text-left">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">Role Access Control</p>
                  <p className="text-[11px] text-slate-400">Reception, Doctor & Admin security</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">OP Queue Dispatch</p>
                  <p className="text-[11px] text-slate-400">Real-time token workflow</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sign In Form & Demo Selector */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Login Card */}
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight">Sign in to continue</h2>
                <p className="text-xs text-slate-400 mt-1">Enter your registered email address or staff ID and password.</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email / Staff ID */}
                <div>
                  <label htmlFor="login-email-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email / Staff ID
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="login-email-input"
                      type="text"
                      value={emailOrStaffId}
                      onChange={(e) => setEmailOrStaffId(e.target.value)}
                      placeholder="e.g. receptionist@demo.hospital or REC-104"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password-input" className="block text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors font-medium"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="login-password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Sign In Button */}
                <button
                  id="sign-in-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all transform active:scale-[0.99] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Demo Accounts Section */}
              <div className="mt-8 pt-6 border-t border-slate-700/60">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Demo Accounts (Step 2 Testing)
                  </span>
                  <span className="text-[11px] text-slate-500">1-Click Fast Login</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {DEMO_CREDENTIALS_LIST.map((demo) => (
                    <button
                      key={demo.role}
                      type="button"
                      id={`demo-login-${demo.role}-btn`}
                      onClick={() => handleDemoClick(demo.role, demo.email, demo.password)}
                      className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-slate-500 hover:bg-slate-900 text-left transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1">
                            {getRoleIcon(demo.role)}
                            {demo.roleName}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${demo.badgeColor}`}>
                            Demo
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-300 truncate">{demo.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{demo.department}</p>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between group-hover:text-slate-200">
                        <span>Sign In</span>
                        <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-slate-500 font-medium">
              Authorized hospital staff only • ABC Hospital IT Security Policy
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base text-white">Forgot Password?</h3>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed mb-6">
              <p>
                In a production hospital environment, resetting credentials requires contact with the IT Helpdesk or Hospital Administrator for security compliance.
              </p>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 space-y-1">
                <p className="font-semibold text-slate-200">For Prototype Testing:</p>
                <p className="text-slate-400">Please use any of the pre-configured Demo Accounts on the login page.</p>
                <p className="font-mono text-emerald-400 text-[11px] pt-1">Default Password: Demo@123</p>
              </div>
            </div>

            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
