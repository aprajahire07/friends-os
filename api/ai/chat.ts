import { GoogleGenAI } from '@google/genai';

function sanitizeGeminiContents(rawMessages: any[]) {
  const normalized: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

  for (const msg of rawMessages) {
    if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) continue;
    const targetRole = msg.role === 'assistant' ? 'model' : 'user';
    const parts: any[] = [];

    // Attachments
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        if (!att) continue;
        const mime = (att.type || '').toLowerCase();
        if (mime.startsWith('image/') && att.base64Data) {
          const cleanBase64 = att.base64Data.includes(',')
            ? att.base64Data.split(',')[1]
            : att.base64Data;
          if (cleanBase64) {
            parts.push({
              inlineData: {
                mimeType: mime || 'image/jpeg',
                data: cleanBase64,
              },
            });
          }
        } else if (mime === 'application/pdf' && att.base64Data) {
          const cleanBase64 = att.base64Data.includes(',')
            ? att.base64Data.split(',')[1]
            : att.base64Data;
          if (cleanBase64) {
            parts.push({
              inlineData: {
                mimeType: 'application/pdf',
                data: cleanBase64,
              },
            });
          }
        } else if (att.textContent) {
          parts.push({
            text: `[Attached Document: ${att.name || 'File'}]\n${att.textContent}\n[End of Document]`,
          });
        }
      }
    }

    if (typeof msg.content === 'string' && msg.content.trim()) {
      parts.push({ text: msg.content.trim() });
    }

    if (parts.length === 0) continue;

    if (normalized.length > 0 && normalized[normalized.length - 1].role === targetRole) {
      normalized[normalized.length - 1].parts.push(...parts);
    } else {
      normalized.push({ role: targetRole, parts });
    }
  }

  while (normalized.length > 0 && normalized[0].role === 'model') {
    normalized.shift();
  }

  if (normalized.length === 0) {
    normalized.push({ role: 'user', parts: [{ text: 'Hello!' }] });
  }

  return normalized;
}

const SYSTEM_INSTRUCTION =
  'You are FRIEND OS AI, a friendly, highly capable AI companion, academic tutor, and study assistant in Friend OS. You answer accurately, thoughtfully, and clearly in whatever language the user communicates in (English, Hindi, Hinglish, Marathi, etc.). Assist students with detailed explanations, homework, coding solutions, math step-by-step reasoning, document summaries, exam prep, and daily campus life. Use clean Markdown with headers, bold points, code blocks, and structured lists.';

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
    const { messages = [], stream = true } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      if (stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(
          `data: ${JSON.stringify({
            error: 'GEMINI_API_KEY environment variable is not configured. Please set GEMINI_API_KEY in your environment variables.',
          })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        return res.end();
      } else {
        return res.status(500).json({
          error: 'GEMINI_API_KEY environment variable is not configured.',
        });
      }
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const contents = sanitizeGeminiContents(messages);

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const onChunk = (chunkText: string) => {
        res.write(`data: ${JSON.stringify({ delta: chunkText })}\n\n`);
      };

      let streamSucceeded = false;
      let lastError: any = null;

      for (const candidateModel of GEMINI_CANDIDATE_MODELS) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const streamResult = await ai.models.generateContentStream({
              model: candidateModel,
              contents,
              config: {
                systemInstruction: SYSTEM_INSTRUCTION,
              },
            });

            let receivedAny = false;
            for await (const chunk of streamResult) {
              const deltaText = chunk.text || '';
              if (deltaText) {
                receivedAny = true;
                onChunk(deltaText);
              }
            }

            if (receivedAny) {
              streamSucceeded = true;
              break;
            }
          } catch (err: any) {
            const errStr = String(err?.message || JSON.stringify(err || ''));
            const is503 =
              errStr.includes('503') ||
              errStr.includes('UNAVAILABLE') ||
              errStr.includes('high demand');
            lastError = err;
            if (is503 && attempt === 0) {
              await new Promise((r) => setTimeout(r, 400));
              continue;
            }
            break;
          }
        }
        if (streamSucceeded) break;
      }

      if (!streamSucceeded) {
        for (const candidateModel of GEMINI_CANDIDATE_MODELS) {
          try {
            const genRes = await ai.models.generateContent({
              model: candidateModel,
              contents,
              config: {
                systemInstruction: SYSTEM_INSTRUCTION,
              },
            });
            const fullText = genRes.text || '';
            if (fullText) {
              onChunk(fullText);
              streamSucceeded = true;
              break;
            }
          } catch (err: any) {
            lastError = err;
          }
        }
      }

      if (!streamSucceeded) {
        const is503 =
          String(lastError?.message || '').includes('503') ||
          String(lastError?.message || '').includes('high demand');
        const friendlyMsg = is503
          ? 'AI servers are momentarily busy. Please try sending again in a moment.'
          : lastError?.message || 'Failed to generate response.';
        res.write(`data: ${JSON.stringify({ error: friendlyMsg })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      let reply = '';
      let success = false;
      let lastErr: any = null;

      for (const candidateModel of GEMINI_CANDIDATE_MODELS) {
        try {
          const geminiRes = await ai.models.generateContent({
            model: candidateModel,
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
            },
          });
          reply = geminiRes.text || '';
          success = true;
          break;
        } catch (err: any) {
          lastErr = err;
        }
      }

      if (!success) {
        throw lastErr || new Error('All AI models are currently busy. Please try again.');
      }

      return res.json({ response: reply });
    }
  } catch (err: any) {
    console.error('Serverless AI Request Error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || 'AI request failed' });
    }
  }
}
