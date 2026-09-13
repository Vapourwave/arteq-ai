import React, { useState, useEffect } from 'react';
import { PatientFormState, Doctor, AIRoutingRecommendation, AIRoutingAudit } from '../../types';
import { MOCK_DOCTORS, MOCK_DEPARTMENTS } from '../../data/mockData';
import { PatientContextCard } from './PatientContextCard';
import { analyzeServiceRequest } from '../../services/aiRoutingService';
import { 
  Sparkles, 
  Smile, 
  HeartPulse, 
  Stethoscope, 
  Baby, 
  Bone, 
  Brain, 
  Check, 
  ArrowLeft, 
  ArrowRight, 
  Clock, 
  Info,
  MapPin,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  ShieldAlert
} from 'lucide-react';

interface Step3RecommendationProps {
  patientInfo: PatientFormState;
  serviceRequestText: string;
  selectedDoctor: Doctor | null;
  onContinue: (doctor: Doctor, department: string, audit?: AIRoutingAudit) => void;
  onBack: () => void;
  onChangePatient?: () => void;
}

export const Step3Recommendation: React.FC<Step3RecommendationProps> = ({
  patientInfo,
  serviceRequestText,
  selectedDoctor: initialSelectedDoc,
  onContinue,
  onBack,
  onChangePatient,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [aiResult, setAiResult] = useState<AIRoutingRecommendation | null>(null);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>('');

  const [activeDept, setActiveDept] = useState<string>('General Medicine');
  const [selectedDoc, setSelectedDoc] = useState<Doctor | null>(initialSelectedDoc);
  const [manualOverrideMode, setManualOverrideMode] = useState<boolean>(false);

  // Run AI Routing Analysis
  const runAnalysis = async () => {
    setLoading(true);
    setAiError('');

    try {
      const res = await analyzeServiceRequest(serviceRequestText, MOCK_DEPARTMENTS, MOCK_DOCTORS);
      setAiResult(res.recommendation);
      setIsFallback(res.isFallback);
      if (res.error) setAiError(res.error);

      // Set initial department recommendation
      const recDept = res.recommendation.recommendedDepartmentName || 'General Medicine';
      setActiveDept(recDept);

      // Auto-select first matching doctor in recommended department if available
      const deptDocs = MOCK_DOCTORS.filter((d) => d.department.toLowerCase() === recDept.toLowerCase());
      if (deptDocs.length > 0) {
        // Prefer doctor in recommendedDoctorIds if present
        const preferred = deptDocs.find((d) => res.recommendation.recommendedDoctorIds.includes(d.id));
        setSelectedDoc(preferred || deptDocs[0]);
      } else if (MOCK_DOCTORS.length > 0) {
        setSelectedDoc(MOCK_DOCTORS[0]);
      }
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      setAiError('AI service temporarily unavailable');
      setManualOverrideMode(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, [serviceRequestText]);

  // Handle department change
  const handleDeptChange = (deptName: string) => {
    setActiveDept(deptName);
    const deptDocs = MOCK_DOCTORS.filter((d) => d.department.toLowerCase() === deptName.toLowerCase());
    if (deptDocs.length > 0) {
      setSelectedDoc(deptDocs[0]);
    } else {
      setSelectedDoc(null);
    }
  };

  // Doctors belonging strictly to active department
  const filteredDoctors = MOCK_DOCTORS.filter(
    (d) => d.department.toLowerCase() === activeDept.toLowerCase()
  );

  const handleConfirm = () => {
    if (!selectedDoc) return;

    // Check if receptionist accepted AI recommendation
    const isDeptAccepted =
      aiResult &&
      !aiResult.needsClarification &&
      !aiResult.isInvalidDepartment &&
      aiResult.recommendedDepartmentName.toLowerCase() === activeDept.toLowerCase();

    const isDocAccepted =
      isDeptAccepted &&
      aiResult?.recommendedDoctorIds.includes(selectedDoc.id);

    const isAccepted = Boolean(isDeptAccepted && isDocAccepted);

    const audit: AIRoutingAudit = {
      patientRequest: serviceRequestText,
      aiSuggestedDepartmentId: aiResult?.recommendedDepartmentId,
      aiSuggestedDepartmentName: aiResult?.recommendedDepartmentName,
      aiSuggestedDoctorIds: aiResult?.recommendedDoctorIds,
      aiRoutingConfidence: aiResult?.confidenceLabel || 'Moderate',
      aiConfidenceValue: aiResult?.confidence || 0.8,
      aiReason: aiResult?.reason,
      selectedDepartmentId: MOCK_DEPARTMENTS.find((d) => d.name === activeDept)?.id || activeDept,
      selectedDepartmentName: activeDept,
      selectedDoctorId: selectedDoc.id,
      selectedDoctorName: selectedDoc.name,
      recommendationAccepted: isAccepted,
      recommendationTimestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    onContinue(selectedDoc, activeDept, audit);
  };

  const getDeptIcon = (deptName: string) => {
    switch (deptName) {
      case 'Dentistry':
        return <Smile className="w-6 h-6 text-teal-600" />;
      case 'Cardiology':
        return <HeartPulse className="w-6 h-6 text-rose-600" />;
      case 'General Medicine':
        return <Stethoscope className="w-6 h-6 text-sky-600" />;
      case 'Pediatrics':
        return <Baby className="w-6 h-6 text-purple-600" />;
      case 'Orthopedics':
        return <Bone className="w-6 h-6 text-amber-600" />;
      default:
        return <Brain className="w-6 h-6 text-indigo-600" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Patient Context Card */}
      <PatientContextCard
        patientInfo={patientInfo}
        onChangePatient={onChangePatient}
      />

      {/* Service Request Quote Display */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between text-xs text-slate-700">
        <span className="font-bold text-slate-500 uppercase tracking-wider shrink-0">Patient Request:</span>
        <span className="font-semibold text-slate-900 italic max-w-lg truncate ml-2">
          «"{serviceRequestText || 'No request provided'}"»
        </span>
      </div>

      {/* Main Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        {/* Loading State */}
        {loading ? (
          <div className="py-16 text-center space-y-4">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
              <Sparkles className="w-6 h-6 text-blue-600 absolute" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Understanding request...</h3>
              <p className="text-xs text-slate-500 mt-1">
                Matching patient request against hospital departments and doctor availability
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Header & AI Badge */}
            <div className="pb-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  AI Routing Recommendation
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Review the suggested department and confirm doctor selection
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-800 rounded-xl border border-blue-200 text-xs font-semibold shrink-0">
                <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                <span>AI Routing Assistant</span>
              </div>
            </div>

            {/* Error or Fallback Warning */}
            {aiError && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="grow">
                  <p className="font-bold">{aiError}</p>
                  <p className="mt-0.5 text-amber-700">
                    You can select the department and doctor manually below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runAnalysis}
                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            )}

            {/* Case A: Low Confidence / Needs Clarification */}
            {aiResult?.needsClarification ? (
              <div className="mt-6 bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 text-slate-800 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Need More Information</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      The patient request is not specific enough to confidently recommend a department.
                    </p>
                  </div>
                </div>

                {/* AI Suggested Clarification Question */}
                {aiResult.clarificationQuestion && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Suggested Follow-up Question for Patient:
                    </p>
                    <blockquote className="text-sm font-semibold italic text-slate-900">
                      «"{aiResult.clarificationQuestion}"»
                    </blockquote>
                  </div>
                )}

                {/* Clarification Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    id="ask-patient-again-btn"
                    onClick={onBack}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Ask Patient Again</span>
                  </button>

                  <button
                    type="button"
                    id="choose-dept-manually-btn"
                    onClick={() => setManualOverrideMode(true)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                    <span>Choose Department Manually</span>
                  </button>
                </div>
              </div>
            ) : aiResult?.isInvalidDepartment ? (
              /* Case B: Invalid / Unavailable Department */
              <div className="mt-6 bg-rose-50 border-2 border-rose-200 rounded-2xl p-6 text-rose-900 space-y-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
                  <div>
                    <h3 className="text-base font-bold">Service Not Available</h3>
                    <p className="text-xs text-rose-700 mt-0.5">
                      Please select from the available hospital services.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    id="choose-dept-manually-invalid-btn"
                    onClick={() => setManualOverrideMode(true)}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Choose Department Manually</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Case C: Normal AI Recommendation Display */
              <div className="mt-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Suggested Service
                    </p>
                    {/* Routing Confidence Badge */}
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                      <span>Routing confidence:</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] ${
                          aiResult?.confidenceLabel === 'High'
                            ? 'bg-emerald-100 text-emerald-800'
                            : aiResult?.confidenceLabel === 'Moderate'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {aiResult?.confidenceLabel || 'High'} confidence
                      </span>
                    </div>
                  </div>

                  {/* Suggested Department Box */}
                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-teal-50 border-2 border-blue-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-blue-100 flex items-center justify-center shrink-0">
                        {getDeptIcon(activeDept)}
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">{activeDept}</h3>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          <strong>Why?</strong> «{aiResult?.reason || 'Selected based on clinical service request analysis.'}»
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> AI Suggested
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Department Manual Override Switcher */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select Department (Manual Override)
                </span>
                <span className="text-xs text-slate-400">
                  Receptionist can change department anytime
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {MOCK_DEPARTMENTS.map((dept) => {
                  const isActive = activeDept === dept.name;
                  const isAiSuggested = aiResult?.recommendedDepartmentName === dept.name;

                  return (
                    <button
                      key={dept.id}
                      type="button"
                      id={`dept-override-btn-${dept.id}`}
                      onClick={() => handleDeptChange(dept.name)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{dept.name}</span>
                      {isAiSuggested && (
                        <span className="w-2 h-2 rounded-full bg-blue-500" title="AI Suggested" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Doctor Selection Grid */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Available Doctors in {activeDept} ({filteredDoctors.length})
                </p>
                <span className="text-xs text-slate-500">Receptionist selects doctor to create token</span>
              </div>

              {filteredDoctors.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs">
                  No doctors currently configured for {activeDept}. Please switch department.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredDoctors.map((doc) => {
                    const isSelected = selectedDoc?.id === doc.id;
                    const isAiSuggestedDoc = aiResult?.recommendedDoctorIds.includes(doc.id);

                    return (
                      <div
                        key={doc.id}
                        id={`doctor-card-${doc.id}`}
                        onClick={() => setSelectedDoc(doc)}
                        className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        {/* Selected Checkmark */}
                        {isSelected && (
                          <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base border shrink-0 ${doc.avatarColor}`}
                          >
                            {doc.name.split(' ')[1]?.charAt(0) || 'D'}
                          </div>

                          <div className="min-w-0 pr-6">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-extrabold text-slate-900 text-base">{doc.name}</h4>
                              {isAiSuggestedDoc && (
                                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-md border border-blue-200">
                                  AI Suggested
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-slate-500 truncate">{doc.specialty}</p>

                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                  doc.status === 'Available'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    doc.status === 'Available' ? 'bg-emerald-500' : 'bg-amber-500'
                                  }`}
                                />
                                {doc.status}
                              </span>

                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {doc.room}
                              </span>

                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                                <Clock className="w-3 h-3 text-blue-600" />
                                Next OP: {doc.nextOpTime}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">
                            Exp: {doc.experienceYears} Years
                          </span>
                          <button
                            type="button"
                            id={`select-doctor-btn-${doc.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDoc(doc);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {isSelected ? 'Selected ✓' : 'Select Doctor'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Administrative Safety Disclaimer */}
            <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>AI suggests department routing. Receptionist confirms the final doctor assignment.</span>
            </div>

            {/* Navigation Buttons */}
            <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between gap-4">
              <button
                type="button"
                id="step3-back-btn"
                onClick={onBack}
                className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                id="step3-confirm-continue-btn"
                disabled={!selectedDoc}
                onClick={handleConfirm}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-md flex items-center gap-2 transition-all transform active:scale-95"
              >
                <span>Confirm Doctor & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
