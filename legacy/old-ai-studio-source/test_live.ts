import { GoogleGenAI, LiveConnectConfig, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  const session = await ai.live.connect({
    model: 'gemini-3.1-flash-live-preview',
    config: {
      systemInstruction: { parts: [{ text: "You are the voice transcription component." }] },
      inputAudioTranscription: {}, 
    }
  });

  session.on('message', (msg) => {
    if (msg.serverContent?.inputTranscription) {
      console.log('Transcription:', msg.serverContent.inputTranscription.text);
    }
    if (msg.serverContent?.turnComplete) {
      console.log('Turn Complete');
    }
    if (msg.serverContent?.interrupted) {
      console.log('Interrupted');
    }
  });
  
  session.on('close', () => console.log('Closed'));

  console.log('Connected');
  
  // Wait we need to send audio...
  // Actually, I can just write the test logic.
  session.close();
}

run().catch(console.error);
