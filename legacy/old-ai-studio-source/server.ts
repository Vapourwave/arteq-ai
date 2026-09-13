import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, LiveServerMessage, Modality } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import http from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const PORT = 3000;


app.use(express.json());

// Initialize Gemini Client server-side
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not defined in environment variables.');
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Healthcheck API
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Transcript Refinement API
app.post('/api/refine-transcript', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return res.status(400).json({ error: 'Missing or invalid transcript parameter.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
    }

    const systemInstruction = `You are a multilingual speech-transcript cleanup component for a hospital front-desk application.

Your only task is to clean a noisy speech transcript while preserving its exact meaning.

The transcript may contain Malayalam, Manglish Malayalam, English, Tamil, Hindi, code-switching, repetitions, false starts, and speech-recognition errors.

Rules:
1. Preserve meaning exactly.
2. Resolve explicit self-corrections in favor of the final corrected statement.
3. Remove obvious speech-recognition artifacts when they are clearly unrelated to the surrounding request.
4. Preserve genuine multilingual speech.
5. Preserve names, numbers, dates, duration, location, laterality, severity, uncertainty and other stated details.
6. Never diagnose.
7. Never infer a medical condition.
8. Never add information.
9. Never remove medically relevant information.
10. Never convert uncertainty into certainty.
11. Do not invent words to make the statement medically sound.
12. Do not turn a patient's description into a diagnosis.
13. If uncertain whether a phrase is meaningful or an artifact, preserve it rather than inventing a replacement.
14. If a phrase is explicitly corrected by the speaker, use the corrected version.
15. Keep the output concise and faithful to the original speech.

You are a linguistic cleanup component, not a medical reasoning system.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `Refine the following raw voice transcript from a hospital receptionist.\n\nRAW TRANSCRIPT:\n"${transcript}"`,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cleanTranscript: {
              type: Type.STRING,
              description: 'The linguistically refined transcript.'
            },
            routingText: {
              type: Type.STRING,
              description: 'A normalized representation used internally by the routing AI (translated into English if necessary to preserve exact meaning).'
            },
            language: {
              type: Type.STRING,
              description: 'The detected language(s) of the original speech.'
            },
            meaningPreserved: {
              type: Type.BOOLEAN,
              description: 'True if the original meaning is 100% preserved without any added medical context.'
            },
            uncertaintyDetected: {
              type: Type.BOOLEAN,
              description: 'True if the speaker expressed uncertainty (e.g. maybe, not sure).'
            }
          },
          required: ['cleanTranscript', 'routingText', 'language', 'meaningPreserved', 'uncertaintyDetected']
        }
      }
    });

    const responseText = response.text || '';
    try {
      const parsedData = JSON.parse(responseText);
      return res.json({ success: true, data: parsedData });
    } catch (e) {
      console.error('Failed to parse Gemini response JSON:', responseText);
      return res.status(500).json({ error: 'Failed to process AI response format.' });
    }
  } catch (err: any) {
    console.error('Transcript Refinement API Error:', err);
    return res.status(500).json({
      error: 'Transcript refinement service temporarily unavailable',
      message: err.message || 'An error occurred during transcript refinement.'
    });
  }
});


// Transcript Quality Guard Endpoint
app.post('/api/check-transcript-quality', async (req, res) => {
  try {
    const { rawTranscript, cleanTranscript } = req.body;

    if (!rawTranscript || !cleanTranscript) {
      return res.status(400).json({
        error: 'Missing rawTranscript or cleanTranscript parameter.',
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured on the server.',
      });
    }

    const systemInstruction = `You are a transcript quality assessment component for a hospital front-desk application.

Evaluate whether a cleaned speech transcript is sufficiently reliable for a receptionist to review and use for administrative routing.

You are NOT a medical reasoning system.

Do not diagnose.
Do not interpret symptoms.
Do not recommend treatment.
Do not reconstruct missing speech.
Do not invent words.
Do not choose a department.
Do not choose a doctor.

Compare the raw transcript and cleaned transcript.

Flag the transcript if:
- obvious speech-recognition artifacts are present,
- important information appears to have been lost,
- unresolved contradictions remain,
- self-corrections remain unresolved,
- the transcript is incomplete,
- or the text is severely corrupted.

Do not flag normal Malayalam, Manglish, English, or legitimate multilingual code-switching.

When uncertain, prefer REVIEW rather than inventing a correction.

Return only the requested structured output.`;

    const promptText = `
RAW TRANSCRIPT:
"${rawTranscript}"

REFINED TRANSCRIPT:
"${cleanTranscript}"

TASK:
1. Evaluate the refined transcript's reliability based on the rules provided.
2. Return a structured JSON response.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            qualityStatus: {
              type: Type.STRING,
              description: '"CLEAR", "REVIEW", or "INSUFFICIENT"',
            },
            qualityScore: {
              type: Type.NUMBER,
              description: 'A quality score between 0.0 and 1.0',
            },
            issues: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of specific issues found, if any',
            },
            requiresReview: {
              type: Type.BOOLEAN,
              description: 'True if qualityStatus is REVIEW or INSUFFICIENT',
            },
            reviewReason: {
              type: Type.STRING,
              description: 'A concise explanation for the receptionist if review is required, otherwise null.',
              nullable: true
            },
          },
          required: ['qualityStatus', 'qualityScore', 'issues', 'requiresReview'],
        },
      },
    });

    const responseText = response.text || '';

    try {
      const parsedData = JSON.parse(responseText);
      return res.json({ success: true, data: parsedData });
    } catch (e) {
      console.error('Failed to parse Gemini response JSON:', responseText);
      return res.status(500).json({ error: 'Failed to process AI response format.' });
    }
  } catch (err: any) {
    console.error('Transcript Quality API Error:', err);
    return res.status(500).json({
      error: 'Transcript quality service temporarily unavailable',
      message: err.message || 'An error occurred during transcript quality assessment.'
    });
  }
});

