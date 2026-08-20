import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';

// Sanitize messages for Gemini multi-turn API
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
  'You are FRIEND OS AI, a friendly, intelligent, and versatile AI companion, academic tutor, and study assistant in Friend OS. You answer accurately, thoughtfully, and clearly in whatever language the user communicates in (English, Hindi, Hinglish, Marathi, etc.). Assist students with detailed explanations, homework, coding solutions, math step-by-step reasoning, document summaries, exam prep, and daily campus life. Use clean Markdown with headers, bold points, code blocks, and structured lists.';

const GEMINI_CANDIDATE_MODELS = [
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

function friendOSAiPlugin() {
  return {
    name: 'friend-os-ai-server',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        // 1. Full Multi-Modal AI Chat Endpoint (Google Gemini with SSE Streaming & Fallback)
        if (req.url === '/api/ai/chat' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}');
              const { messages = [], stream = true } = payload;

              const apiKey = process.env.GEMINI_API_KEY;
              if (!apiKey) {
                if (stream) {
                  res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                  });
                  res.write(`data: ${JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not configured.' })}\n\n`);
                  res.write('data: [DONE]\n\n');
                  res.end();
                } else {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not configured.' }));
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
                  'Connection': 'keep-alive',
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
                      const is503 = errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand');
                      console.warn(`Model ${candidateModel} (attempt ${attempt + 1}) stream failed:`, err?.message || err);
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

                // If streaming didn't succeed, fallback to non-streaming generateContent and send as chunks
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
                      console.warn(`Non-stream fallback ${candidateModel} failed:`, err?.message || err);
                      lastError = err;
                    }
                  }
                }

                if (!streamSucceeded) {
                  const is503 = String(lastError?.message || '').includes('503') || String(lastError?.message || '').includes('high demand');
                  const friendlyMsg = is503
                    ? 'AI servers are momentarily at high demand. Please tap send again in a moment!'
                    : (lastError?.message || 'Failed to generate response.');
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
                      const is503 = errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand');
                      console.warn(`Non-streaming ${candidateModel} (attempt ${attempt + 1}) failed:`, err?.message || err);
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

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ response: reply }));
              }
            } catch (err: any) {
              console.error('AI Request Error:', err);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'AI request failed' }));
              }
            }
          });
          return;
        }

        // 2. Extract Document Content (DOCX to Plain Text)
        if (req.url === '/api/ai/extract-doc' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const { base64Data } = JSON.parse(body || '{}');
              if (!base64Data) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'No base64 data provided' }));
                return;
              }

              const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
              const buffer = Buffer.from(cleanBase64, 'base64');
              const mammothResult = await mammoth.extractRawText({ buffer });
              
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ text: mammothResult.value || '' }));
            } catch (err: any) {
              console.error('DOCX Extraction Error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Failed to extract text from document' }));
            }
          });
          return;
        }

        // 3. College Tutor Endpoint
        if (req.url === '/api/ai/college-tutor' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const { prompt, college } = JSON.parse(body || '{}');
              const apiKey = process.env.GEMINI_API_KEY;
              if (!apiKey) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }));
                return;
              }

              const ai = new GoogleGenAI({
                apiKey,
                httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
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
                        systemInstruction: `You are FRIEND OS AI, a friendly college study buddy and academic tutor for students at ${college || 'college'}. Answer questions clearly in English, Hindi, or Hinglish with markdown, math/code step-by-step explanations, and an encouraging college student tone. Keep answers concise, clear, and actionable.`
                      }
                    });
                    replyText = response.text || '';
                    tutorSuccess = true;
                    break;
                  } catch (err: any) {
                    const errStr = String(err?.message || JSON.stringify(err || ''));
                    const is503 = errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand');
                    console.warn(`College tutor ${candidateModel} (attempt ${attempt + 1}) failed:`, err?.message || err);
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

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ response: replyText }));
            } catch (err: any) {
              console.error('Gemini API Error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'AI request failed' }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), friendOSAiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

