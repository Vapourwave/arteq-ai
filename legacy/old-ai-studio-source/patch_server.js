import fs from 'fs';
const content = fs.readFileSync('server.ts', 'utf8');

const newEndpoint = `
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

    const systemInstruction = \`You are a transcript quality assessment component for a hospital front-desk application.

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

Return only the requested structured output.\`;

    const promptText = \`
RAW TRANSCRIPT:
"\${rawTranscript}"

REFINED TRANSCRIPT:
"\${cleanTranscript}"

TASK:
1. Evaluate the refined transcript's reliability based on the rules provided.
2. Return a structured JSON response.
\`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
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

`;

const splitIndex = content.indexOf('// AI Routing Recommendation Endpoint');
const newContent = content.slice(0, splitIndex) + newEndpoint + content.slice(splitIndex);

fs.writeFileSync('server.ts', newContent);