// Helper mock departments and doctors for server-side closed-world routing defaults
const DEFAULT_SERVER_DEPARTMENTS = [
  { id: 'dept-dentistry', name: 'Dentistry', description: 'Oral health, toothache, extractions, root canals, and cosmetic dental care.' },
  { id: 'dept-cardiology', name: 'Cardiology', description: 'Heart care, hypertension, chest discomfort, and cardiovascular health.' },
  { id: 'dept-general', name: 'General Medicine', description: 'Fever, seasonal flu, general consultations, viral infections, and routine checkups.' },
  { id: 'dept-pediatrics', name: 'Pediatrics', description: 'Child healthcare, vaccinations, pediatric fever, and growth monitoring.' },
  { id: 'dept-orthopedics', name: 'Orthopedics', description: 'Bone fractures, joint pain, sprains, arthritis, and back issues.' },
  { id: 'dept-neurology', name: 'Neurology', description: 'Severe headaches, dizziness, nerve pain, migraines, and neurological evaluation.' }
];

const DEFAULT_SERVER_DOCTORS = [
  { id: 'doc-anu', name: 'Dr. Anu', department: 'Dentistry', status: 'Available', specialty: 'Maxillofacial & Cosmetic Dentistry' },
  { id: 'doc-rahul', name: 'Dr. Rahul', department: 'Dentistry', status: 'Available', specialty: 'Orthodontics & General Dentistry' },
  { id: 'doc-meera', name: 'Dr. Meera', department: 'Cardiology', status: 'In Consultation', specialty: 'Interventional Cardiology' },
  { id: 'doc-john', name: 'Dr. John', department: 'General Medicine', status: 'Available', specialty: 'Internal Medicine & Infectious Care' },
  { id: 'doc-sarah', name: 'Dr. Sarah', department: 'Pediatrics', status: 'Available', specialty: 'Child Wellness & Neonatology' },
  { id: 'doc-vikram', name: 'Dr. Vikram', department: 'Orthopedics', status: 'On Break', specialty: 'Joint Replacement & Trauma Surgery' }
];

