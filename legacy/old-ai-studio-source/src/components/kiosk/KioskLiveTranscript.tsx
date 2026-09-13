import React, { useEffect, useState } from 'react';

interface KioskLiveTranscriptProps {
  isRecording: boolean;
  finalTranscriptRef: React.RefObject<string>;
  lang: 'en' | 'ml';
}

export const KioskLiveTranscript: React.FC<KioskLiveTranscriptProps> = ({
  isRecording,
  finalTranscriptRef,
  lang,
}) => {
  const [duration, setDuration] = useState<number>(0);
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  useEffect(() => {
    if (!isRecording) {
      setDuration(0);
      setLiveTranscript('');
      return;
    }

    // Isolated 1-second timer for recording duration
    const timerInterval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    // Isolated ~150ms throttled reader for live transcript display
    const transcriptInterval = setInterval(() => {
      if (finalTranscriptRef.current) {
        setLiveTranscript(finalTranscriptRef.current.trim());
      }
    }, 150);

    return () => {
      clearInterval(timerInterval);
      clearInterval(transcriptInterval);
    };
  }, [isRecording, finalTranscriptRef]);

  if (!isRecording) return null;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold text-red-400 bg-red-500/10 py-1.5 px-3 rounded-full w-max mx-auto border border-red-500/20 animate-pulse">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span>
          {lang === 'en' ? 'Recording:' : 'റെക്കോർഡിംഗ്:'} {duration}s
        </span>
      </div>

      {liveTranscript ? (
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl text-left shadow-inner">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            <span>{lang === 'en' ? 'Live Transcript:' : 'തത്സമയം കേൾക്കുന്നത്:'}</span>
          </p>
          <p className="text-xs text-slate-200 font-medium leading-relaxed italic break-words">
            "{liveTranscript}"
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">
          {lang === 'en' ? 'Listening for speech...' : 'സംസാരത്തിനായി കേൾക്കുന്നു...'}
        </p>
      )}
    </div>
  );
};
