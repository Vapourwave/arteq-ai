import React, { useState, useEffect, useRef } from 'react';
import { 
  Patient, 
  Doctor, 
  Department, 
  PatientRecord, 
  PatientGender,
  AIRoutingRecommendation 
} from '../../types';
import { 
  MOCK_DEPARTMENTS, 
  MOCK_DOCTORS, 
  INITIAL_HOSPITAL_INFO 
} from '../../data/mockData';
import { 
  getPatients, 
  getPatientById, 
  findDuplicateByPhone, 
  saveNewPatient 
} from '../../services/patientStore';
import { 
  createOpVisit, 
  generateNextTokenNumber, 
  generateOpNumber, 
  calculateQueuePosition, 
  getFormattedDisplayDate 
} from '../../services/tokenService';
import { analyzeServiceRequest } from '../../services/aiRoutingService';
import { 
  refineTranscript, 
  checkTranscriptQuality, 
  TranscriptQualityResult 
} from '../../services/transcriptRefinementService';
import { GeminiLiveVoiceService } from '../../services/geminiLiveVoiceService';
import { PrintTicketModal } from '../PrintTicketModal';
import { KioskLiveTranscript } from './KioskLiveTranscript';

import { 
  Building2, 
  Globe, 
  Mic, 
  Square, 
  Keyboard, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  UserCheck, 
  UserPlus, 
  Search, 
  Phone, 
  ArrowRight, 
  ArrowLeft, 
  Printer, 
  HelpCircle, 
  RotateCcw, 
  Stethoscope, 
  Clock, 
  ShieldCheck, 
  X,
  FileText,
  User,
  HeartPulse
} from 'lucide-react';

interface PatientKioskWorkflowProps {
  queue: PatientRecord[];
  doctors?: Doctor[];
  departments?: Department[];
  onVisitCreated: (record: PatientRecord) => void;
  onExitKiosk: () => void;
}

type KioskStep = 
  | 'welcome'
  | 'patient-type'
  | 'lookup-patient'
  | 'new-patient'
  | 'request-input'
  | 'review-request'
  | 'routing-recommendation'
  | 'confirm-visit'
  | 'ticket-ready';

type LanguageMode = 'en' | 'ml';

