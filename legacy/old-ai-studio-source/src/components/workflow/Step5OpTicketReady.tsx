import React, { useState } from 'react';
import { PatientRecord, HospitalInfo } from '../../types';
import { PrintTicketModal } from '../PrintTicketModal';
import { 
  CheckCircle2, 
  Printer, 
  UserPlus, 
  List, 
  Building2, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Sparkles,
  Ticket
} from 'lucide-react';

interface Step5OpTicketReadyProps {
  patientRecord: PatientRecord;
  hospitalInfo: HospitalInfo;
  onNewPatient: () => void;
  onViewQueue: () => void;
}

export const Step5OpTicketReady: React.FC<Step5OpTicketReadyProps> = ({
  patientRecord,
  hospitalInfo,
  onNewPatient,
  onViewQueue,
}) => {
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printedToast, setPrintedToast] = useState<boolean>(false);

  const handlePrint = () => {
    setShowPrintModal(true);
  };

  const handleSimulatedPrintComplete = () => {
    setShowPrintModal(false);
    setPrintedToast(true);
    setTimeout(() => setPrintedToast(false), 4000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Toast Notification */}
      {printedToast && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <Printer className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-xs font-bold text-slate-100">Ticket Sent to Printer</p>
            <p className="text-[11px] text-slate-400">{hospitalInfo.printerName}</p>
          </div>
        </div>
      )}

      {/* Top Success Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md ring-8 ring-emerald-50">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          OP Ticket Ready!
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Patient token <span className="font-extrabold text-slate-900">{patientRecord.tokenNumber}</span> has been issued successfully.
        </p>
      </div>

      {/* Realistic Printable Ticket Card */}
      <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden font-mono text-slate-800 max-w-lg mx-auto">
        {/* Ticket Header */}
        <div className="text-center border-b-2 border-dashed border-slate-300 pb-5 space-y-1">
          <div className="inline-flex items-center gap-1.5 font-bold text-lg text-slate-900 tracking-wider">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>{hospitalInfo.name.toUpperCase()}</span>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            --- OP TICKET ---
          </p>
          <p className="text-[11px] text-slate-400 font-sans">{hospitalInfo.address}</p>
        </div>

        {/* Large Token Callout */}
        <div className="my-6 text-center bg-slate-50 rounded-2xl p-4 border border-slate-200">
          <span className="text-xs text-slate-400 uppercase font-sans font-bold tracking-widest block">YOUR TOKEN NUMBER</span>
          <span className="text-5xl font-black text-blue-800 font-mono tracking-tight block my-1">
            {patientRecord.tokenNumber}
          </span>
          <span className="text-xs text-emerald-700 bg-emerald-100/80 px-3 py-0.5 rounded-full font-sans font-bold inline-block">
            Status: {patientRecord.status}
          </span>
        </div>

        {/* Ticket Fields Grid */}
        <div className="space-y-3 text-xs border-y-2 border-dashed border-slate-300 py-5 font-sans">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Patient Name:</span>
            <span className="font-extrabold text-slate-900 text-sm">{patientRecord.patientName}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Age / Gender:</span>
            <span className="font-bold text-slate-800">{patientRecord.age} Yrs / {patientRecord.gender}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">OP Number:</span>
            <span className="font-mono font-bold text-blue-700">{patientRecord.opNumber}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Department:</span>
            <span className="font-bold text-slate-900">{patientRecord.department}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Consulting Doctor:</span>
            <span className="font-bold text-slate-900">{patientRecord.doctorName} ({patientRecord.doctorRoom})</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Date & Time:</span>
            <span className="font-bold text-slate-800">{patientRecord.date} | {patientRecord.registeredTime}</span>
          </div>
        </div>

        {/* Ticket Footer instructions */}
        <div className="pt-4 text-center space-y-1 font-sans">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Please wait for your token to be called
          </p>
          <p className="text-[11px] text-slate-400">
            Keep this ticket with you during consultation • Thank you & Get Well Soon
          </p>
        </div>

        {/* Bottom Barcode Decorative */}
        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-center gap-1 opacity-70">
          <div className="h-8 w-1 bg-slate-900"></div>
          <div className="h-8 w-2 bg-slate-900"></div>
          <div className="h-8 w-0.5 bg-slate-900"></div>
          <div className="h-8 w-3 bg-slate-900"></div>
          <div className="h-8 w-1.5 bg-slate-900"></div>
          <div className="h-8 w-2 bg-slate-900"></div>
          <div className="h-8 w-1 bg-slate-900"></div>
          <div className="h-8 w-3 bg-slate-900"></div>
          <div className="h-8 w-0.5 bg-slate-900"></div>
          <div className="h-8 w-2 bg-slate-900"></div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 max-w-md mx-auto">
        <button
          type="button"
          id="print-op-ticket-btn"
          onClick={handlePrint}
          className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Printer className="w-5 h-5" />
          <span>🖨️ Print OP Ticket</span>
        </button>

        <button
          type="button"
          id="ticket-new-patient-btn"
          onClick={onNewPatient}
          className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-300 flex items-center justify-center gap-2 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ New Patient</span>
        </button>

        <button
          type="button"
          id="ticket-view-queue-btn"
          onClick={onViewQueue}
          className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-300 flex items-center justify-center gap-2 transition-colors"
        >
          <List className="w-4 h-4" />
          <span>View Queue</span>
        </button>
      </div>

      {/* Print Preview Modal */}
      {showPrintModal && (
        <PrintTicketModal
          patientRecord={patientRecord}
          hospitalInfo={hospitalInfo}
          onClose={() => setShowPrintModal(false)}
          onConfirmPrint={handleSimulatedPrintComplete}
        />
      )}
    </div>
  );
};
