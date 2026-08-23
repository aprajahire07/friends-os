import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  Send,
  Square,
  Paperclip,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  FileText,
  File,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  History,
  Copy,
  CheckCheck,
  RefreshCw,
  AlertCircle,
  Maximize2,
  ShieldCheck,
  Zap,
  RotateCcw,
  Eraser,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import {
  AIConversation,
  AIMessage,
  AIAttachment,
  AIProvider,
} from '../../types';
import {
  fetchUserAIConversations,
  fetchAIConversationMessages,
  createAIConversation,
  saveAIMessage,
  deleteAIConversation,
  updateAIConversationTitle,
  clearAIConversationMessages,
  clearAllUserAIHistory,
  extractFileForAI,
  formatFileSize,
  streamAIChat,
} from '../../services/aiChat';

export const FriendOSAiTab: React.FC = () => {
  const store = useAppStore();
  const currentUser = store.currentUser;
  const { showToast } = useToast();

  // Conversations & Messages State
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini');
  
  // UI & Composer States
  const [inputPrompt, setInputPrompt] = useState('');
  const [attachments, setAttachments] = useState<AIAttachment[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editConvTitle, setEditConvTitle] = useState('');
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [showClearAllHistoryConfirm, setShowClearAllHistoryConfirm] = useState(false);

  // References
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom helper
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  // Initial Load Conversations
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!currentUser?.id) return;
      const convs = await fetchUserAIConversations(currentUser.id);
      if (!isMounted) return;
      setConversations(convs);

      if (convs.length > 0) {
        setActiveConversationId(convs[0].id);
        setSelectedProvider(convs[0].provider || 'gemini');
      } else {
        // Create initial default conversation
        const initial = await createAIConversation(currentUser.id, 'gemini', 'New Chat');
        if (!isMounted) return;
        setConversations([initial]);
        setActiveConversationId(initial.id);
        setSelectedProvider('gemini');
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  // Load Messages for Active Conversation
  useEffect(() => {
    let isMounted = true;
    async function loadMessages() {
      if (!activeConversationId) {
        setMessages([]);
        return;
      }
      const msgs = await fetchAIConversationMessages(activeConversationId);
      if (!isMounted) return;
      setMessages(msgs);
      setTimeout(() => scrollToBottom(false), 80);
    }
    loadMessages();
    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  // Auto-scroll when new messages or streaming text updates
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, streamingText, isGenerating]);

  // Auto resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputPrompt(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  // Handle Provider Selection
  const handleSelectProvider = async (provider: AIProvider) => {
    if (provider === selectedProvider) return;
    setSelectedProvider(provider);

    // If current conversation has no messages, update its provider
    if (activeConversationId) {
      const currentConv = conversations.find((c) => c.id === activeConversationId);
      if (currentConv && messages.length === 0) {
        currentConv.provider = provider;
        setConversations([...conversations]);
      }
    }
  };

  // Create New Chat
  const handleNewChat = async (providerOverride?: AIProvider) => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }

    const providerToUse = providerOverride || selectedProvider;
    const newConv = await createAIConversation(currentUser.id, providerToUse, 'New Chat');
    setConversations([newConv, ...conversations.filter((c) => c.id !== newConv.id)]);
    setActiveConversationId(newConv.id);
    setSelectedProvider(providerToUse);
    setMessages([]);
    setAttachments([]);
    setInputPrompt('');
    setShowHistoryDrawer(false);
    showToast('New Chat Started', 'Ready to chat with Google Gemini AI', 'info');
  };

  // Handle File Selection (Images, PDFs, DOC/DOCX, TXT)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);
    const newAttachments: AIAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // File size validation (25MB max)
      if (file.size > 25 * 1024 * 1024) {
        showToast('File Too Large', `${file.name} exceeds the 25MB limit.`, 'error');
        continue;
      }

      try {
        const att = await extractFileForAI(file);
        newAttachments.push(att);
      } catch (err: any) {
        console.error('File read error:', err);
        showToast('Attachment Error', `Failed to read ${file.name}: ${err.message || 'Unknown error'}`, 'error');
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    setIsProcessingFile(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment
  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Send Message
  const handleSendMessage = async (customPrompt?: string) => {
    let promptToSend = (customPrompt || inputPrompt).trim();
    if ((!promptToSend && attachments.length === 0) || isGenerating) return;

    if (!promptToSend && attachments.length > 0) {
      const fileNames = attachments.map((a) => a.name).join(', ');
      promptToSend = `Please analyze, explain, and review the attached file (${fileNames}) in detail.`;
    }

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      const created = await createAIConversation(currentUser.id, selectedProvider, 'New Chat');
      setConversations((prev) => [created, ...prev]);
      setActiveConversationId(created.id);
      targetConvId = created.id;
    }

    const userMessage: AIMessage = {
      id: `msg_user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversation_id: targetConvId,
      user_id: currentUser.id,
      role: 'user',
      content: promptToSend,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      created_at: new Date().toISOString(),
    };

    // Append to UI immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputPrompt('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Persist user message
    await saveAIMessage(userMessage);

    // Prepare for streaming AI response
    setIsGenerating(true);
    setStreamingText('');

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    const assistantMsgId = `msg_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await streamAIChat({
      provider: selectedProvider,
      messages: updatedMessages,
      abortSignal: abortCtrl.signal,
      onChunk: (chunk) => {
        setStreamingText((prev) => prev + chunk);
      },
      onDone: async (finalText) => {
        setIsGenerating(false);
        setStreamingText('');

        const finalContent = finalText.trim() || 'No response generated.';
        const assistantMessage: AIMessage = {
          id: assistantMsgId,
          conversation_id: targetConvId!,
          user_id: currentUser.id,
          role: 'assistant',
          content: finalContent,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        await saveAIMessage(assistantMessage);

        // Update conversation list title in UI
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === targetConvId) {
              return {
                ...c,
                updated_at: new Date().toISOString(),
                title: c.title === 'New Chat' ? promptToSend.slice(0, 34) || c.title : c.title,
              };
            }
            return c;
          })
        );
      },
      onError: (err) => {
        setIsGenerating(false);
        setStreamingText('');
        showToast('AI Error', err.message || 'Failed to generate response.', 'error');

        // Add error message in chat
        const errorAssistantMessage: AIMessage = {
          id: assistantMsgId,
          conversation_id: targetConvId!,
          user_id: currentUser.id,
          role: 'assistant',
          content: `⚠️ **Error Generating Response:**\n\n${err.message}\n\n*Please ensure your GEMINI_API_KEY is configured in your project settings, or tap send again in a moment.*`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorAssistantMessage]);
        saveAIMessage(errorAssistantMessage);
      },
    });
  };

  // Stop Generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);

      if (streamingText.trim()) {
        const assistantMessage: AIMessage = {
          id: `msg_ai_stopped_${Date.now()}`,
          conversation_id: activeConversationId!,
          user_id: currentUser.id,
          role: 'assistant',
          content: `${streamingText}\n\n*(Generation stopped by user)*`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        saveAIMessage(assistantMessage);
      }
      setStreamingText('');
      showToast('Stopped', 'AI response generation paused.', 'info');
    }
  };

  // Delete Conversation
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this AI conversation and all its history?')) return;

    await deleteAIConversation(convId);
    const filtered = conversations.filter((c) => c.id !== convId);
    setConversations(filtered);

    if (activeConversationId === convId) {
      if (filtered.length > 0) {
        setActiveConversationId(filtered[0].id);
        setSelectedProvider(filtered[0].provider || 'gemini');
      } else {
        handleNewChat();
      }
    }
    showToast('Deleted', 'Conversation removed.', 'info');
  };

  // Clear Active Chat Messages
  const handleClearCurrentChat = async () => {
    if (!activeConversationId) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setStreamingText('');
    await clearAIConversationMessages(activeConversationId);
    setMessages([]);
    setShowClearChatConfirm(false);
    showToast('Chat Cleared', 'Messages in this conversation have been wiped.', 'info');
  };

  // Clear All AI Conversations & History
  const handleClearAllHistory = async () => {
    if (!currentUser?.id) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setStreamingText('');
    await clearAllUserAIHistory(currentUser.id);
    const newConv = await createAIConversation(currentUser.id, 'gemini', 'New Chat');
    setConversations([newConv]);
    setActiveConversationId(newConv.id);
    setMessages([]);
    setAttachments([]);
    setInputPrompt('');
    setShowClearAllHistoryConfirm(false);
    setShowHistoryDrawer(false);
    showToast('History Cleared', 'All AI conversations have been deleted.', 'info');
  };

  // Save Renamed Conversation Title
  const handleSaveConvTitle = async (convId: string) => {
    if (!editConvTitle.trim()) {
      setEditingConvId(null);
      return;
    }
    await updateAIConversationTitle(convId, editConvTitle.trim());
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, title: editConvTitle.trim() } : c))
    );
    setEditingConvId(null);
    showToast('Updated', 'Conversation renamed.', 'success');
  };

  // Copy Message Text
  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    showToast('Copied', 'Message copied to clipboard.', 'success');
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Quick Starter Prompts
  const STARTER_PROMPTS = [
    {
      title: 'Summarize Notes / PDF',
      desc: 'Attach a lecture PDF or DOCX to generate concise revision bullet points.',
      prompt: 'Please explain and summarize the key concepts, formulas, and definitions from my attached document in a clear, study-friendly format.',
    },
    {
      title: 'Code & DSA Tutor',
      desc: 'Solve programming problems with step-by-step logic & complexity analysis.',
      prompt: 'Can you help me solve this DSA problem? Provide the optimal approach, clean code with comments, and time/space complexity analysis.',
    },
    {
      title: 'Math & Proof Solver',
      desc: 'Step-by-step breakdown of DMGT, Linear Algebra, or Calculus problems.',
      prompt: 'Solve this step-by-step with all mathematical intermediate working, theorems used, and final result clearly boxed.',
    },
    {
      title: 'Assignment & Essay Help',
      desc: 'Draft structured outlines, citations, and polished explanations.',
      prompt: 'Help me outline and structure an academic response for this topic, including key sections, arguments, and supporting details.',
    },
  ];

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] md:h-[calc(100vh-4.8rem)] max-w-5xl mx-auto w-full relative bg-slate-950 text-slate-100 overflow-hidden select-text">
      {/* 1. TOP HEADER & COMPACT PROVIDER SELECTOR */}
      <header className="px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between gap-3 z-20 flex-shrink-0">
        {/* Left: Brand & History Toggle */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 flex items-center gap-1.5"
            title="Chat History"
            aria-label="Toggle history"
          >
            <History className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold hidden sm:inline">History</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                <span>🤖 Friend OS AI</span>
              </h1>
              <p className="text-[10px] text-slate-400 truncate max-w-[120px] sm:max-w-[200px]">
                {activeConv?.title || 'New Chat'}
              </p>
            </div>
          </div>
        </div>

        {/* Center: AI Engine Status Indicator */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-2xl border border-slate-800 shadow-inner">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-indigo-400 bg-clip-text text-transparent">
              Google Gemini
            </span>
          </div>
        </div>

        {/* Right: Actions (Clear Chat & + New Chat) */}
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearChatConfirm(true)}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-red-950/50 hover:text-red-300 text-slate-400 border border-slate-700/60 active:scale-95 text-xs font-medium flex items-center gap-1.5 transition-all"
              title="Clear this Chat"
              aria-label="Clear chat messages"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-400" />
              <span className="hidden md:inline">Clear Chat</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleNewChat()}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
        </div>
      </header>

      {/* 2. CHAT HISTORY SLIDE-OVER DRAWER (Responsive for Mobile and Desktop) */}
      {showHistoryDrawer && (
        <div className="absolute inset-0 z-30 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setShowHistoryDrawer(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 sm:w-80 h-full bg-slate-900 border-r border-slate-800 p-4 flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Chat History
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg bg-slate-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleNewChat()}
              className="mt-3 w-full py-2 px-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Start New Conversation</span>
            </button>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto mt-3 space-y-1.5 pr-1">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No previous conversations yet.
                </div>
              ) : (
                conversations.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  const isEditing = editingConvId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setActiveConversationId(conv.id);
                        setSelectedProvider(conv.provider || 'gemini');
                        setShowHistoryDrawer(false);
                      }}
                      className={`group relative p-2.5 rounded-xl text-left text-xs font-medium cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-indigo-600 text-white font-bold shadow-md'
                          : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-300 border border-slate-800/60'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-1">
                        {isEditing ? (
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editConvTitle}
                              onChange={(e) => setEditConvTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveConvTitle(conv.id);
                                if (e.key === 'Escape') setEditingConvId(null);
                              }}
                              autoFocus
                              className="w-full bg-slate-900 text-white text-xs px-2 py-1 rounded border border-indigo-400 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveConvTitle(conv.id)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingConvId(null)}
                              className="p-1 text-slate-400 hover:text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="truncate">{conv.title || 'Untitled Chat'}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] opacity-80">
                              <span className="px-1 py-0.2 rounded font-mono text-[9px] bg-indigo-500/20 text-cyan-300">
                                Gemini
                              </span>
                              <span>
                                {new Date(conv.updated_at).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {!isEditing && (
                        <div
                          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingConvId(conv.id);
                              setEditConvTitle(conv.title);
                            }}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700/50"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                            className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-950/50"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom: Clear All History Action */}
            {conversations.length > 0 && (
              <div className="pt-3 border-t border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={() => setShowClearAllHistoryConfirm(true)}
                  className="w-full py-2 px-3 rounded-xl bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 text-red-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Clear All Chat History</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN CHAT MESSAGES THREAD */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Empty State / Welcome Screen */}
        {messages.length === 0 && !isGenerating && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-xl mx-auto py-8">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-2xl shadow-indigo-600/30 mb-4 animate-bounce duration-1000">
              <Sparkles className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-black text-white">Friend OS AI</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              Ask anything, solve academic math/coding problems, or upload lecture notes, images, PDFs, and Word documents for deep analysis.
            </p>

            <div className="mt-3 flex items-center gap-2 text-[11px] bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Private & isolated: No access to your private chats or money history.</span>
            </div>

            {/* Quick Starter Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 w-full text-left">
              {STARTER_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(item.prompt)}
                  className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 transition-all text-left flex flex-col justify-between group shadow-sm"
                >
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      {item.desc}
                    </p>
                  </div>
                  <span className="text-[10px] text-indigo-400 font-semibold mt-2.5 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Use prompt →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Bubbles */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} group`}
            >
              {/* AI Avatar */}
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-md">
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                </div>
              )}

              {/* Message Content Container */}
              <div
                className={`max-w-[88%] sm:max-w-[78%] rounded-3xl p-4 shadow-md ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                }`}
              >
                {/* Attached Files rendering in message */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {msg.attachments.map((att, attIdx) => {
                        const isImg = att.type?.startsWith('image/') || att.previewUrl;
                        const isPdf = att.type === 'application/pdf' || att.name.toLowerCase().endsWith('.pdf');
                        const isDoc =
                          att.type?.includes('word') ||
                          att.name.toLowerCase().endsWith('.docx') ||
                          att.name.toLowerCase().endsWith('.doc');

                        return (
                          <div
                            key={attIdx}
                            className={`flex items-center gap-2 p-2 rounded-xl text-xs ${
                              isUser
                                ? 'bg-indigo-700/80 border border-indigo-500/40 text-white'
                                : 'bg-slate-950 border border-slate-800 text-slate-200'
                            }`}
                          >
                            {isImg && att.previewUrl ? (
                              <div
                                onClick={() => setPreviewImageModal(att.previewUrl || null)}
                                className="relative w-12 h-12 rounded-lg overflow-hidden cursor-pointer group/img flex-shrink-0"
                              >
                                <img
                                  src={att.previewUrl}
                                  alt={att.name}
                                  className="w-full h-full object-cover group-hover/img:scale-110 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                  <Maximize2 className="w-3.5 h-3.5 text-white" />
                                </div>
                              </div>
                            ) : isPdf ? (
                              <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
                                <File className="w-4 h-4" />
                              </div>
                            ) : isDoc ? (
                              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-700/50 text-slate-300 flex items-center justify-center flex-shrink-0">
                                <Paperclip className="w-4 h-4" />
                              </div>
                            )}

                            <div className="min-w-0 pr-1">
                              <p className="font-bold truncate text-[11px] max-w-[150px]">
                                {att.name}
                              </p>
                              <p className="text-[9px] opacity-75">
                                {formatFileSize(att.size || 0)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Message Body */}
                {isUser ? (
                  <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </p>
                ) : (
                  <div className="text-xs sm:text-sm leading-relaxed prose prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2 prose-code:bg-slate-950 prose-code:p-1 prose-code:rounded prose-pre:bg-slate-950 prose-pre:p-3 prose-pre:rounded-xl">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}

                {/* Footer bar with Timestamp & Copy */}
                <div
                  className={`mt-2 flex items-center justify-between text-[10px] ${
                    isUser ? 'text-indigo-200' : 'text-slate-400'
                  }`}
                >
                  <span>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-all flex items-center gap-1"
                      title="Copy response"
                    >
                      {copiedMsgId === msg.id ? (
                        <CheckCheck className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Active Streaming Response Bubble */}
        {isGenerating && (
          <div className="flex gap-3 justify-start animate-in fade-in duration-150">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-md animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>

            <div className="max-w-[88%] sm:max-w-[78%] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl rounded-tl-none p-4 shadow-md">
              {streamingText ? (
                <div className="text-xs sm:text-sm leading-relaxed prose prose-invert max-w-none">
                  <ReactMarkdown>{streamingText}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                    <span
                      className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
                      style={{ animationDelay: '0.4s' }}
                    />
                  </div>
                  <span>Thinking & processing query...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. BOTTOM COMPOSER & ATTACHMENT PREVIEW */}
      <footer className="p-3 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-20 flex-shrink-0 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-4">
        {/* Pending Attachment Chips Bar */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 p-2 bg-slate-950 rounded-2xl border border-slate-800 max-h-32 overflow-y-auto">
            {attachments.map((att) => {
              const isImg = att.type?.startsWith('image/') || att.previewUrl;
              const isPdf = att.type === 'application/pdf';
              const isDoc = att.type?.includes('word');

              return (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-indigo-500/30 text-xs text-slate-200"
                >
                  {isImg && att.previewUrl ? (
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      className="w-6 h-6 rounded object-cover"
                    />
                  ) : isPdf ? (
                    <File className="w-4 h-4 text-red-400" />
                  ) : isDoc ? (
                    <FileText className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Paperclip className="w-4 h-4 text-indigo-400" />
                  )}

                  <span className="truncate max-w-[120px] font-medium">{att.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({formatFileSize(att.size)})
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Input Bar Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Attachment Button */}
          <button
            type="button"
            disabled={isGenerating || isProcessingFile}
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center flex-shrink-0"
            title="Attach images, PDFs, TXT, or code documents"
          >
            {isProcessingFile ? (
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </button>

          {/* Auto-expanding Textarea */}
          <div className="flex-1 bg-slate-950 border border-slate-800 focus-within:border-indigo-500/70 rounded-2xl px-3 py-2 transition-all">
            <textarea
              ref={textareaRef}
              value={inputPrompt}
              rows={1}
              onChange={handleTextareaChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask Gemini AI, solve academic problems, or analyze notes/PDFs..."
              className="w-full bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-36 overflow-y-auto"
            />
          </div>

          {/* Send or Stop Generation Button */}
          {isGenerating ? (
            <button
              type="button"
              onClick={handleStopGeneration}
              className="p-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
              title="Stop Generation"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputPrompt.trim() && attachments.length === 0}
              className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
              title="Send message (Enter)"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </form>
      </footer>

      {/* 5. IMAGE PREVIEW MODAL */}
      {previewImageModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewImageModal(null)}
              className="absolute -top-10 right-0 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImageModal}
              alt="Preview"
              className="max-h-[80vh] w-auto rounded-2xl border border-slate-800 shadow-2xl object-contain"
            />
          </div>
        </div>
      )}

      {/* 6. CLEAR CURRENT CHAT CONFIRMATION MODAL */}
      {showClearChatConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Clear this conversation?</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              This will remove all messages from the current conversation. This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearChatConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearCurrentChat}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. CLEAR ALL HISTORY CONFIRMATION MODAL */}
      {showClearAllHistoryConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-900/40 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Clear All AI Chat History?</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              This will permanently delete all your previous AI conversations and message logs. A fresh new chat will be started.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearAllHistoryConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllHistory}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete All History</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
