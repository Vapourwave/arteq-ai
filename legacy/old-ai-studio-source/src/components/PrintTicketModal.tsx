import React, { useState } from 'react';
import { PatientRecord, HospitalInfo } from '../types';
import { Printer, X, Check, FileText, CheckCircle2 } from 'lucide-react';

interface PrintTicketModalProps {
  patientRecord: PatientRecord;
  hospitalInfo: HospitalInfo;
  onClose: () => void;
  onConfirmPrint: () => void;
}

export const PrintTicketModal: React.FC<PrintTicketModalProps> = ({
  patientRecord,
  hospitalInfo,
  onClose,
  onConfirmPrint,
}) => {
  const [copies, setCopies] = useState<number>(1);
  const [paperFormat, setPaperFormat] = useState<'thermal' | 'a5' | 'a4'>('thermal');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const handlePrintClick = () => {
    setIsPrinting(true);
    setTimeout(() => {
      setIsPrinting(false);
      try {
        window.print();
      } catch (e) {
        // ignore
      }
      onConfirmPrint();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Print OP Ticket</h3>
              <p className="text-xs text-slate-500">Reception Desk Printer Spooler</p>
            </div>
          </div>
          <button
            type="button"
            id="close-print-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          {/* Selected Printer Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">TARGET PRINTER</span>
              <span className="font-bold text-slate-800 text-sm">{hospitalInfo.printerName}</span>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ready
            </span>
          </div>

          {/* Paper Format Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Ticket Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'thermal', label: '80mm Thermal', desc: 'Receipt Roll' },
                { id: 'a5', label: 'A5 Slip', desc: 'Half Page' },
                { id: 'a4', label: 'A4 Sheet', desc: 'Full Record' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  id={`paper-format-btn-${fmt.id}`}
                  onClick={() => setPaperFormat(fmt.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paperFormat === fmt.id
                      ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20 text-blue-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-xs block">{fmt.label}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{fmt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Number of Copies */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-bold text-slate-800">Number of Copies:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="copies-minus-btn"
                onClick={() => setCopies(Math.max(1, copies - 1))}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center"
              >
                -
              </button>
              <span className="w-8 text-center font-bold text-slate-900 text-sm">{copies}</span>
              <button
                type="button"
                id="copies-plus-btn"
                onClick={() => setCopies(copies + 1)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            id="cancel-print-btn"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            type="button"
            id="confirm-spool-print-btn"
            onClick={handlePrintClick}
            disabled={isPrinting}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center gap-2"
          >
            {isPrinting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Printing...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                <span>Send to Printer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
