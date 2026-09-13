import React, { useState } from 'react';
import { HospitalInfo, Doctor, Department } from '../types';
import { 
  Building2, 
  Stethoscope, 
  Grid, 
  Printer, 
  UserCheck, 
  Check, 
  Save, 
  Plus, 
  Sliders,
  ShieldAlert,
  Server
} from 'lucide-react';

interface SettingsViewProps {
  hospitalInfo: HospitalInfo;
  doctors: Doctor[];
  departments: Department[];
  onUpdateHospitalInfo: (info: HospitalInfo) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  hospitalInfo,
  doctors,
  departments,
  onUpdateHospitalInfo,
}) => {
  const [activeTab, setActiveTab] = useState<'hospital' | 'doctors' | 'depts' | 'printer' | 'account'>('hospital');
  const [formInfo, setFormInfo] = useState<HospitalInfo>(hospitalInfo);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateHospitalInfo(formInfo);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Title */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Sliders className="w-6 h-6 text-blue-600" />
          System Settings
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure hospital details, doctor rosters, thermal print options, and desk preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'hospital', label: 'Hospital Information', icon: Building2 },
          { id: 'doctors', label: 'Doctor Roster', icon: Stethoscope },
          { id: 'depts', label: 'Departments & Services', icon: Grid },
          { id: 'printer', label: 'Printer Setup', icon: Printer },
          { id: 'account', label: 'Receptionist Account', icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: HOSPITAL INFORMATION */}
      {activeTab === 'hospital' && (
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-900">Hospital Information</h3>
            <p className="text-xs text-slate-500">Appears on OP Tickets and patient receipts</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-hosp-name" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Hospital Name
              </label>
              <input
                id="settings-hosp-name"
                type="text"
                value={formInfo.name}
                onChange={(e) => setFormInfo({ ...formInfo, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="settings-hosp-phone" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Contact Phone
              </label>
              <input
                id="settings-hosp-phone"
                type="text"
                value={formInfo.phone}
                onChange={(e) => setFormInfo({ ...formInfo, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="settings-hosp-address" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Hospital Address
              </label>
              <input
                id="settings-hosp-address"
                type="text"
                value={formInfo.address}
                onChange={(e) => setFormInfo({ ...formInfo, address: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="settings-hosp-email" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Official Email
              </label>
              <input
                id="settings-hosp-email"
                type="email"
                value={formInfo.email}
                onChange={(e) => setFormInfo({ ...formInfo, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Information updated successfully!
              </span>
            )}
            <div className="ml-auto">
              <button
                type="submit"
                id="settings-save-hosp-btn"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: DOCTORS CONFIG */}
      {activeTab === 'doctors' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Doctor Management</h3>
              <p className="text-xs text-slate-500">Configure doctor availability, rooms, and shift timings</p>
            </div>
            <button
              type="button"
              id="add-doctor-placeholder-btn"
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Doctor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {doctors.map((doc) => (
              <div key={doc.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">{doc.name}</h4>
                  <p className="text-xs text-slate-500">{doc.department} • {doc.room}</p>
                  <span className="inline-block mt-2 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {doc.status}
                  </span>
                </div>
                <button
                  type="button"
                  id={`edit-doc-btn-${doc.id}`}
                  className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-100"
                >
                  Configure
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DEPARTMENTS */}
      {activeTab === 'depts' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-900">Departments & Services</h3>
            <p className="text-xs text-slate-500">Configured medical clinical departments</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {departments.map((dept) => (
              <div key={dept.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-extrabold text-slate-900 text-sm">{dept.name}</h4>
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    {dept.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{dept.description}</p>
                <p className="text-[11px] text-slate-400 font-bold mt-2">{dept.doctorCount} Doctors assigned</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PRINTER SETUP */}
      {activeTab === 'printer' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-900">Printer Configuration</h3>
            <p className="text-xs text-slate-500">Reception thermal ticket printer spooling preferences</p>
          </div>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Active Printer Device
              </label>
              <input
                type="text"
                value={formInfo.printerName}
                onChange={(e) => setFormInfo({ ...formInfo, printerName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-slate-50"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50">
              <div>
                <p className="text-sm font-bold text-slate-900">Auto-print on ticket generation</p>
                <p className="text-xs text-slate-500">Send to thermal printer immediately after confirmation</p>
              </div>
              <input
                id="auto-print-checkbox"
                type="checkbox"
                checked={formInfo.autoPrintOnGenerate}
                onChange={(e) => setFormInfo({ ...formInfo, autoPrintOnGenerate: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RECEPTIONIST ACCOUNT */}
      {activeTab === 'account' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-900">Receptionist Account</h3>
            <p className="text-xs text-slate-500">Current front desk active session</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase">Current Session</p>
              <p className="text-lg font-extrabold text-slate-900 mt-0.5">{hospitalInfo.receptionistName}</p>
              <p className="text-xs text-slate-600">{hospitalInfo.receptionDesk} • Morning Shift (08:00 - 16:00)</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
              Session Active
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
