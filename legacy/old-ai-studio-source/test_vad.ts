import { GoogleGenAI } from '@google/genai';
import WebSocket from 'ws';
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function synthesizeText(text: string): Promise<Buffer> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-live-preview',
    contents: `Speak the following sentence naturally: "${text}"`,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
      }
    }
  });
  
  const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith('audio'))?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio returned");
  return Buffer.from(base64Audio, 'base64');
}

async function runTest() {
  console.log("Synthesizing audio 1...");
  // We'll synthesize two halves and add 2 seconds of silence in between to simulate a natural pause
  const part1 = await synthesizeText("Enikku tooth pain aanu.");
  const part2 = await synthesizeText("kurachu divasamaayi undu.");
  const part3 = await synthesizeText("dentistine kaananam.");
  
  console.log("Audio lengths:", part1.length, part2.length, part3.length);
  // Note: Gemini returns 24kHz PCM. The server resamples 44.1/48 to 16kHz on frontend, but server.ts accepts it via websocket.
  // Wait, the client sends audio in base64. 
}
runTest().catch(console.error);
