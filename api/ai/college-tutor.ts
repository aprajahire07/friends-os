import { GoogleGenAI } from '@google/genai';

const GEMINI_CANDIDATE_MODELS = [
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt, college } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    let replyText = '';
    let tutorSuccess = false;
    let lastErr: any = null;

    for (const candidateModel of GEMINI_CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: candidateModel,
          contents: prompt || 'Hello',
          config: {
            systemInstruction: `You are FRIEND OS AI, a friendly college study buddy and academic tutor for students at ${
              college || 'college'
            }. Answer questions clearly in English, Hindi, or Hinglish with markdown, math/code step-by-step explanations, and an encouraging college student tone. Keep answers concise, clear, and actionable.`,
          },
        });
        replyText = response.text || '';
        tutorSuccess = true;
        break;
      } catch (err: any) {
        lastErr = err;
      }
    }

    if (!tutorSuccess) {
      throw lastErr || new Error('All AI models are currently busy. Please try again.');
    }

    return res.json({ response: replyText });
  } catch (err: any) {
    console.error('Gemini API Error:', err);
    return res.status(500).json({ error: err.message || 'AI request failed' });
  }
}
