import fs from 'fs';
const content = fs.readFileSync('src/components/workflow/Step2ServiceRequest.tsx', 'utf8');

const submitBtnOld = `
            <button
              type="submit"
              id="step2-analyze-btn"
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md flex items-center gap-2 transition-all transform active:scale-95"
            >
              <span>Analyze Request →</span>
              <ArrowRight className="w-4 h-4" />
            </button>
`;

const submitBtnNew = `
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
                className={\`px-6 py-3 rounded-xl text-white font-bold text-sm shadow-md flex items-center gap-2 transition-all transform active:scale-95 \${
                  transcriptQuality?.qualityStatus === 'REVIEW' 
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                }\`}
              >
                <span>{transcriptQuality?.qualityStatus === 'REVIEW' ? 'Review & Continue →' : 'Analyze Request →'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
`;

fs.writeFileSync('src/components/workflow/Step2ServiceRequest.tsx', content.replace(submitBtnOld, submitBtnNew));
