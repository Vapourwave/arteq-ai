import React, { useState } from 'react';
import { Department } from '../../types';
import { Building2, Plus, Search, CheckCircle2, X } from 'lucide-react';

interface DepartmentsViewProps {
  departments: Department[];
}

export const DepartmentsView: React.FC<DepartmentsViewProps> = ({ departments }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const filteredDepts = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hospital Departments & Wings</h1>
          <p className="text-xs text-slate-500">Configure operational medical departments, codes, and doctor allocations.</p>
        </div>

        <button
          onClick={() => {
            setNotification('Add Department form trigger (Admin Feature).');
            setTimeout(() => setNotification(null), 3000);
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Department</span>
        </button>
      </div>

      {notification && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)}>
            <X className="w-4 h-4 text-blue-600" />
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDepts.map((dept) => (
          <div
            key={dept.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 hover:border-blue-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {dept.code}
                </span>
              </div>

              <h3 className="font-bold text-base text-slate-900">{dept.name}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{dept.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">
                Allocated Specialists: <strong className="text-slate-900">{dept.doctorCount}</strong>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                Operational
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
