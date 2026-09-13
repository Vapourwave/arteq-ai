import fs from 'fs';

const content = fs.readFileSync('src/components/workflow/Step2ServiceRequest.tsx', 'utf8');

// 1. Add imports
let newContent = content.replace(
  "import { refineTranscript } from '../../services/transcriptRefinementService';",
  "import { refineTranscript, checkTranscriptQuality, TranscriptQualityResult } from '../../services/transcriptRefinementService';"
);

// 2. Add state
newContent = newContent.replace(
  "const [refinementError, setRefinementError] = useState<string>('');",
  "const [refinementError, setRefinementError] = useState<string>('');\n  const [transcriptQuality, setTranscriptQuality] = useState<TranscriptQualityResult | null>(null);"
);

// 3. Reset state on start
newContent = newContent.replace(
  "setRefinementError('');",
  "setRefinementError('');\n    setTranscriptQuality(null);"
);

// 4. In handleStopSpeaking, add checkTranscriptQuality
const oldHandleStop = `
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
  };`;

const newHandleStop = `
    setIsRefining(true);
    setRefinementError('');
    try {
      const result = await refineTranscript(raw);
      let finalCleanText = raw;
      if (result.meaningPreserved && result.cleanTranscript) {
        finalCleanText = result.cleanTranscript;
      }
      setServiceText(finalCleanText);

      const qualityResult = await checkTranscriptQuality(raw, finalCleanText);
      setTranscriptQuality(qualityResult);
    } catch (e) {
      console.error('Refinement failed:', e);
      setServiceText(raw);
      setRefinementError("Couldn't refine the transcript. You can review it manually.");
      setTranscriptQuality({
        qualityStatus: 'REVIEW',
        qualityScore: 0,
        issues: [],
        requiresReview: true,
        reviewReason: 'Please review the transcript before continuing.',
      });
    } finally {
      setIsRefining(false);
    }
  };`;

newContent = newContent.replace(oldHandleStop, newHandleStop);

// 5. Reset quality when text is typed or changed
newContent = newContent.replace(
  "setServiceText(e.target.value);\n                  if (error) setError('');",
  "setServiceText(e.target.value);\n                  setTranscriptQuality(null);\n                  if (error) setError('');"
);

// 6. Reset quality when selecting sample
newContent = newContent.replace(
  "setVoiceUnavailableWarning('');\n  };",
  "setVoiceUnavailableWarning('');\n    setTranscriptQuality(null);\n  };"
);

// 7. Render Quality Status Banner
const textAreaDiv = `
              <textarea
                id="service-request-textarea"`;

const qualityUI = `
            {transcriptQuality && (
              <div className={\`mt-3 p-4 rounded-xl border \${
                transcriptQuality.qualityStatus === 'CLEAR' ? 'bg-emerald-50 border-emerald-200' :
                transcriptQuality.qualityStatus === 'REVIEW' ? 'bg-amber-50 border-amber-200' :
                'bg-rose-50 border-rose-200'
              }\`}>
                <div className="flex items-start gap-2.5">
                  {transcriptQuality.qualityStatus === 'CLEAR' && <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />}
                  {transcriptQuality.qualityStatus === 'REVIEW' && <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
                  {transcriptQuality.qualityStatus === 'INSUFFICIENT' && <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />}
                  <div>
                    <p className={\`font-bold text-sm \${
                      transcriptQuality.qualityStatus === 'CLEAR' ? 'text-emerald-800' :
                      transcriptQuality.qualityStatus === 'REVIEW' ? 'text-amber-800' :
                      'text-rose-800'
                    }\`}>
                      {transcriptQuality.qualityStatus === 'CLEAR' ? '🟢 Transcript looks clear' :
                       transcriptQuality.qualityStatus === 'REVIEW' ? '🟠 Please review this transcript' :
                       '🔴 More information may be needed'}
                    </p>
                    {transcriptQuality.reviewReason && (
                      <p className={\`text-xs mt-1 font-medium \${
                        transcriptQuality.qualityStatus === 'REVIEW' ? 'text-amber-700' : 'text-rose-700'
                      }\`}>
                        «{transcriptQuality.reviewReason}»
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
`;

newContent = newContent.replace(textAreaDiv, qualityUI + textAreaDiv);

fs.writeFileSync('src/components/workflow/Step2ServiceRequest.tsx', newContent);