// Core Hospital Patient Routing Handler (Used by POST /api/route-patient and POST /api/ai/recommend-routing)
async function handlePatientRouting(req: express.Request, res: express.Response) {
  try {
    const approvedRequest = req.body.approvedRequest || req.body.patientRequest;
    const departments = req.body.departments && Array.isArray(req.body.departments) && req.body.departments.length > 0
      ? req.body.departments
      : DEFAULT_SERVER_DEPARTMENTS;
    const doctors = req.body.doctors && Array.isArray(req.body.doctors) && req.body.doctors.length > 0
      ? req.body.doctors
      : DEFAULT_SERVER_DOCTORS;

    if (!approvedRequest || typeof approvedRequest !== 'string' || !approvedRequest.trim()) {
      return res.status(400).json({
        error: 'Missing or invalid approvedRequest parameter.',
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured on the server.',
        fallbackToManual: true,
      });
    }

    const systemInstruction = `You are a hospital front-desk administrative routing assistant.

Your task is to recommend an appropriate hospital department/service and suitable configured doctors based ONLY on the patient's approved request and the hospital configuration provided to you.

You are not a doctor.

Do not diagnose diseases.
Do not infer medical conditions.
Do not prescribe treatment.
Do not recommend medication.
Do not perform emergency triage.

Only choose departments and doctors that exist in the supplied hospital configuration.

Never invent a department, doctor, doctor ID, room, availability, or appointment time.

If the request is ambiguous, do not guess. Request clarification.

If recommending doctors, only recommend doctors belonging to the selected department.

Preserve uncertainty expressed by the patient.

Use the supplied availability information only.

Return only the required structured routing output.`;

    const promptText = `
APPROVED REQUEST:
"${approvedRequest.trim()}"

AVAILABLE HOSPITAL DEPARTMENTS:
${JSON.stringify(departments, null, 2)}

AVAILABLE HOSPITAL DOCTORS & AVAILABILITY:
${JSON.stringify(doctors, null, 2)}

TASK:
1. Analyze the approved request.
2. Determine which hospital department/service best matches the request based ONLY on supplied departments.
3. Select suitable configured doctor IDs from that recommended department.
4. If the request is ambiguous (e.g., "I don't feel well", "I'm sick"), mark needsClarification = true and formulate a clarification question.
5. Provide a concise administrative reason for receptionist guidance.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedDepartmentId: {
              type: Type.STRING,
              description: 'Exact ID of the recommended department from the supplied list, or null if ambiguous/unknown.',
              nullable: true,
            },
            recommendedDepartmentName: {
              type: Type.STRING,
              description: 'Exact name of the recommended department from the supplied list, or null if ambiguous/unknown.',
              nullable: true,
            },
            routingConfidence: {
              type: Type.STRING,
              description: '"HIGH", "MEDIUM", or "LOW". Refers ONLY to routing confidence.',
            },
            reason: {
              type: Type.STRING,
              description: 'Concise explanation for why this department was selected.',
            },
            recommendedDoctorIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of matching doctor IDs belonging strictly to the recommended department.',
            },
            needsClarification: {
              type: Type.BOOLEAN,
              description: 'True if the request is ambiguous or unspecific.',
            },
            clarificationQuestion: {
              type: Type.STRING,
              description: 'Follow-up question to ask the patient if clarification is needed.',
              nullable: true,
            },
          },
          required: [
            'routingConfidence',
            'reason',
            'recommendedDoctorIds',
            'needsClarification',
          ],
        },
      },
    });

    const responseText = response.text || '';
    console.log('[ROUTING DEBUG] approvedRequest:', approvedRequest);
    console.log('[ROUTING DEBUG] Gemini raw response:', responseText);

    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
      console.log('[ROUTING DEBUG] Parsed routing result:', JSON.stringify(parsedData, null, 2));
    } catch (e) {
      console.error('Failed to parse Gemini response JSON:', responseText);
      return res.status(500).json({
        error: 'Failed to process AI response format.',
        fallbackToManual: true,
      });
    }

    // --- CLOSED-WORLD BACKEND VALIDATION ---
    const deptList: Array<any> = departments;
    const docList: Array<any> = doctors;

    // Normalize confidence to HIGH / MEDIUM / LOW
    let rawConf = (parsedData.routingConfidence || 'MEDIUM').toUpperCase();
    if (rawConf.includes('HIGH')) rawConf = 'HIGH';
    else if (rawConf.includes('LOW')) rawConf = 'LOW';
    else rawConf = 'MEDIUM';
    parsedData.routingConfidence = rawConf;

    // Match recommended department against configured departments list
    const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const recIdNorm = normalize(parsedData.recommendedDepartmentId);
    const recNameNorm = normalize(parsedData.recommendedDepartmentName);

    const matchCandidates = deptList.filter((d) => {
      const dId = normalize(d.id);
      const dName = normalize(d.name);
      const dCode = normalize(d.code);

      // Exact matches (very strong)
      if (dId && (dId === recIdNorm || dId === recNameNorm)) return true;
      if (dCode && (dCode === recIdNorm || dCode === recNameNorm)) return true;
      if (dName && (dName === recIdNorm || dName === recNameNorm)) return true;

      // Safe Partial Matching
      if (recNameNorm && dName) {
        if (recNameNorm.length >= 4 && dName.length >= 4) {
          // One fully includes the other
          if (recNameNorm.includes(dName) || dName.includes(recNameNorm)) return true;
          // Common prefix (e.g., 'denti'/'denta', 'ortho', 'cardi', 'pedia')
          if (recNameNorm.substring(0, 4) === dName.substring(0, 4)) return true;
        }
      }
      
      // Fallback for ID partial matching (e.g., 'dent' inside 'dept-dentistry' or 'dentistry')
      if (recIdNorm && recIdNorm.length >= 3) {
        if (dId.includes(recIdNorm) || dName.includes(recIdNorm)) return true;
      }

      return false;
    });

    let matchedDept = null;
    let matchMethod = 'NO_MATCH';
    
    if (matchCandidates.length === 1) {
      matchedDept = matchCandidates[0];
      matchMethod = 'SINGLE_MATCH';
    } else if (matchCandidates.length > 1) {
      matchedDept = null;
      matchMethod = 'AMBIGUOUS';
    }

    console.log('[ROUTING MATCH]');
    console.log('Gemini department ID:', parsedData.recommendedDepartmentId);
    console.log('Gemini department name:', parsedData.recommendedDepartmentName);
    console.log('Matched configured department:', matchedDept ? `${matchedDept.id} / ${matchedDept.name}` : 'null');
    console.log('Match method:', matchMethod);

    if (!matchedDept || parsedData.needsClarification) {
      // If AI recommended a department that doesn't exist in hospital config OR marked clarification needed
      if (!matchedDept && !parsedData.needsClarification) {
        parsedData.reason = 'The AI returned a department that is not configured in this hospital.';
      }
      parsedData.recommendedDepartmentId = null;
      parsedData.recommendedDepartmentName = null;
      parsedData.recommendedDoctorIds = [];
      parsedData.needsClarification = true;
      parsedData.routingConfidence = 'LOW';
      if (!parsedData.clarificationQuestion) {
        parsedData.clarificationQuestion = 'Could you tell us what problem or service you need help with?';
      }
    } else {
      // Valid department found in actual hospital configuration
      parsedData.recommendedDepartmentId = matchedDept.id;
      parsedData.recommendedDepartmentName = matchedDept.name;

      // Filter recommended doctors strictly against actual hospital data
      // Rule: Doctor must exist, belong to recommended department, and be eligible/available
      const validDoctors = (parsedData.recommendedDoctorIds || []).filter((docId: string) => {
        const docObj = docList.find((d) => d.id === docId);
        if (!docObj) return false; // Doctor does not exist in hospital config

        // Check department match
        const deptNameMatch = docObj.department && matchedDept.name && docObj.department.toLowerCase() === matchedDept.name.toLowerCase();
        const deptIdMatch = docObj.departmentId && matchedDept.id && docObj.departmentId.toLowerCase() === matchedDept.id.toLowerCase();
        if (!deptNameMatch && !deptIdMatch) return false; // Doctor belongs to a different department

        // Check availability/status
        if (docObj.status === 'Off Duty') return false;

        return true;
      });

      parsedData.recommendedDoctorIds = validDoctors;
    }

    // Map UI compatibility fields
    const confidenceLabelMap: Record<string, 'High' | 'Moderate' | 'Low'> = {
      HIGH: 'High',
      MEDIUM: 'Moderate',
      LOW: 'Low',
    };
    const confidenceScoreMap: Record<string, number> = {
      HIGH: 0.9,
      MEDIUM: 0.6,
      LOW: 0.3,
    };

    parsedData.understoodRequest = approvedRequest;
    parsedData.confidenceLabel = confidenceLabelMap[parsedData.routingConfidence] || 'Moderate';
    parsedData.confidence = confidenceScoreMap[parsedData.routingConfidence] || 0.6;
    if (!parsedData.recommendedDepartmentName) {
      parsedData.recommendedDepartmentName = matchedDept ? matchedDept.name : '';
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('NOT_FOUND') && err.message.includes('models/')) {
      console.error('[ROUTING_MODEL_ERROR] AI Routing API Error:', err.message);
    } else if (err.status === 404 || err.code === 404) {
      console.error('[ROUTING_MODEL_ERROR] AI Routing API Error:', err);
    } else {
      console.error('AI Routing API Error:', err);
    }
    return res.status(500).json({
      error: 'AI service temporarily unavailable',
      message: err.message || 'An error occurred during AI analysis.',
      fallbackToManual: true,
    });
  }
}

// Dedicated STEP 6D Endpoint: POST /api/route-patient
app.post('/api/route-patient', handlePatientRouting);

// Legacy/Alternative Endpoint Alias: POST /api/ai/recommend-routing
app.post('/api/ai/recommend-routing', handlePatientRouting);

// Setup Vite or Static File Server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', async (clientWs) => {
    const ai = getGeminiClient();
    if (!ai) {
      clientWs.send(JSON.stringify({ error: 'Gemini API key is not configured' }));
      clientWs.close();
      return;
    }

    try {
      const session = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          systemInstruction: "You are the voice transcription component of a hospital front-desk application. Listen carefully to the receptionist's spoken description of a patient's request. Your role in this session is to capture and transcribe the receptionist's speech accurately. Do not diagnose the patient. Do not provide medical advice. Do not recommend treatment. Do not interrupt with medical opinions. The application will use your input transcription later for administrative service routing. Do not verbally respond unless explicitly required by the Live API configuration. The important task is accurate transcription.",
          responseModalities: [Modality.AUDIO], // Required for Live API
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {}, // Enable user input transcription
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // Forward everything to client so it can handle transcripts
            // The Live API docs say transcription is inside `serverContent.modelTurn` or `serverContent.interrupted` etc
            clientWs.send(JSON.stringify(message));
          },
          onclose: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.close();
            }
          }
        },
      });

      clientWs.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          }
          if (parsed.end) {
            // End of input signal? Just close session or send something.
          }
        } catch (e) {
          console.error('Error parsing client WS message', e);
        }
      });

      clientWs.on('close', () => {
        // Client disconnected, close the Gemini session
        session.close();
      });

    } catch (err) {
      console.error('Failed to connect to Gemini Live', err);
      clientWs.send(JSON.stringify({ error: 'Failed to connect to Live API' }));
      clientWs.close();
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
