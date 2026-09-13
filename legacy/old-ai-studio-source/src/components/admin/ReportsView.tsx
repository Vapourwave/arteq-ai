import React from 'react';
import { BarChart3, TrendingUp, Clock, Users, Ticket, Download, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { PatientRecord } from '../../types';

interface ReportsViewProps {
  queue: PatientRecord[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ queue }) => {
  const total = queue.length;
  const waiting = queue.filter((p) => p.status === 'Waiting').length;
  const consulting = queue.filter((p) => p.status === 'Consulting').length;
  const completed = queue.filter((p) => p.status === 'Completed').length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hospital Analytics & Operational Reports</h1>
          <p className="text-xs text-slate-500">Live operational metrics, peak registration trends, and department performance.</p>
        </div>

        <button className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-xs">
          <Download className="w-4 h-4" />
          <span>Export Daily Report (PDF)</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Total Tokens Registered</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{total}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +14% vs yesterday
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Avg. Waiting Duration</p>
          <p className="text-3xl font-black text-slate-900 mt-2">12.5m</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Optimal front-desk flow</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Consultation Rate</p>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {total > 0 ? Math.round((completed / total) * 100) : 0}%
          </p>
          <p className="text-xs text-blue-600 font-medium mt-1">{completed} completed sessions</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Peak Front Desk Hour</p>
          <p className="text-3xl font-black text-slate-900 mt-2">10 AM</p>
          <p className="text-xs text-amber-600 font-medium mt-1">18 tokens issued</p>
        </div>
      </div>

      {/* Visual Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            Token Status Breakdown
          </h2>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1 font-semibold text-slate-700">
                <span>Waiting ({waiting})</span>
                <span>{total > 0 ? Math.round((waiting / total) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (waiting / total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1 font-semibold text-slate-700">
                <span>In Consultation ({consulting})</span>
                <span>{total > 0 ? Math.round((consulting / total) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (consulting / total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1 font-semibold text-slate-700">
                <span>Completed ({completed})</span>
                <span>{total > 0 ? Math.round((completed / total) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            Front Desk Efficiency Insights
          </h2>

          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <strong className="text-slate-900 block font-semibold mb-0.5">Average Registration Time:</strong>
              Average registration workflow completed in under 45 seconds per patient using quick voice simulation tags.
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <strong className="text-slate-900 block font-semibold mb-0.5">Specialist Distribution:</strong>
              Dentistry and Cardiology accounted for 65% of today's morning OP visits.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
