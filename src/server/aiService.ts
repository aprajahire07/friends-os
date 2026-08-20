import { GoogleGenAI } from '@google/genai';
import mammoth from 'mammoth';

export interface ChatAttachmentPayload {
  name: string;
  type: string;
  base64Data?: string;
  textContent?: string;
  size?: number;
}

export interface ChatMessagePayload {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: ChatAttachmentPayload[];
}

export interface ChatRequestPayload {
  provider: 'openai' | 'gemini';
  messages: ChatMessagePayload[];
  stream?: boolean;
}

const SYSTEM_PROMPT = `You are FRIEND OS AI, a friendly, powerful, and intelligent AI assistant built into the Friend OS college operating system.
You can:
- Answer general and complex academic questions, code, math, and STEM reasoning.
- Analyze images, charts, handwriting, diagrams, and photos in detail.
- Read, summarize, and answer deep questions about uploaded PDF notes, assignments, and study materials.
- Read and analyze DOC/DOCX documents, extract key takeaways, generate quiz questions, and write structured notes.
- Maintain context across follow-up questions within the multi-turn conversation.

Formatting rules:
- Use clean, well-formatted Markdown with bold titles, lists, bullet points, and code blocks with syntax highlighting.
- Be concise, supportive, helpful, and academically thorough when answering student questions.`;

/**
 * Handle Gemini Chat Generation
 */
export async function handleGeminiChat(
  messages: ChatMessagePayload[],
  onChunk?: (text: string) => void
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Convert incoming messages into Gemini contents format with strict alternation & sanitization
  const contents: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

  for (const msg of messages) {
    if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) continue;
    const targetRole = msg.role === 'assistant' ? 'model' : 'user';
    const parts: any[] = [];

    // 1. Process attachments
    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        const mimeType = att.type?.toLowerCase() || '';

        // Image handling (PNG, JPEG, WEBP, GIF)
        if (mimeType.startsWith('image/') && att.base64Data) {
          const cleanBase64 = att.base64Data.includes(',')
            ? att.base64Data.split(',')[1]
            : att.base64Data;
          parts.push({
            inlineData: {
              mimeType: att.type || 'image/jpeg',
              data: cleanBase64,
            },
          });
        }
        // PDF handling
        else if (mimeType === 'application/pdf' && att.base64Data) {
          const cleanBase64 = att.base64Data.includes(',')
            ? att.base64Data.split(',')[1]
            : att.base64Data;
          parts.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: cleanBase64,
            },
          });
        }
        // DOC/DOCX/TXT or extracted text document
        else if (att.textContent) {
          parts.push({
            text: `\n[Attached Document: ${att.name || 'File'}]\n${att.textContent}\n[End of Document]\n`,
          });
        }
      }
    }

    // 2. Add message text content
    if (msg.content && msg.content.trim()) {
      parts.push({
        text: msg.content.trim(),
      });
    }

    if (parts.length === 0) continue;

    // Strict alternation merge
    if (contents.length > 0 && contents[contents.length - 1].role === targetRole) {
      contents[contents.length - 1].parts.push(...parts);
    } else {
      contents.push({ role: targetRole, parts });
    }
  }

  // Conversation must start with 'user'
  while (contents.length > 0 && contents[0].role === 'model') {
    contents.shift();
  }

  if (contents.length === 0) {
    contents.push({
      role: 'user',
      parts: [{ text: 'Hello!' }],
    });
  }

  // Candidate model list with automatic fallback on 503 high demand or quota issues
  const candidateModels = [
    'gemini-3.7-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
  ];

  if (onChunk) {
    // Streaming response with model fallback
    let streamSucceeded = false;
    let fullText = '';
    let lastError: any = null;

    for (const modelName of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const stream = await ai.models.generateContentStream({
            model: modelName,
            contents,
            config: {
              systemInstruction: SYSTEM_PROMPT,
            },
          });

          for await (const chunk of stream) {
            const chunkText = chunk.text || '';
            if (chunkText) {
              fullText += chunkText;
              onChunk(chunkText);
            }
          }
          streamSucceeded = true;
          break;
        } catch (err: any) {
          const errStr = String(err?.message || JSON.stringify(err || ''));
          const is503 = errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand');
          console.warn(`[AI Service] Model ${modelName} stream (attempt ${attempt + 1}) failed:`, err?.message || err);
          lastError = err;
          if (is503 && attempt === 0) {
            await new Promise((r) => setTimeout(r, 450));
            continue;
          }
          break;
        }
      }
      if (streamSucceeded) break;
    }

    if (!streamSucceeded) {
      throw lastError || new Error('All AI models are currently busy. Please try again in a few moments.');
    }

    return fullText;
  } else {
    // Non-streaming response with model fallback
    let nonStreamSuccess = false;
    let replyText = '';
    let lastError: any = null;

    for (const modelName of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction: SYSTEM_PROMPT,
            },
          });

          replyText = response.text || '';
          nonStreamSuccess = true;
          break;
        } catch (err: any) {
          const errStr = String(err?.message || JSON.stringify(err || ''));
          const is503 = errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand');
          console.warn(`[AI Service] Model ${modelName} (attempt ${attempt + 1}) failed:`, err?.message || err);
          lastError = err;
          if (is503 && attempt === 0) {
            await new Promise((r) => setTimeout(r, 450));
            continue;
          }
          break;
        }
      }
      if (nonStreamSuccess) break;
    }

    if (!nonStreamSuccess) {
      throw lastError || new Error('All AI models are currently busy. Please try again in a few moments.');
    }

    return replyText;
  }
}