export const PatientKioskWorkflow: React.FC<PatientKioskWorkflowProps> = ({
  queue = [],
  doctors = MOCK_DOCTORS,
  departments = MOCK_DEPARTMENTS,
  onVisitCreated,
  onExitKiosk,
}) => {
  // --- KIOSK STATE ---
  const [lang, setLang] = useState<LanguageMode>('en');
  const [step, setStep] = useState<KioskStep>('welcome');

  // Active Patient Record
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Patient Lookup Form State
  const [lookupQuery, setLookupQuery] = useState<string>('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  // New Patient Form State
  const [newPatientName, setNewPatientName] = useState<string>('');
  const [newPatientAge, setNewPatientAge] = useState<string>('');
  const [newPatientGender, setNewPatientGender] = useState<PatientGender>('Male');
  const [newPatientPhone, setNewPatientPhone] = useState<string>('');
  const [newPatientPriority, setNewPatientPriority] = useState<'Normal' | 'Senior Citizen'>('Normal');
  const [formError, setFormError] = useState<string | null>(null);

  // Service Request & Voice Capture
  const [rawText, setRawText] = useState<string>('');
  const [cleanText, setCleanText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // Quality Guard State
  const [qualityCheck, setQualityCheck] = useState<TranscriptQualityResult | null>(null);
  const [isCheckingQuality, setIsCheckingQuality] = useState<boolean>(false);

  // AI Routing State
  const [isRouting, setIsRouting] = useState<boolean>(false);
  const [aiRecommendation, setAiRecommendation] = useState<AIRoutingRecommendation | null>(null);
  const [routingError, setRoutingError] = useState<string | null>(null);

  // Department & Doctor Selection
  const [selectedDeptId, setSelectedDeptId] = useState<string>('dept-dentistry');
  const [selectedDeptName, setSelectedDeptName] = useState<string>('Dentistry');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isManualDeptPickerOpen, setIsManualDeptPickerOpen] = useState<boolean>(false);

  // Ticket Result
  const [generatedTicket, setGeneratedTicket] = useState<PatientRecord | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Receptionist Help Modal & Staff Exit PIN Modal
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [exitPin, setExitPin] = useState<string>('');
  const [exitPinError, setExitPinError] = useState<boolean>(false);

  // Inactivity Timeout (90s inactivity -> 15s warning modal -> reset)
  const [showInactivityWarning, setShowInactivityWarning] = useState<boolean>(false);
  const [inactivityCountdown, setInactivityCountdown] = useState<number>(15);
  const lastActivityRef = useRef<number>(Date.now());

  // Gemini Live Voice Service Instance and Transcription Buffer
  const voiceServiceRef = useRef<GeminiLiveVoiceService | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const isListeningRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup voice service on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      isStoppingRef.current = false;
      if (voiceServiceRef.current) {
        voiceServiceRef.current.stop();
      }
    };
  }, []);

  // --- INACTIVITY WATCHDOG FOR KIOSK PRIVACY & RESET ---
  useEffect(() => {
    const handleUserInteraction = () => {
      lastActivityRef.current = Date.now();
      if (showInactivityWarning) {
        setShowInactivityWarning(false);
        setInactivityCountdown(15);
      }
    };

    window.addEventListener('touchstart', handleUserInteraction);
    window.addEventListener('mousedown', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);

    const interval = setInterval(() => {
      // Skip watchdog on welcome screen or when finished
      if (step === 'welcome' || step === 'ticket-ready') return;

      const idleSeconds = Math.floor((Date.now() - lastActivityRef.current) / 1000);

      if (idleSeconds >= 75 && !showInactivityWarning) {
        setShowInactivityWarning(true);
        setInactivityCountdown(15);
      }
    }, 1000);

    return () => {
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      clearInterval(interval);
    };
  }, [step, showInactivityWarning]);

  // Countdown timer when warning modal is displayed
  useEffect(() => {
    if (!showInactivityWarning) return;

    if (inactivityCountdown <= 0) {
      handleFullSessionReset();
      return;
    }

    const timer = setTimeout(() => {
      setInactivityCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showInactivityWarning, inactivityCountdown]);



  // --- SESSION RESET & PRIVACY PURGE ---
  const handleFullSessionReset = () => {
    // Purge all temporary patient data from state
    setSelectedPatient(null);
    setLookupQuery('');
    setLookupError(null);
    setNewPatientName('');
    setNewPatientAge('');
    setNewPatientPhone('');
    setNewPatientGender('Male');
    setNewPatientPriority('Normal');
    setFormError(null);
    setRawText('');
    setCleanText('');
    setIsRecording(false);
    setIsRefining(false);
    setQualityCheck(null);
    setAiRecommendation(null);
    setRoutingError(null);
    setSelectedDoctor(null);
    setSelectedDeptId('dept-dentistry');
    setSelectedDeptName('Dentistry');
    setGeneratedTicket(null);
    setShowPrintModal(false);
    setShowHelpModal(false);
    setShowInactivityWarning(false);
    setShowExitModal(false);
    setStep('welcome');
    lastActivityRef.current = Date.now();
  };

  // --- PATIENT LOOKUP HANDLER ---
  const handleLookupSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLookupError(null);
    const q = lookupQuery.trim();

    if (!q) {
      setLookupError(lang === 'en' ? 'Please enter Patient ID or Phone Number' : 'ദയവായി പേഷ്യന്റ് ഐഡി അല്ലെങ്കിൽ ഫോൺ നമ്പർ നൽകുക');
      return;
    }

    // Try ID lookup
    let found = getPatientById(q);

    // Try Phone lookup
    if (!found) {
      found = findDuplicateByPhone(q);
    }

    if (found) {
      setSelectedPatient(found);
    } else {
      setLookupError(lang === 'en' ? "We couldn't find a record matching your input." : 'സൂചിപ്പിച്ച പേഷ്യന്റ് റെക്കോർഡ് കണ്ടെത്താനായില്ല.');
    }
  };

  // --- NEW PATIENT REGISTRATION HANDLER ---
  const handleRegisterPatient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!newPatientName.trim()) {
      setFormError(lang === 'en' ? 'Please enter your full name.' : 'ദയവായി നിങ്ങളുടെ പൂർണ്ണ പേര് നൽകുക.');
      return;
    }

    const ageNum = parseInt(newPatientAge, 10);
    if (isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
      setFormError(lang === 'en' ? 'Please enter a valid age.' : 'ദയവായി സാധുവായ വയസ്സ് നൽകുക.');
      return;
    }

    if (!newPatientPhone || newPatientPhone.replace(/\D/g, '').length < 10) {
      setFormError(lang === 'en' ? 'Please enter a valid 10-digit phone number.' : 'ദയവായി 10 അക്ക ഫോൺ നമ്പർ നൽകുക.');
      return;
    }

    const created = saveNewPatient({
      patientName: newPatientName,
      age: ageNum,
      gender: newPatientGender,
      phone: newPatientPhone,
      priority: newPatientPriority,
    });

    setSelectedPatient(created);
    setStep('request-input');
  };

  // --- VOICE CAPTURE TOGGLE ---
  const handleToggleVoiceRecording = async () => {
    if (isStoppingRef.current) return;

    if (isListeningRef.current || isRecording) {
      isStoppingRef.current = true;
      setIsRecording(false);

      // Controlled finalization: allow in-flight audio & WS transcription messages ~350ms to settle
      await new Promise((resolve) => setTimeout(resolve, 350));

      const captured = (finalTranscriptRef.current || rawText).trim();

      if (voiceServiceRef.current) {
        voiceServiceRef.current.stop();
        voiceServiceRef.current = null;
      }
      isListeningRef.current = false;
      isStoppingRef.current = false;

      if (captured) {
        setRawText(captured);
        handleProcessVoiceInput(captured);
      } else {
        setRecordingError(
          lang === 'en'
            ? 'No speech detected. Please speak clearly or type your request below.'
            : 'സംസാരം കണ്ടെത്താനായില്ല. ദയവായി വ്യക്തമായി സംസാരിക്കുക അല്ലെങ്കിൽ താഴെ ടൈപ്പ് ചെയ്യുക.'
        );
      }
    } else {
      isListeningRef.current = true;
      isStoppingRef.current = false;
      setRecordingError(null);
      finalTranscriptRef.current = '';
      setRawText('');
      setCleanText('');
      setQualityCheck(null);
      setIsRecording(true);

      try {
        voiceServiceRef.current = new GeminiLiveVoiceService({
          onTranscription: (text) => {
            finalTranscriptRef.current += text;
            // setRawText is intentionally omitted during recording to eliminate
            // high-frequency main-thread React re-renders that cause audio buffer starvation.
          },
          onError: (err) => {
            setRecordingError(err);
            isListeningRef.current = false;
            setIsRecording(false);
          },
          onClose: () => {
            isListeningRef.current = false;
            setIsRecording(false);
          },
        });
        await voiceServiceRef.current.start();
      } catch (err: any) {
        isListeningRef.current = false;
        setIsRecording(false);
        setRecordingError(
          lang === 'en'
            ? 'Microphone error. Please type your request below.'
            : 'മൈക്രോഫോൺ തകരാറ്. ദയവായി താഴെ ടൈപ്പ് ചെയ്യുക.'
        );
      }
    }
  };

  // --- TRANSCRIPT REFINEMENT & QUALITY GUARD ---
  const handleProcessVoiceInput = async (overrideText?: string) => {
    const textToProcess = (overrideText || rawText || finalTranscriptRef.current).trim();
    if (!textToProcess) return;

    setIsRefining(true);
    setIsCheckingQuality(true);
    setRecordingError(null);

    try {
      // 1. Clean & refine transcript via shared refineTranscript() API
      let cleanStr = textToProcess;
      try {
        const refinedResult = await refineTranscript(textToProcess);
        cleanStr = typeof refinedResult === 'string'
          ? refinedResult
          : (refinedResult.cleanTranscript || textToProcess);
      } catch (err) {
        console.warn('Transcript refinement fallback:', err);
        cleanStr = textToProcess;
      }

      setCleanText(cleanStr);

      // 2. Evaluate quality guard via shared checkTranscriptQuality() API
      try {
        const qResult = await checkTranscriptQuality(textToProcess, cleanStr);
        setQualityCheck(qResult);
      } catch (err) {
        console.warn('Quality check fallback:', err);
        setQualityCheck({
          qualityStatus: 'CLEAR',
          qualityScore: 0.9,
          issues: [],
          requiresReview: false,
          reviewReason: 'Transcript captured successfully.',
        });
      }

      setStep('review-request');
    } finally {
      setIsRefining(false);
      setIsCheckingQuality(false);
    }
  };

  // --- TRIGGER ROUTING ANALYSIS ---
  const handleProceedToRouting = async () => {
    const approvedRequest = cleanText.trim() || rawText.trim() || finalTranscriptRef.current.trim();
    if (!approvedRequest) return;

    setIsRouting(true);
    setRoutingError(null);

    try {
      // Call shared analyzeServiceRequest which posts to /api/route-patient with local fallback
      const { recommendation, isFallback, error } = await analyzeServiceRequest(approvedRequest, departments, doctors);
      setAiRecommendation(recommendation);

      if (error) {
        setRoutingError(error);
      }

      const recDeptName = recommendation.recommendedDepartmentName || 'General Medicine';
      const matchedDept = departments.find((d) => d.name.toLowerCase() === recDeptName.toLowerCase()) || departments[0];

      if (matchedDept) {
        setSelectedDeptId(matchedDept.id);
        setSelectedDeptName(matchedDept.name);
      }

      // Pre-select doctor: prefer doctor in recommendedDoctorIds
      const deptDocs = doctors.filter(
        (d) => d.department.toLowerCase() === (matchedDept ? matchedDept.name.toLowerCase() : 'dentistry') && d.status !== 'Off Duty'
      );

      if (deptDocs.length > 0) {
        const preferred = deptDocs.find((d) => recommendation.recommendedDoctorIds.includes(d.id));
        setSelectedDoctor(preferred || deptDocs[0]);
      } else {
        setSelectedDoctor(null);
      }

      setStep('routing-recommendation');
    } catch (err) {
      setRoutingError(lang === 'en' ? 'Automatic routing unavailable. Please select service manually.' : 'ഓട്ടോമാറ്റിക് റൂട്ടിംഗ് ലഭ്യമല്ല. വകുപ്പ് സ്വയം തിരഞ്ഞെടുക്കുക.');
      setStep('routing-recommendation');
    } finally {
      setIsRouting(false);
    }
  };

  // --- GENERATE TOKEN & COMPLETE VISIT ---
  const handleConfirmAndGenerateToken = () => {
    if (!selectedPatient || !selectedDoctor) return;

    const todayStr = getFormattedDisplayDate();

    const { record } = createOpVisit({
      patientId: selectedPatient.id,
      patientName: selectedPatient.patientName,
      age: selectedPatient.age,
      gender: selectedPatient.gender,
      phone: selectedPatient.phone,
      department: selectedDeptName,
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      doctorRoom: selectedDoctor.room,
      serviceRequest: cleanText || rawText || 'General Consultation',
      priority: selectedPatient.priority || 'Normal',
      dateStr: todayStr,
      existingQueue: queue,
      departmentsList: departments,
      visitSource: 'SELF_SERVICE',
    });

    setGeneratedTicket(record);
    onVisitCreated(record);
    setStep('ticket-ready');
  };

  // Staff Exit PIN verification (default PIN: 1234)
  const handleVerifyExitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (exitPin === '1234' || exitPin === '0000') {
      setShowExitModal(false);
      onExitKiosk();
    } else {
      setExitPinError(true);
    }
  };

  // Filter available doctors for selected department
  const filteredDoctors = doctors.filter(
    (d) => d.department.toLowerCase() === selectedDeptName.toLowerCase() && d.status !== 'Off Duty'
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none relative overflow-hidden">
      {/* Top Header Banner */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              {INITIAL_HOSPITAL_INFO.name}
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                PATIENT KIOSK
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Self-Service OP Token & Registration Terminal</p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3">
          {/* Language Toggle */}
          <div className="flex items-center p-1 bg-slate-800 rounded-xl border border-slate-700">
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                lang === 'en' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLang('ml')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                lang === 'ml' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              മലയാളം
            </button>
          </div>

          {/* Ask Receptionist Help */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 font-semibold text-xs flex items-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <HelpCircle className="w-4 h-4" />
            <span>{lang === 'en' ? 'Ask Receptionist' : 'സഹായം ചോദിക്കുക'}</span>
          </button>

          {/* Staff Exit Kiosk Button */}
          <button
            onClick={() => {
              setExitPin('');
              setExitPinError(false);
              setShowExitModal(true);
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Staff Exit Kiosk"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Kiosk Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10 max-w-5xl mx-auto w-full">
        {/* Step Indicator Bar (Steps 2..8) */}
        {step !== 'welcome' && step !== 'ticket-ready' && (
          <div className="w-full mb-8">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
              <span>{lang === 'en' ? 'SELF-SERVICE PROGRESS' : 'രജിസ്ട്രേഷൻ ഘട്ടങ്ങൾ'}</span>
              <span className="text-blue-400 font-bold">
                {step === 'patient-type' || step === 'lookup-patient' || step === 'new-patient' ? 'Step 1 of 4: Patient' : ''}
                {step === 'request-input' || step === 'review-request' ? 'Step 2 of 4: Service Request' : ''}
                {step === 'routing-recommendation' ? 'Step 3 of 4: Department & Doctor' : ''}
                {step === 'confirm-visit' ? 'Step 4 of 4: Final Confirmation' : ''}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 transition-all duration-500"
                style={{
                  width:
                    step === 'patient-type' || step === 'lookup-patient' || step === 'new-patient'
                      ? '25%'
                      : step === 'request-input' || step === 'review-request'
                      ? '50%'
                      : step === 'routing-recommendation'
                      ? '75%'
                      : step === 'confirm-visit'
                      ? '90%'
                      : '100%',
                }}
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 1: WELCOME SCREEN                                   */}
        {/* ========================================================= */}
        {step === 'welcome' && (
          <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-8 shadow-2xl relative overflow-hidden">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-2xl shadow-blue-500/25 border border-blue-400/30 animate-pulse">
              <HeartPulse className="w-12 h-12" />
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {lang === 'en' ? 'Welcome to ABC Hospital' : 'എബിസി ആശുപത്രിയിലേക്ക് സ്വാഗതം'}
              </h2>
              <p className="text-slate-300 text-base sm:text-lg font-medium leading-relaxed max-w-lg mx-auto">
                {lang === 'en'
                  ? 'Get your OP consultation ticket instantly without waiting in line at the front desk.'
                  : 'റിസപ്ഷൻ ഡെസ്കിൽ കാത്തുനിൽക്കാതെ നിങ്ങളുടെ ഒ.പി ടിക്കറ്റ് നേരിട്ട് ലഭിക്കും.'}
              </p>
            </div>

            <div className="pt-4 space-y-4">
              <button
                id="kiosk-start-btn"
                onClick={() => setStep('patient-type')}
                className="w-full py-5 px-8 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-black text-xl shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-3 transition-all transform active:scale-95 cursor-pointer"
              >
                <span>{lang === 'en' ? 'START OP REGISTRATION' : 'ഒ.പി രജിസ്ട്രേഷൻ ആരംഭിക്കുക'}</span>
                <ArrowRight className="w-6 h-6" />
              </button>

              <div className="flex items-center justify-center gap-6 text-xs text-slate-400 pt-2 font-medium">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  {lang === 'en' ? 'Touchscreen Friendly' : 'തൊട്ടറിയാം'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-blue-400" />
                  {lang === 'en' ? 'Malayalam & Voice Support' : 'ശബ്ദ സഹായം'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: NEW / EXISTING PATIENT SELECTION                 */}
        {/* ========================================================= */}
        {step === 'patient-type' && (
          <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 space-y-8 shadow-2xl">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {lang === 'en' ? 'Have you visited this hospital before?' : 'നിങ്ങൾ മുൻപ് ഈ ആശുപത്രി സന്ദർശിച്ചിട്ടുണ്ടോ?'}
              </h2>
              <p className="text-slate-400 text-sm font-medium">
                {lang === 'en' ? 'Choose an option to continue with registration' : 'തുടരാൻ അനുയോജ്യമായ ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                id="kiosk-existing-patient-btn"
                onClick={() => setStep('lookup-patient')}
                className="p-6 rounded-2xl bg-slate-800/90 border-2 border-slate-700 hover:border-emerald-500 hover:bg-slate-800 text-left transition-all group flex flex-col justify-between space-y-4 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {lang === 'en' ? "YES, I'M AN EXISTING PATIENT" : 'അതെ, ഞാൻ നിലവിലുള്ള രോഗിയാണ്'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === 'en' ? 'Lookup using Patient ID or Phone Number' : 'പേഷ്യന്റ് ഐഡി അല്ലെങ്കിൽ ഫോൺ നമ്പർ ഉപയോഗിക്കുക'}
                  </p>
                </div>
              </button>

              <button
                id="kiosk-new-patient-btn"
                onClick={() => setStep('new-patient')}
                className="p-6 rounded-2xl bg-slate-800/90 border-2 border-slate-700 hover:border-blue-500 hover:bg-slate-800 text-left transition-all group flex flex-col justify-between space-y-4 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                    {lang === 'en' ? "NO, I'M A NEW PATIENT" : 'ഇല്ല, ഞാൻ പുതിയ രോഗിയാണ്'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === 'en' ? 'Register yourself in 1 minute' : '1 മിനിറ്റിൽ പുതിയ അക്കൗണ്ട് സൃഷ്ടിക്കുക'}
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => setStep('welcome')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'en' ? 'Back' : 'തിരികെ'}</span>
              </button>

              <button
                onClick={() => setShowHelpModal(true)}
                className="text-xs text-amber-400 hover:underline font-medium"
              >
                {lang === 'en' ? 'Need Help?' : 'സഹായം വേണോ?'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3A: EXISTING PATIENT LOOKUP                         */}
        {/* ========================================================= */}
        {step === 'lookup-patient' && (
          <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 space-y-6 shadow-2xl">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">
                {lang === 'en' ? 'Existing Patient Lookup' : 'രോഗിയുടെ വിവരങ്ങൾ കണ്ടെത്തുക'}
              </h2>
              <p className="text-slate-400 text-xs font-medium">
                {lang === 'en' ? 'Enter your Patient ID (e.g. PAT-000001) or Registered Phone Number' : 'പേഷ്യന്റ് ഐഡിയോ രജിസ്റ്റർ ചെയ്ത ഫോൺ നമ്പറോ നൽകുക'}
              </p>
            </div>

            {!selectedPatient ? (
              <form onSubmit={handleLookupSubmit} className="space-y-5">
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-6 h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={lookupQuery}
                      onChange={(e) => setLookupQuery(e.target.value)}
                      placeholder={lang === 'en' ? 'Enter PAT-000001 or 9876543210...' : 'PAT-000001 അല്ലെങ്കിൽ ഫോൺ നമ്പർ...'}
                      className="w-full py-4 pl-14 pr-4 rounded-2xl bg-slate-950 border-2 border-slate-700 focus:border-blue-500 text-white font-mono text-lg outline-none transition-all placeholder:text-slate-600"
                      autoFocus
                    />
                  </div>

                  {lookupError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{lookupError}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className="w-5 h-5" />
                  <span>{lang === 'en' ? 'Search Record' : 'തിരയുക'}</span>
                </button>
              </form>
            ) : (
              /* MATCHED PATIENT DISPLAY CARD */
              <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-2xl p-6 space-y-4 animate-in fade-in">
                <div className="flex items-center gap-3 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-bold text-sm tracking-wide uppercase">
                    {lang === 'en' ? 'Patient Record Found' : 'രോഗിയുടെ റെക്കോർഡ് കണ്ടെത്തി'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-slate-200 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold">{lang === 'en' ? 'Patient Name' : 'പേര്'}</p>
                    <p className="font-black text-lg text-white">{selectedPatient.patientName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold">{lang === 'en' ? 'Patient ID' : 'ഐഡി'}</p>
                    <p className="font-mono font-bold text-blue-400">{selectedPatient.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold">{lang === 'en' ? 'Age / Gender' : 'വയസ്സ് / ലിംഗം'}</p>
                    <p className="font-semibold">{selectedPatient.age} Yrs • {selectedPatient.gender}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold">{lang === 'en' ? 'Phone' : 'ഫോൺ'}</p>
                    <p className="font-mono text-slate-300">
                      {selectedPatient.phone.length >= 10
                        ? `${selectedPatient.phone.slice(0, 3)}****${selectedPatient.phone.slice(-3)}`
                        : selectedPatient.phone}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    {lang === 'en' ? 'Not You? Search Again' : 'മറ്റൊരാളാണോ? വീണ്ടും തിരയുക'}
                  </button>
                  <button
                    onClick={() => setStep('request-input')}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <span>{lang === 'en' ? 'Continue' : 'തുടരുക'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <button
                onClick={() => {
                  setSelectedPatient(null);
                  setStep('patient-type');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'en' ? 'Back' : 'തിരികെ'}</span>
              </button>

              <button
                onClick={() => setStep('new-patient')}
                className="text-xs font-bold text-blue-400 hover:underline"
              >
                {lang === 'en' ? 'Register as New Patient →' : 'പുതിയ രോഗിയായി രജിസ്റ്റർ ചെയ്യുക →'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3B: NEW PATIENT REGISTRATION                        */}
        {/* ========================================================= */}
        {step === 'new-patient' && (
          <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 space-y-6 shadow-2xl">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">
                {lang === 'en' ? 'New Patient Registration' : 'പുതിയ രോഗി രജിസ്ട്രേഷൻ'}
              </h2>
              <p className="text-slate-400 text-xs font-medium">
                {lang === 'en' ? 'Please fill in your details to create your hospital patient profile' : 'പ്രൊഫൈൽ സൃഷ്ടിക്കാൻ നിങ്ങളുടെ വിവരങ്ങൾ നൽകുക'}
              </p>
            </div>

            <form onSubmit={handleRegisterPatient} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  {lang === 'en' ? 'Full Name *' : 'പൂർണ്ണ പേര് *'}
                </label>
                <input
                  type="text"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="e.g. Rahul Kumar"
                  className="w-full py-3 px-4 rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 text-white font-semibold outline-none"
                  required
                />
              </div>

              {/* Age & Gender Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    {lang === 'en' ? 'Age (Years) *' : 'വയസ്സ് *'}
                  </label>
                  <input
                    type="number"
                    value={newPatientAge}
                    onChange={(e) => setNewPatientAge(e.target.value)}
                    placeholder="e.g. 32"
                    min="1"
                    max="120"
                    className="w-full py-3 px-4 rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 text-white font-semibold outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    {lang === 'en' ? 'Gender *' : 'ലിംഗം *'}
                  </label>
                  <select
                    value={newPatientGender}
                    onChange={(e) => setNewPatientGender(e.target.value as PatientGender)}
                    className="w-full py-3 px-4 rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 text-white font-semibold outline-none"
                  >
                    <option value="Male">Male / പുരുഷൻ</option>
                    <option value="Female">Female / സ്ത്രീ</option>
                    <option value="Other">Other / മറ്റുള്ളവ</option>
                  </select>
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  {lang === 'en' ? 'Mobile Phone Number *' : 'ഫോൺ നമ്പർ *'}
                </label>
                <input
                  type="tel"
                  value={newPatientPhone}
                  onChange={(e) => setNewPatientPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full py-3 px-4 rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 text-white font-semibold outline-none font-mono"
                  required
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  {lang === 'en' ? 'Category / Priority' : 'മുൻഗണന'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewPatientPriority('Normal')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      newPatientPriority === 'Normal'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang === 'en' ? 'Normal Visit' : 'സാധാരണ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPatientPriority('Senior Citizen')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      newPatientPriority === 'Senior Citizen'
                        ? 'bg-amber-600 border-amber-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang === 'en' ? 'Senior Citizen (60+)' : 'മുതിർന്ന പൗരന്മാർ (60+)'}
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep('patient-type')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Back' : 'തിരികെ'}</span>
                </button>

                <button
                  type="submit"
                  className="py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                >
                  <span>{lang === 'en' ? 'Save & Continue' : 'സേവ് ചെയ്ത് തുടരുക'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4: PATIENT SERVICE REQUEST (VOICE / TEXT)           */}
        {/* ========================================================= */}
        {step === 'request-input' && selectedPatient && (
          <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <p className="text-xs text-blue-400 font-bold uppercase tracking-wider">
                  {lang === 'en' ? 'Selected Patient' : 'തിരഞ്ഞെടുത്ത രോഗി'}
                </p>
                <p className="text-lg font-black text-white">{selectedPatient.patientName}</p>
              </div>
              <span className="font-mono text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-lg">
                {selectedPatient.id}
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">
                {lang === 'en' ? 'What can we help you with today?' : 'നിങ്ങൾക്ക് ഇന്ന് എന്താണ് ആവശ്യം?'}
              </h2>
              <p className="text-slate-400 text-xs font-medium">
                {lang === 'en' ? 'Tap the microphone to speak, or type your medical request below' : 'സംസാരിക്കാൻ മൈക്രോഫോൺ ടാപ്പ് ചെയ്യുക, അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക'}
              </p>
            </div>

            {/* Voice Input Section */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
              <button
                type="button"
                onClick={handleToggleVoiceRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all transform active:scale-95 shadow-xl cursor-pointer ${
                  isRecording
                    ? 'bg-red-600 text-white animate-pulse shadow-red-600/40'
                    : 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white hover:scale-105 shadow-blue-600/30'
                }`}
              >
                {isRecording ? <Square className="w-8 h-8" /> : <Mic className="w-9 h-9" />}
              </button>

              <div className="space-y-1">
                <p className="font-bold text-sm text-white">
                  {isRecording
                    ? lang === 'en' ? 'Listening... Tap to stop' : 'കേൾക്കുന്നു... നിർത്താൻ ടാപ്പ് ചെയ്യുക'
                    : lang === 'en' ? 'Tap to Speak (Malayalam / Manglish / English)' : 'സംസാരിക്കാൻ ടാപ്പ് ചെയ്യുക'}
                </p>
                <KioskLiveTranscript
                  isRecording={isRecording}
                  finalTranscriptRef={finalTranscriptRef}
                  lang={lang}
                />
              </div>

              {recordingError && (
                <p className="text-xs text-red-400 font-semibold">{recordingError}</p>
              )}
            </div>

            {/* Text Area Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-blue-400" />
                <span>{lang === 'en' ? 'Or Type Your Request' : 'അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക'}</span>
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={
                  lang === 'en'
                    ? 'e.g. "I have severe tooth pain and want to see a dentist." or "Enikku tooth pain aanu"'
                    : 'ഉദാ: "എനിക്ക് പല്ലുവേദനയാണ്, ഡോക്ടറെ കാണണം."'
                }
                rows={3}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-700 focus:border-blue-500 text-white text-sm font-medium outline-none resize-none placeholder:text-slate-600"
              />
            </div>

            {/* Example Request Chips */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-500 uppercase">{lang === 'en' ? 'Quick Examples:' : 'ഉദാഹരണങ്ങൾ:'}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRawText('Enikku tooth pain aanu, dentistine kaananam.')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
                >
                  "Enikku tooth pain aanu"
                </button>
                <button
                  type="button"
                  onClick={() => setRawText('എനിക്ക് പല്ലുവേദനയാണ്, ഡോക്ടറെ കാണണം.')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
                >
                  "എനിക്ക് പല്ലുവേദനയാണ്"
                </button>
                <button
                  type="button"
                  onClick={() => setRawText('I have severe fever and body ache since morning.')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
                >
                  "Fever and body ache"
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep('lookup-patient')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'en' ? 'Back' : 'തിരികെ'}</span>
              </button>

              <button
                type="button"
                disabled={!rawText.trim() || isRefining}
                onClick={handleProcessVoiceInput}
                className="py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
              >
                {isRefining ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{lang === 'en' ? 'Processing...' : 'പ്രോസസ്സ് ചെയ്യുന്നു...'}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === 'en' ? 'Review Request' : 'അവലോകനം ചെയ്യുക'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 5: PATIENT REVIEW & QUALITY GUARD                   */}
        {/* ========================================================= */}
        {step === 'review-request' && (
          <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 space-y-6 shadow-2xl">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">
                {lang === 'en' ? 'We Understood Your Request' : 'ഞങ്ങൾ മനസ്സിലാക്കിയത്'}
              </h2>
              <p className="text-slate-400 text-xs font-medium">
                {lang === 'en' ? 'Please review or edit your request before AI routing' : 'തുടരുന്നതിന് മുൻപ് നിങ്ങളുടെ വിവരങ്ങൾ ശരിയാണെന്ന് ഉറപ്പുവരുത്തുക'}
              </p>
            </div>

            {/* Refined Text Editor */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-blue-400">
                {lang === 'en' ? 'Approved Request Text' : 'അംഗീകരിച്ച വിവരണം'}
              </label>
              <textarea
                value={cleanText}
                onChange={(e) => setCleanText(e.target.value)}
                rows={3}
                className="w-full p-4 rounded-2xl bg-slate-950 border-2 border-blue-500/50 focus:border-blue-400 text-white font-semibold text-base outline-none resize-none"
              />
            </div>

            {/* Quality Guard Status Card */}
            {qualityCheck && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  qualityCheck.qualityStatus === 'CLEAR'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : qualityCheck.qualityStatus === 'REVIEW'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {qualityCheck.qualityStatus === 'CLEAR' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  {qualityCheck.qualityStatus === 'REVIEW' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                  {qualityCheck.qualityStatus === 'INSUFFICIENT' && <XCircle className="w-5 h-5 text-red-400" />}
                  <span>
                    {qualityCheck.qualityStatus === 'CLEAR' && (lang === 'en' ? '🟢 Transcript looks clear' : '🟢 വിവരങ്ങൾ വ്യക്തമാണ്')}
                    {qualityCheck.qualityStatus === 'REVIEW' && (lang === 'en' ? '🟠 Please review this transcript' : '🟠 വിവരങ്ങൾ തിരുത്തുക')}
                    {qualityCheck.qualityStatus === 'INSUFFICIENT' && (lang === 'en' ? '🔴 More information may be needed' : '🔴 കൂടുതൽ വിവരങ്ങൾ നൽകുക')}
                  </span>
                </div>
                <p className="leading-relaxed opacity-90">{qualityCheck.reviewReason}</p>
              </div>
            )}

            <div className="pt-2 flex flex-wrap gap-3 items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('request-input')}
                className="px-4 py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>{lang === 'en' ? 'Speak Again' : 'വീണ്ടും പറയുക'}</span>
              </button>

              <button
                type="button"
                disabled={!cleanText.trim() || isRouting}
                onClick={handleProceedToRouting}
                className="py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
              >
                {isRouting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{lang === 'en' ? 'Routing to AI...' : 'റൂട്ട് ചെയ്യുന്നു...'}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === 'en' ? 'Find Service & Doctor' : 'വകുപ്പ് കണ്ടെത്തുക'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 6: AI ROUTING RECOMMENDATION                        */}
        {/* ========================================================= */}
        {step === 'routing-recommendation' && (
          <div className="w-full max-w-3xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 space-y-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    {lang === 'en' ? 'AI Recommended Service' : 'എ.ഐ ശുപാർശ ചെയ്ത വകുപ്പ്'}
                  </span>
                  {aiRecommendation && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        aiRecommendation.confidenceLabel === 'High'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : aiRecommendation.confidenceLabel === 'Moderate'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {aiRecommendation.confidenceLabel} Confidence
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-black text-white mt-1">
                  {selectedDeptName}
                </h2>
              </div>
              <button
                onClick={() => setIsManualDeptPickerOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {lang === 'en' ? 'All Services Modal' : 'എല്ലാ വകുപ്പുകളും'}
              </button>
            </div>

            {/* Quick Department Selector Tabs */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {lang === 'en' ? 'Select Hospital Department:' : 'വകുപ്പ് മാറ്റുക:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => {
                  const isSelected = selectedDeptName.toLowerCase() === dept.name.toLowerCase();
                  const isAiRecommended = aiRecommendation?.recommendedDepartmentName?.toLowerCase() === dept.name.toLowerCase();

                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => {
                        setSelectedDeptId(dept.id);
                        setSelectedDeptName(dept.name);
                        const docList = doctors.filter(
                          (d) => d.department.toLowerCase() === dept.name.toLowerCase() && d.status !== 'Off Duty'
                        );
                        setSelectedDoctor(docList.length > 0 ? docList[0] : null);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <span>{dept.name}</span>
                      {isAiRecommended && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="AI Primary Recommendation" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Recommendation Reason or Clarification Banner */}
            {aiRecommendation && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">{lang === 'en' ? 'AI Routing Guidance' : 'കാരണം'}</p>
                  <span className="text-[10px] text-slate-500 font-mono">POST /api/route-patient</span>
                </div>
                <p className="text-xs text-slate-200 font-medium leading-relaxed">{aiRecommendation.reason}</p>
                {aiRecommendation.needsClarification && aiRecommendation.clarificationQuestion && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-semibold flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{aiRecommendation.clarificationQuestion}</span>
                  </div>
                )}
              </div>
            )}

            {/* Doctor Selection List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {lang === 'en' ? 'Available Doctors' : 'ലഭ്യമായ ഡോക്ടർമാർ'}
                </h3>
                <span className="text-xs text-slate-400 font-semibold">
                  {filteredDoctors.length} {lang === 'en' ? 'Doctors Available' : 'ഡോക്ടർമാർ'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                {filteredDoctors.map((doc) => {
                  const isSelected = selectedDoctor?.id === doc.id;
                  const isAiSuggested = aiRecommendation?.recommendedDoctorIds?.includes(doc.id);

                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoctor(doc)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/10'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-base text-white">{doc.name}</h4>
                            {isAiSuggested && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black tracking-wider uppercase border border-amber-500/30 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                AI Suggested
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-medium">{doc.specialty}</p>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-bold">
                          {doc.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                        <span>Room: <strong className="text-slate-200">{doc.room}</strong></span>
                        <span>{doc.experienceYears} Yrs Exp</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep('review-request')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'en' ? 'Back' : 'തിരികെ'}</span>
              </button>

              <button
                type="button"
                disabled={!selectedDoctor}
                onClick={() => setStep('confirm-visit')}
                className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <span>{lang === 'en' ? 'Confirm Doctor' : 'ഡോക്ടറെ സ്ഥിരീകരിക്കുക'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 7: FINAL CONFIRMATION                               */}
        {/* ========================================================= */}
        {step === 'confirm-visit' && selectedPatient && selectedDoctor && (
          <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 space-y-6 shadow-2xl">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-black text-white">
                {lang === 'en' ? 'CONFIRM YOUR VISIT' : 'സന്ദർശനം സ്ഥിരീകരിക്കുക'}
              </h2>
              <p className="text-slate-400 text-xs font-medium">
                {lang === 'en' ? 'Please review visit summary before OP ticket generation' : 'തീരുമാനം സ്ഥിരീകരിക്കുന്നതിന് മുൻപ് അവലോകനം ചെയ്യുക'}
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-800">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">{lang === 'en' ? 'Patient' : 'രോഗി'}</p>
                  <p className="font-black text-white text-base">{selectedPatient.patientName}</p>
                  <p className="font-mono text-xs text-blue-400">{selectedPatient.id}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">{lang === 'en' ? 'Department' : 'വകുപ്പ്'}</p>
                  <p className="font-black text-white text-base">{selectedDeptName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-800">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">{lang === 'en' ? 'Assigned Doctor' : 'ഡോക്ടർ'}</p>
                  <p className="font-black text-emerald-400 text-base">{selectedDoctor.name}</p>
                  <p className="text-xs text-slate-400">Room {selectedDoctor.room}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">{lang === 'en' ? 'Visit Source' : 'സോഴ്സ്'}</p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
                    SELF_SERVICE
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase text-slate-400 mb-1">{lang === 'en' ? 'Stated Request' : 'ആവശ്യം'}</p>
                <p className="text-xs text-slate-200 font-medium italic bg-slate-900 p-3 rounded-xl border border-slate-800">
                  "{cleanText || rawText || 'General Consultation'}"
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('routing-recommendation')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'en' ? 'Change Selection' : 'മാറ്റങ്ങൾ വരുത്തുക'}</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmAndGenerateToken}
                className="py-4 px-8 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-base shadow-xl shadow-emerald-600/30 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{lang === 'en' ? 'CONFIRM & GET OP TICKET' : 'സ്ഥിരീകരിച്ച് ടിക്കറ്റ് എടുക്കുക'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 8: TICKET READY & PRINT                             */}
        {/* ========================================================= */}
        {step === 'ticket-ready' && generatedTicket && (
          <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {lang === 'en' ? 'OP REGISTRATION COMPLETE!' : 'ഒ.പി രജിസ്ട്രേഷൻ പൂർത്തിയായി!'}
              </h2>
              <p className="text-slate-400 text-xs font-medium">
                {lang === 'en' ? 'Your token has been issued and sent to the doctor queue' : 'നിങ്ങളുടെ ടോക്കൺ ക്യൂവിലേക്ക് ചേർത്തു'}
              </p>
            </div>

            {/* Generated Ticket Display Box */}
            <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-6 space-y-4 shadow-inner">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500 tracking-widest">
                  {lang === 'en' ? 'YOUR TOKEN NUMBER' : 'നിങ്ങളുടെ ടോക്കൺ നമ്പർ'}
                </span>
                <p className="text-5xl font-black text-emerald-400 font-mono tracking-tight">
                  {generatedTicket.tokenNumber}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-left pt-4 border-t border-slate-800">
                <div>
                  <p className="text-slate-500 font-bold uppercase">{lang === 'en' ? 'Department' : 'വകുപ്പ്'}</p>
                  <p className="font-bold text-white text-sm">{generatedTicket.department}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase">{lang === 'en' ? 'Doctor' : 'ഡോക്ടർ'}</p>
                  <p className="font-bold text-white text-sm">{generatedTicket.doctorName}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase">{lang === 'en' ? 'Room' : 'മുറി'}</p>
                  <p className="font-bold text-blue-400 text-sm">Room {generatedTicket.doctorRoom}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-bold uppercase">{lang === 'en' ? 'Status' : 'സ്റ്റാറ്റസ്'}</p>
                  <span className="inline-block font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {generatedTicket.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => setShowPrintModal(true)}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>{lang === 'en' ? 'PRINT OP TICKET' : 'പ്രിന്റ് ടിക്കറ്റ്'}</span>
              </button>

              <button
                onClick={handleFullSessionReset}
                className="w-full py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base transition-colors cursor-pointer"
              >
                <span>{lang === 'en' ? 'DONE (RETURN TO WELCOME)' : 'പൂർത്തിയായി (പ്രധാന പേജിലേക്ക്)'}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Manual Department Selector Modal */}
      {isManualDeptPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">
                {lang === 'en' ? 'Select Hospital Department' : 'വകുപ്പ് തിരഞ്ഞെടുക്കുക'}
              </h3>
              <button
                onClick={() => setIsManualDeptPickerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => {
                    setSelectedDeptId(dept.id);
                    setSelectedDeptName(dept.name);
                    const docList = doctors.filter(
                      (d) => d.department.toLowerCase() === dept.name.toLowerCase() && d.status !== 'Off Duty'
                    );
                    setSelectedDoctor(docList.length > 0 ? docList[0] : null);
                    setIsManualDeptPickerOpen(false);
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    selectedDeptName.toLowerCase() === dept.name.toLowerCase()
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <p className="font-bold text-sm text-white">{dept.name}</p>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{dept.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <HelpCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">
                {lang === 'en' ? 'Need Receptionist Assistance?' : 'സഹായം ആവശ്യമുണ്ടോ?'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {lang === 'en'
                  ? 'Please visit Counter 1 (Reception Desk). Our hospital receptionist will assist you with registration or any special requests.'
                  : 'ദയവായി കൗണ്ടർ 1 (റിസപ്ഷൻ ഡെസ്ക്) സന്ദർശിക്കുക. ഞങ്ങളുടെ ജീവനക്കാർ നിങ്ങളെ സഹായിക്കും.'}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                {lang === 'en' ? 'Return to Registration' : 'തിരികെ തുടരുക'}
              </button>
              <button
                onClick={handleFullSessionReset}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold"
              >
                {lang === 'en' ? 'Reset Kiosk' : 'റീസെറ്റ് ചെയ്യുക'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Exit PIN Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white">Staff Exit Kiosk Mode</h3>
              <button
                onClick={() => setShowExitModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyExitPin} className="space-y-3">
              <p className="text-xs text-slate-400">Enter Staff Security PIN to exit kiosk view:</p>
              <input
                type="password"
                value={exitPin}
                onChange={(e) => {
                  setExitPin(e.target.value);
                  setExitPinError(false);
                }}
                placeholder="Enter PIN (Default: 1234)"
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center text-lg outline-none focus:border-blue-500"
                autoFocus
              />

              {exitPinError && (
                <p className="text-xs text-red-400 font-bold text-center">Incorrect PIN. Try 1234.</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md"
                >
                  Verify & Exit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inactivity Warning Modal */}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl max-w-md w-full p-8 text-center space-y-5 shadow-2xl animate-pulse">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white">
                {lang === 'en' ? 'Are You Still There?' : 'നിങ്ങൾ അവിടെയുണ്ടോ?'}
              </h3>
              <p className="text-xs text-slate-300">
                {lang === 'en'
                  ? 'To protect patient privacy, this screen will reset in:'
                  : 'രോഗിയുടെ വിവരങ്ങളുടെ സുരക്ഷക്കായി സെഷൻ അടയും:'}
              </p>
              <p className="text-4xl font-black text-amber-400 font-mono">
                {inactivityCountdown}s
              </p>
            </div>

            <button
              onClick={() => {
                setShowInactivityWarning(false);
                lastActivityRef.current = Date.now();
              }}
              className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 cursor-pointer"
            >
              {lang === 'en' ? 'Touch Anywhere to Continue' : 'തുടരാൻ ടാപ്പ് ചെയ്യുക'}
            </button>
          </div>
        </div>
      )}

      {/* Printable Ticket Modal */}
      {showPrintModal && generatedTicket && (
        <PrintTicketModal
          ticket={generatedTicket}
          hospitalInfo={INITIAL_HOSPITAL_INFO}
          onClose={() => setShowPrintModal(false)}
          onConfirmPrint={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
