import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AIConversation, AIMessage, AIAttachment, AIProvider } from '../types';
import mammoth from 'mammoth';

const LOCAL_STORAGE_CONVERSATIONS_KEY = 'friend_os_ai_conversations';
const LOCAL_STORAGE_MESSAGES_KEY = 'friend_os_ai_messages';

// Local storage helpers
function getLocalConversations(): AIConversation[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalConversations(convs: AIConversation[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS_KEY, JSON.stringify(convs));
  } catch (e) {
    console.warn('Failed to save AI conversations to localStorage:', e);
  }
}

function getLocalMessages(conversationId?: string): AIMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MESSAGES_KEY);
    const allMsgs: AIMessage[] = raw ? JSON.parse(raw) : [];
    if (conversationId) {
      return allMsgs.filter((m) => m.conversation_id === conversationId);
    }
    return allMsgs;
  } catch {
    return [];
  }
}

function saveLocalMessage(msg: AIMessage) {
  try {
    const allMsgs = getLocalMessages();
    const existingIdx = allMsgs.findIndex((m) => m.id === msg.id);
    if (existingIdx >= 0) {
      allMsgs[existingIdx] = msg;
    } else {
      allMsgs.push(msg);
    }
    localStorage.setItem(LOCAL_STORAGE_MESSAGES_KEY, JSON.stringify(allMsgs));
  } catch (e) {
    console.warn('Failed to save AI message to localStorage:', e);
  }
}

function deleteLocalConversation(conversationId: string) {
  try {
    const convs = getLocalConversations().filter((c) => c.id !== conversationId);
    saveLocalConversations(convs);
    const msgs = getLocalMessages().filter((m) => m.conversation_id !== conversationId);
    localStorage.setItem(LOCAL_STORAGE_MESSAGES_KEY, JSON.stringify(msgs));
  } catch (e) {
    console.warn('Failed to delete local AI conversation:', e);
  }
}

/**
 * Fetch all AI Conversations for user
 */
export async function fetchUserAIConversations(userId: string): Promise<AIConversation[]> {
  const localConvs = getLocalConversations().filter((c) => !c.user_id || c.user_id === userId);

  if (!isSupabaseConfigured || !supabase || !userId) {
    return localConvs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  try {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch ai_conversations error:', error.message);
      return localConvs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }

    if (data && data.length > 0) {
      // Merge with local storage
      const remoteConvs = data as AIConversation[];
      saveLocalConversations(remoteConvs);
      return remoteConvs;
    }

    return localConvs;
  } catch (err) {
    console.warn('Error fetching AI conversations:', err);
    return localConvs;
  }
}

/**
 * Fetch messages for a specific conversation
 */
export async function fetchAIConversationMessages(conversationId: string): Promise<AIMessage[]> {
  const localMsgs = getLocalMessages(conversationId);

  if (!isSupabaseConfigured || !supabase || !conversationId) {
    return localMsgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  try {
    const { data, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetch ai_messages error:', error.message);
      return localMsgs;
    }

    if (data && data.length > 0) {
      const messages = data as AIMessage[];
      // Cache messages locally
      for (const m of messages) {
        saveLocalMessage(m);
      }
      return messages;
    }

    return localMsgs;
  } catch (err) {
    console.warn('Error fetching AI messages:', err);
    return localMsgs;
  }
}

/**
 * Create a new AI conversation
 */
export async function createAIConversation(
  userId: string,
  provider: AIProvider,
  title: string = 'New Chat'
): Promise<AIConversation> {
  const newConv: AIConversation = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    user_id: userId,
    provider,
    title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    messages: [],
  };

  saveLocalConversations([newConv, ...getLocalConversations().filter((c) => c.id !== newConv.id)]);

  if (isSupabaseConfigured && supabase && userId) {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          id: newConv.id,
          user_id: userId,
          provider,
          title,
          created_at: newConv.created_at,
          updated_at: newConv.updated_at,
        })
        .select()
        .single();

      if (!error && data) {
        return data as AIConversation;
      }
    } catch (e) {
      console.warn('Supabase insert ai_conversation fallback to local:', e);
    }
  }

  return newConv;
}

/**
 * Save an AI message (User or Assistant)
 */
export async function saveAIMessage(msg: AIMessage): Promise<AIMessage> {
  saveLocalMessage(msg);

  // Update local conversation updated_at
  const convs = getLocalConversations();
  const convIdx = convs.findIndex((c) => c.id === msg.conversation_id);
  if (convIdx >= 0) {
    convs[convIdx].updated_at = new Date().toISOString();
    // If conversation title is default and user sends message, generate smart title from content
    if (convs[convIdx].title === 'New Chat' && msg.role === 'user' && msg.content) {
      const cleanTitle = msg.content.slice(0, 36).replace(/\n/g, ' ').trim();
      convs[convIdx].title = cleanTitle || 'New Chat';
    }
    saveLocalConversations(convs);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('ai_messages').insert({
        id: msg.id,
        conversation_id: msg.conversation_id,
        user_id: msg.user_id,
        role: msg.role,
        content: msg.content,
        attachments: msg.attachments || [],
        created_at: msg.created_at,
      });

      if (!error && convIdx >= 0) {
        await supabase
          .from('ai_conversations')
          .update({
            title: convs[convIdx].title,
            updated_at: new Date().toISOString(),
          })
          .eq('id', msg.conversation_id);
      }
    } catch (e) {
      console.warn('Supabase insert ai_message fallback to local:', e);
    }
  }

  return msg;
}

