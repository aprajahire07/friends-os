import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sanitize messages for Gemini multi-turn API with performance optimizations
function sanitizeGeminiContents(rawMessages: any[]) {
  const normalized: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

  // Keep only the most recent 12 messages for ultra-fast response times
  const recentMessages = rawMessages.slice(-12);

  for (let i = 0; i < recentMessages.length; i++) {
    const msg = recentMessages[i];
    if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) continue;
    const targetRole = msg.role === 'assistant' ? 'model' : 'user';
    const parts: any[] = [];
    const isRecentTurn = i >= recentMessages.length - 2;

    // Only attach heavy base64 media on the most recent turns to avoid giant payloads
    if (isRecentTurn && Array.isArray(msg.attachments)) {
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
            text: `[Attached Document: ${att.name || 'File'}]\n${att.textContent.slice(0, 30000)}\n[End of Document]`,
          });
        }
      }
    }

    if (typeof msg.content === 'string' && msg.content.trim()) {
      parts.push({ text: msg.content.trim() });
    }

    if (parts.length === 0) continue;

    // Merge adjacent turns with identical role to satisfy strict turn-alternation
    if (normalized.length > 0 && normalized[normalized.length - 1].role === targetRole) {
      normalized[normalized.length - 1].parts.push(...parts);
    } else {
      normalized.push({ role: targetRole, parts });
    }
  }

  // Conversation must start with a 'user' turn
  while (normalized.length > 0 && normalized[0].role === 'model') {
    normalized.shift();
  }

  if (normalized.length === 0) {
    normalized.push({ role: 'user', parts: [{ text: 'Hello!' }] });
  }

  return normalized;
}

const SYSTEM_INSTRUCTION =
  'You are FRIEND OS AI, a fast, friendly, and highly capable study buddy & academic tutor in Friend OS. Respond concisely, accurately, and immediately. Support English, Hindi, Hinglish, and regional languages. Format solutions with clean Markdown headers, bold key points, and concise code blocks. Deliver answers quickly without unnecessary fluff.';

// Prioritize ultra-fast low-latency models first
const GEMINI_CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 1. Health Check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // 2. Full Multi-Modal AI Chat Endpoint (Google Gemini with SSE Streaming & Fallback)
  app.post('/api/ai/chat', async (req: Request, res: Response): Promise<void> => {
    try {
      const { messages = [], stream = true } = req.body || {};
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        if (stream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
          res.write(
            `data: ${JSON.stringify({
              error: 'GEMINI_API_KEY environment variable is not configured. Please configure your API key in project settings.',
            })}\n\n`
          );
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          res.status(500).json({
            error: 'GEMINI_API_KEY environment variable is not configured.',
          });
        }
        return;
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

        // Try streaming across candidate models
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
              console.warn(
                `Model ${candidateModel} (attempt ${attempt + 1}) stream failed:`,
                err?.message || err
              );
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

        // If streaming didn't succeed, fallback to non-streaming generateContent
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
              console.warn(
                `Non-stream fallback ${candidateModel} failed:`,
                err?.message || err
              );
              lastError = err;
            }
          }
        }

        if (!streamSucceeded) {
          const is503 =
            String(lastError?.message || '').includes('503') ||
            String(lastError?.message || '').includes('high demand');
          const friendlyMsg = is503
            ? 'AI servers are momentarily at high demand. Please tap send again in a moment!'
            : lastError?.message || 'Failed to generate response.';
          res.write(`data: ${JSON.stringify({ error: friendlyMsg })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        // Direct non-streaming response
        let reply = '';
        let success = false;
        let lastErr: any = null;

        for (const candidateModel of GEMINI_CANDIDATE_MODELS) {
          for (let attempt = 0; attempt < 2; attempt++) {
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
              const errStr = String(err?.message || JSON.stringify(err || ''));
              const is503 =
                errStr.includes('503') ||
                errStr.includes('UNAVAILABLE') ||
                errStr.includes('high demand');
              console.warn(
                `Non-streaming ${candidateModel} (attempt ${attempt + 1}) failed:`,
                err?.message || err
              );
              lastErr = err;
              if (is503 && attempt === 0) {
                await new Promise((r) => setTimeout(r, 400));
                continue;
              }
              break;
            }
          }
          if (success) break;
        }

        if (!success) {
          throw lastErr || new Error('All AI models are currently busy. Please try again.');
        }

        res.json({ response: reply });
      }
    } catch (err: any) {
      console.error('AI Request Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'AI request failed' });
      }
    }
  });

  // 3. Extract Document Content (DOCX to Plain Text)
  app.post('/api/ai/extract-doc', async (req: Request, res: Response): Promise<void> => {
    try {
      const { base64Data } = req.body || {};
      if (!base64Data) {
        res.status(400).json({ error: 'No base64 data provided' });
        return;
      }

      const cleanBase64 = base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data;
      const buffer = Buffer.from(cleanBase64, 'base64');
      const mammothResult = await mammoth.extractRawText({ buffer });

      res.json({ text: mammothResult.value || '' });
    } catch (err: any) {
      console.error('DOCX Extraction Error:', err);
      res.status(500).json({ error: err.message || 'Failed to extract text from document' });
    }
  });

  // 4. College Tutor Endpoint
  app.post('/api/ai/college-tutor', async (req: Request, res: Response): Promise<void> => {
    try {
      const { prompt, college } = req.body || {};
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      let replyText = '';
      let tutorSuccess = false;
      let lastErr: any = null;

      for (const candidateModel of GEMINI_CANDIDATE_MODELS) {
        for (let attempt = 0; attempt < 2; attempt++) {
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
            const errStr = String(err?.message || JSON.stringify(err || ''));
            const is503 =
              errStr.includes('503') ||
              errStr.includes('UNAVAILABLE') ||
              errStr.includes('high demand');
            console.warn(
              `College tutor ${candidateModel} (attempt ${attempt + 1}) failed:`,
              err?.message || err
            );
            lastErr = err;
            if (is503 && attempt === 0) {
              await new Promise((r) => setTimeout(r, 400));
              continue;
            }
            break;
          }
        }
        if (tutorSuccess) break;
      }

      if (!tutorSuccess) {
        throw lastErr || new Error('All AI models are currently busy. Please try again.');
      }

      res.json({ response: replyText });
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      res.status(500).json({ error: err.message || 'AI request failed' });
    }
  });

  // 5. Vite Middleware (Dev) or Static dist serving (Production)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Friend OS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
