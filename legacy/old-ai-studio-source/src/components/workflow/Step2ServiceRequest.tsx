import React, { useState, useEffect, useRef } from 'react';
import { PatientFormState, ServiceRequestState } from '../../types';
import { SAMPLE_SERVICE_PROMPTS } from '../../data/mockData';
import { PatientContextCard } from './PatientContextCard';
import { Mic, ArrowLeft, ArrowRight, Sparkles, Volume2, Info, RefreshCw, AlertCircle, Square, Edit3 } from 'lucide-react';
import { GeminiLiveVoiceService } from '../../services/geminiLiveVoiceService';
import { refineTranscript, checkTranscriptQuality, TranscriptQualityResult } from '../../services/transcriptRefinementService';

interface Step2ServiceRequestProps {
  patientInfo: PatientFormState;
  initialService: ServiceRequestState;
  onContinue: (service: ServiceRequestState) => void;
  onBack: () => void;
  onChangePatient?: () => void;
}

export const Step2ServiceRequest: React.FC<Step2ServiceRequestProps> = ({
  patientInfo,
  initialService,
  onContinue,
  onBack,
  onChangePatient,
}) => {
  const [serviceText, setServiceText] = useState<string>(initialService.rawText || '');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceUnavailableWarning, setVoiceUnavailableWarning] = useState<string>('');
  const [recordingTimer, setRecordingTimer] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [isEditingTranscription, setIsEditingTranscription] = useState<boolean>(true);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  // Transcript Refinement State
  const [rawTranscript, setRawTranscript] = useState<string>('');
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [showRawTranscript, setShowRawTranscript] = useState<boolean>(false);
  const [refinementError, setRefinementError] = useState<string>('');
  const [transcriptQuality, setTranscriptQuality] = useState<TranscriptQualityResult | null>(null);

  const isListeningRef = useRef<boolean>(false);
  const voiceServiceRef = useRef<GeminiLiveVoiceService | null>(null);

  // Buffer for transcriptions from Live API
  const finalTranscriptRef = useRef<string>('');

  useEffect(() => {
    // Check basic Web Audio / getUserMedia support
    if (!GeminiLiveVoiceService.isSupported()) {
      setIsSupported(false);
      setVoiceUnavailableWarning(
        "Voice input isn't available on this device. Please type the request instead."
      );
    }
    
    return () => {
      cleanupLiveSession();
    };
  }, []);

  const cleanupLiveSession = () => {
    isListeningRef.current = false;
    setIsListening(false);
    
    if (voiceServiceRef.current) {
      voiceServiceRef.current.stop();
      voiceServiceRef.current = null;
    }
  };

  // Timer for active recording display
  useEffect(() => {
    let interval: any;
    if (isListening) {
      interval = setInterval(() => {
        setRecordingTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTimer(0);
    }
    return () => clearInterval(interval);
  }, [isListening]);

  const handleStartSpeaking = async () => {
    setVoiceUnavailableWarning('');
    setError('');

    if (!isSupported) {
      setVoiceUnavailableWarning(
        "Voice input isn't supported on this browser. Please type the request instead."
      );
      return;
    }

    if (isListeningRef.current || isListening) {
      return;
    }

    finalTranscriptRef.current = '';
    setServiceText('');
    setRawTranscript('');
    setRefinementError('');
    setTranscriptQuality(null);
    setShowRawTranscript(false);

    isListeningRef.current = true;
    setIsListening(true);

    const service = new GeminiLiveVoiceService({
      onTranscription: (text) => {
        finalTranscriptRef.current += text;
        setServiceText(finalTranscriptRef.current.trim());
      },
      onError: (err) => {
        setVoiceUnavailableWarning(err);
        cleanupLiveSession();
      },
      onClose: () => {
        cleanupLiveSession();
      }
    });

    voiceServiceRef.current = service;
    await service.start();
  };

  const handleStopSpeaking = async () => {
    const raw = finalTranscriptRef.current.trim();
    setRawTranscript(raw);
    cleanupLiveSession();

    if (!raw) return;

    setIsRefining(true);
    setRefinementError('');

    try {
      const result = await refineTranscript(raw);
      if (result.meaningPreserved && result.cleanTranscript) {
        setServiceText(result.cleanTranscript);
      } else {
        setServiceText(raw);
      }
    } catch (e) {
      console.error('Refinement failed:', e);
      setServiceText(raw);
      setRefinementError("Couldn't refine the transcript. You can review it manually.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleSimulateVoice = () => {
    setVoiceUnavailableWarning('');
    setError('');
    setIsListening(true);
    isListeningRef.current = true;
    let sec = 0;
    const interval = setInterval(() => {
      sec++;
      if (sec >= 2) {
        clearInterval(interval);
        setIsListening(false);
        isListeningRef.current = false;
        setServiceText('Patient has severe tooth pain and mild swelling on upper molar.');
      }
    }, 800);
  };

  const handleSelectSample = (sampleText: string) => {
    setServiceText(sampleText);
    setError('');
    setVoiceUnavailableWarning('');
    setTranscriptQuality(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceText.trim()) {
      setError("Please enter or record the patient's request.");
      return;
    }
    onContinue({
      rawText: serviceText.trim(),
      voiceSimulated: isListening,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Sticky Patient Context Banner */}
      <PatientContextCard
        patientInfo={patientInfo}
        onChangePatient={onChangePatient}
      />

      {/* Main Form Container */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="pb-5 border-b border-slate-100">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            What service does the patient need?
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Describe the patient's request in their own words.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Voice Input Section */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm text-slate-100">Voice Input</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="simulate-voice-btn"
                  onClick={handleSimulateVoice}
                  className="text-[11px] bg-slate-800 hover:bg-slate-700 text-blue-300 px-2.5 py-0.5 rounded-full border border-slate-700 transition-colors"
                  title="Test voice input with simulated audio"
                >
                  ⚡ Demo Speech Input
                </button>
                <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700">
                  Speech-to-Text
                </span>
              </div>
            </div>

            {/* Voice Control Trigger */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
              <div className="text-center sm:text-left">
                <p className="text-xs text-slate-300 font-medium">
                  {isListening ? 'Listening to speech...' : 'Press to start voice recognition'}
                </p>
                {isListening && (
                  <div className="flex items-center gap-1.5 mt-2 justify-center sm:justify-start">
                    <span className="w-2 h-4 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-6 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-8 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="w-2 h-5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
                    <span className="text-xs text-blue-300 font-mono ml-2">Listening... ({recordingTimer}s)</span>
                  </div>
                )}
              </div>

              {isListening ? (
                <button
                  type="button"
                  id="stop-speaking-btn"
                  onClick={handleStopSpeaking}
                  className="px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2.5 bg-rose-600 hover:bg-rose-700 text-white shadow-lg transition-all transform active:scale-95 shrink-0"
                >
                  <Square className="w-4 h-4 fill-white text-white" />
                  <span>🔴 Stop Listening</span>
                </button>
              ) : (
                <button
                  type="button"
                  id="start-speaking-btn"
                  onClick={handleStartSpeaking}
                  disabled={!isSupported}
                  className="px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50 text-white shadow-lg transition-all transform active:scale-95 shrink-0"
                >
                  <Mic className="w-4 h-4" />
                  <span>{serviceText ? '🎙 Record Again' : '🎙 Start Speaking'}</span>
                </button>
              )}
            </div>

            {/* Graceful Fallback Banner */}
            {voiceUnavailableWarning && (
              <div className="mt-3 p-3.5 bg-amber-950/80 border border-amber-600/50 rounded-xl text-xs text-amber-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="grow">
                    <p className="font-semibold">{voiceUnavailableWarning}</p>
                    <button
                      type="button"
                      id="type-request-instead-btn"
                      onClick={() => {
                        document.getElementById('service-request-textarea')?.focus();
                      }}
                      className="mt-2 px-3 py-1 bg-amber-900/90 hover:bg-amber-800 text-amber-100 rounded-lg font-bold text-[11px] transition-colors border border-amber-700/50"
                    >
                      Type Request Instead ↓
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-slate-200"></div>
            <span className="shrink font-bold text-xs text-slate-400 px-3 uppercase tracking-wider">OR TYPE REQUEST</span>
            <div className="grow border-t border-slate-200"></div>
          </div>

          {/* Transcribed / Text Input Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="service-request-textarea" className="block text-sm font-bold text-slate-800">
                Patient Request Text <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                {serviceText && (
                  <button
                    type="button"
                    id="edit-request-toggle-btn"
                    onClick={() => setIsEditingTranscription(!isEditingTranscription)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit Request
                  </button>
                )}
                {serviceText && (
                  <button
                    type="button"
                    id="clear-service-text-btn"
                    onClick={() => setServiceText('')}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
            </div>

            {/* Speech-To-Text Quoted Preview Box */}
            {serviceText && !isEditingTranscription && (
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 text-slate-900 mb-3">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">
                  Captured Patient Request
                </p>
                <blockquote className="text-sm font-semibold italic text-slate-800">
                  «"{serviceText}"»
                </blockquote>
              </div>
            )}

            <div className="relative">
              {isRefining && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center rounded-xl border border-slate-200">
                  <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mb-2" />
                  <p className="text-sm font-bold text-slate-700">Cleaning up transcript...</p>
                </div>
              )}
            {transcriptQuality && (
              <div className={`mt-3 p-4 rounded-xl border ${
                transcriptQuality.qualityStatus === 'CLEAR' ? 'bg-emerald-50 border-emerald-200' :
                transcriptQuality.qualityStatus === 'REVIEW' ? 'bg-amber-50 border-amber-200' :
                'bg-rose-50 border-rose-200'
              }`}>
                <div className="flex items-start gap-2.5">
                  {transcriptQuality.qualityStatus === 'CLEAR' && <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />}
                  {transcriptQuality.qualityStatus === 'REVIEW' && <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
                  {transcriptQuality.qualityStatus === 'INSUFFICIENT' && <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />}
                  <div>
                    <p className={`font-bold text-sm ${
                      transcriptQuality.qualityStatus === 'CLEAR' ? 'text-emerald-800' :
                      transcriptQuality.qualityStatus === 'REVIEW' ? 'text-amber-800' :
                      'text-rose-800'
                    }`}>
                      {transcriptQuality.qualityStatus === 'CLEAR' ? '🟢 Transcript looks clear' :
                       transcriptQuality.qualityStatus === 'REVIEW' ? '🟠 Please review this transcript' :
                       '🔴 More information may be needed'}
                    </p>
                    {transcriptQuality.reviewReason && (
                      <p className={`text-xs mt-1 font-medium ${
                        transcriptQuality.qualityStatus === 'REVIEW' ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        «{transcriptQuality.reviewReason}»
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            

              <textarea
                id="service-request-textarea"
                rows={4}
                placeholder="Type what the patient needs..."
                value={serviceText}
                onChange={(e) => {
                  setServiceText(e.target.value);
                  setTranscriptQuality(null);
                  if (error) setError('');
                }}
                disabled={isRefining}
                className="w-full p-4 rounded-xl border border-slate-300 text-sm font-medium bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 transition-all disabled:opacity-50"
              />
            </div>
            
            {refinementError && (
              <p className="text-xs text-amber-600 mt-2 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {refinementError}
              </p>
            )}

            {error && <p className="text-xs text-rose-500 mt-2 font-medium">{error}</p>}
            
            {rawTranscript && rawTranscript !== serviceText && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowRawTranscript(!showRawTranscript)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline underline-offset-2"
                >
                  {showRawTranscript ? 'Hide Original Transcript' : 'View Original Transcript'}
                </button>
                {showRawTranscript && (
                  <div className="mt-2 p-3 bg-slate-100 rounded-lg border border-slate-200 text-xs text-slate-600 font-mono">
                    <span className="font-bold block mb-1 uppercase tracking-wider text-[10px] text-slate-400">Raw Gemini Output</span>
                    {rawTranscript}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Preset Prompts */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Click a sample request to test:
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_SERVICE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  id={`sample-prompt-btn-${idx}`}
                  onClick={() => handleSelectSample(prompt.text)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    serviceText === prompt.text
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                  }`}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Non-Diagnostic Safety Note */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-600">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Administrative Routing Note:</strong> The AI assistant assists with front-desk department and doctor routing. It does not provide medical diagnosis or treatment.
            </p>
          </div>

          {/* Nav Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <button
              type="button"
              id="step2-back-btn"
              onClick={onBack}
              className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Patient Registration</span>
            </button>

            {transcriptQuality?.qualityStatus === 'INSUFFICIENT' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleStartSpeaking}
                  className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-2"
                >
                  <Mic className="w-4 h-4" /> Speak Again
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('service-request-textarea')?.focus()}
                  className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-2"
                >
                  <Edit3 className="w-4 h-4" /> Edit Manually
                </button>
                <button
                  type="submit"
                  id="step2-analyze-btn"
                  className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md flex items-center gap-2 transition-all transform active:scale-95 ml-2"
                >
                  <span>Continue anyway →</span>
                </button>
              </div>
            ) : (
              <button
                type="submit"
                id="step2-analyze-btn"
                className={`px-6 py-3 rounded-xl text-white font-bold text-sm shadow-md flex items-center gap-2 transition-all transform active:scale-95 ${
                  transcriptQuality?.qualityStatus === 'REVIEW' 
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                }`}
              >
                <span>{transcriptQuality?.qualityStatus === 'REVIEW' ? 'Review & Continue →' : 'Analyze Request →'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