/**
 * Delete an AI conversation
 */
export async function deleteAIConversation(conversationId: string): Promise<void> {
  deleteLocalConversation(conversationId);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('ai_conversations').delete().eq('id', conversationId);
      await supabase.from('ai_messages').delete().eq('conversation_id', conversationId);
    } catch (e) {
      console.warn('Supabase delete ai_conversation error:', e);
    }
  }
}

/**
 * Update AI Conversation title
 */
export async function updateAIConversationTitle(conversationId: string, title: string): Promise<void> {
  const convs = getLocalConversations();
  const conv = convs.find((c) => c.id === conversationId);
  if (conv) {
    conv.title = title;
    conv.updated_at = new Date().toISOString();
    saveLocalConversations(convs);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('ai_conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (e) {
      console.warn('Supabase update conversation title error:', e);
    }
  }
}

/**
 * Extract Attachment from a device file (Image, PDF, DOC/DOCX, TXT)
 */
export async function extractFileForAI(file: File): Promise<AIAttachment> {
  const fileId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fileName = file.name;
  const fileSize = file.size;
  let fileType = file.type || '';

  // Infer mime type by extension if empty
  const lowerName = fileName.toLowerCase();
  if (!fileType) {
    if (lowerName.endsWith('.pdf')) fileType = 'application/pdf';
    else if (lowerName.endsWith('.docx'))
      fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (lowerName.endsWith('.doc')) fileType = 'application/msword';
    else if (lowerName.endsWith('.png')) fileType = 'image/png';
    else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) fileType = 'image/jpeg';
    else if (lowerName.endsWith('.webp')) fileType = 'image/webp';
    else fileType = 'text/plain';
  }

  // 1. Images
  if (fileType.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        resolve({
          id: fileId,
          name: fileName,
          type: fileType,
          size: fileSize,
          previewUrl: base64Data,
          base64Data,
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  // 2. PDFs
  if (fileType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        resolve({
          id: fileId,
          name: fileName,
          type: 'application/pdf',
          size: fileSize,
          base64Data,
          previewUrl: undefined,
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  // 3. DOCX documents
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx')
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Try mammoth directly in browser
      const result = await mammoth.extractRawText({ arrayBuffer });
      const extractedText = result.value || '';

      // Also get base64 representation
      const base64Data = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(file);
      });

      return {
        id: fileId,
        name: fileName,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: fileSize,
        textContent: extractedText,
        base64Data,
      };
    } catch (docxErr) {
      console.warn('Client mammoth docx parse error, attempting server fallback:', docxErr);
      // Fallback to server extraction
      const base64Data = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(file);
      });

      try {
        const res = await fetch('/api/ai/extract-doc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data }),
        });
        const json = await res.json();
        return {
          id: fileId,
          name: fileName,
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: fileSize,
          textContent: json.text || '',
          base64Data,
        };
      } catch (serverErr) {
        return {
          id: fileId,
          name: fileName,
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: fileSize,
          base64Data,
        };
      }
    }
  }

  // 4. Plain text / Markdown / code files / DOC fallback
  try {
    const textContent = await file.text();
    return {
      id: fileId,
      name: fileName,
      type: fileType || 'text/plain',
      size: fileSize,
      textContent,
    };
  } catch (textErr) {
    const base64Data = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(file);
    });
    return {
      id: fileId,
      name: fileName,
      type: fileType || 'application/octet-stream',
      size: fileSize,
      base64Data,
    };
  }
}

/**
 * Format bytes to readable size (e.g. 1.2 MB, 340 KB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Stream AI Response via Server-Sent Events
 */
export async function streamAIChat({
  provider,
  messages,
  onChunk,
  onDone,
  onError,
  abortSignal,
}: {
  provider: AIProvider;
  messages: AIMessage[];
  onChunk: (delta: string) => void;
  onDone: (fullText: string) => void;
  onError: (err: Error) => void;
  abortSignal?: AbortSignal;
}): Promise<void> {
  try {
    const payloadMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments?.map((a) => ({
        name: a.name,
        type: a.type,
        base64Data: a.base64Data,
        textContent: a.textContent,
        size: a.size,
      })),
    }));

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        messages: payloadMessages,
        stream: true,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = errText;
      try {
        const json = JSON.parse(errText);
        errMsg = json.error || errText;
      } catch {}
      throw new Error(errMsg || `AI server returned ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response stream available');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'data: [DONE]') {
          onDone(accumulatedText);
          return;
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.error) {
              throw new Error(data.error);
            }
            if (data.delta) {
              accumulatedText += data.delta;
              onChunk(data.delta);
            }
          } catch (jsonErr: any) {
            if (jsonErr.message && !jsonErr.message.includes('JSON')) {
              throw jsonErr;
            }
          }
        }
      }
    }

    onDone(accumulatedText);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log('AI generation aborted by user.');
      return;
    }
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