/**
 * Handle OpenAI / ChatGPT Generation
 */
export async function handleOpenAIChat(
  messages: ChatMessagePayload[],
  onChunk?: (text: string) => void
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'MY_OPENAI_API_KEY') {
    throw new Error(
      'OPENAI_API_KEY is not configured in server environment variables. Please set OPENAI_API_KEY or select Google Gemini which is ready to use!'
    );
  }

  // Format messages for OpenAI API
  const formattedMessages: any[] = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
  ];

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    if (msg.role === 'assistant') {
      formattedMessages.push({
        role: 'assistant',
        content: msg.content || '',
      });
      continue;
    }

    // User message: could be multi-modal with image_url or document text
    const contentParts: any[] = [];
    let docContextText = '';

    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        const mimeType = att.type?.toLowerCase() || '';

        if (mimeType.startsWith('image/') && att.base64Data) {
          const cleanBase64 = att.base64Data.includes(',')
            ? att.base64Data
            : `data:${att.type || 'image/jpeg'};base64,${att.base64Data}`;

          contentParts.push({
            type: 'image_url',
            image_url: {
              url: cleanBase64,
              detail: 'auto',
            },
          });
        } else if (att.textContent) {
          docContextText += `\n[Attached Document: ${att.name}]\n${att.textContent}\n[End of Document]\n`;
        }
      }
    }

    const fullPrompt = `${docContextText}${msg.content || ''}`.trim();
    if (fullPrompt) {
      contentParts.unshift({
        type: 'text',
        text: fullPrompt,
      });
    }

    if (contentParts.length === 0) {
      contentParts.push({ type: 'text', text: '(empty message)' });
    }

    formattedMessages.push({
      role: 'user',
      content: contentParts.length === 1 && contentParts[0].type === 'text'
        ? contentParts[0].text
        : contentParts,
    });
  }

  // OpenAI Chat Completion request
  const isStreaming = Boolean(onChunk);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: formattedMessages,
      stream: isStreaming,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr = errText;
    try {
      const json = JSON.parse(errText);
      parsedErr = json.error?.message || errText;
    } catch {
      // ignore
    }
    throw new Error(`OpenAI API error (${response.status}): ${parsedErr}`);
  }

  if (isStreaming && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onChunk!(delta);
            }
          } catch {
            // Ignore parse errors on partial chunks
          }
        }
      }
    }
    return fullText;
  } else {
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

/**
 * Extract text from DOCX Buffer
 */
export async function extractDocxText(buffer: Buffer | ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({
      buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
    });
    return result.value || '';
  } catch (err: any) {
    console.error('Failed to extract DOCX text:', err);
    throw new Error(`Could not parse DOCX file: ${err.message || 'Corrupted file'}`);
  }
}
