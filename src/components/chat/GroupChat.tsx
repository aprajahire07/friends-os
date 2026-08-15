import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Search, 
  X, 
  MessageSquare, 
  GraduationCap, 
  CalendarDays, 
  Images, 
  Laugh, 
  AtSign, 
  Camera, 
  Image as ImageIcon, 
  FileText, 
  Loader2, 
  Check,
  CheckCheck
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { ChatCategory, ChatMessage, Profile } from '../../types';
import { MessageItem } from './MessageItem';
import { useToast } from '../ui/Toast';
import { uploadFileToStorage, validateUploadFile } from '../../services/storage';

interface GroupChatProps {
  onOpenProfile?: (profile: Profile) => void;
}

export const GroupChat: React.FC<GroupChatProps> = ({ onOpenProfile }) => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;

  const [activeCategory, setActiveCategory] = useState<ChatCategory>('general');
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFilePreview, setAttachedFilePreview] = useState<string | null>(null);
  const [attachedFileType, setAttachedFileType] = useState<'image' | 'video' | 'document' | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const categories: { id: ChatCategory; label: string; icon: any; color: string }[] = [
    { id: 'general', label: 'General', icon: MessageSquare, color: 'text-blue-400' },
    { id: 'college', label: 'College & Classes', icon: GraduationCap, color: 'text-cyan-400' },
    { id: 'plans', label: 'Plans & Trips', icon: CalendarDays, color: 'text-violet-400' },
    { id: 'memories', label: 'Memories', icon: Images, color: 'text-indigo-400' },
    { id: 'random', label: 'Random & Memes', icon: Laugh, color: 'text-pink-400' },
  ];

  const categoryMessages = store.messages.filter(
    m => m.category === activeCategory &&
         (!searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Automatically mark all channels as read upon entering GroupChat
  useEffect(() => {
    appStore.markAllMessagesAsRead();
  }, []);

  // Automatically mark the active category as read
  useEffect(() => {
    appStore.markCategoryAsRead(activeCategory);
  }, [activeCategory, categoryMessages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [categoryMessages.length, activeCategory]);

  const handleSelectFile = (file: File) => {
    const validation = validateUploadFile(file, ['image', 'video', 'document']);
    if (!validation.valid) {
      showToast('Invalid File', validation.error || 'Please select a valid file.', 'error');
      return;
    }

    setAttachedFile(file);
    setAttachedFileType(validation.fileType as any);
    if (validation.fileType === 'image') {
      setAttachedFilePreview(URL.createObjectURL(file));
    } else {
      setAttachedFilePreview(null);
    }
    setShowAttachMenu(false);
  };

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    setAttachedFilePreview(null);
    setAttachedFileType(null);
    setUploadProgress(0);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedFile) return;

    let mediaStoragePath: string | undefined = undefined;

    if (attachedFile) {
      setIsUploading(true);
      const res = await uploadFileToStorage(
        'chat-media',
        attachedFile,
        currentUser.id,
        (percent) => setUploadProgress(percent)
      );

      setIsUploading(false);

      if (res.error) {
        showToast('Upload Failed', res.error, 'error');
        return;
      }

      mediaStoragePath = res.storagePath;
    }

    appStore.addMessage(
      activeCategory,
      inputText.trim(),
      mediaStoragePath,
      replyingTo?.id
    );

    setInputText('');
    handleRemoveAttachment();
    setReplyingTo(null);
  };

  const handleMentionInsert = (username: string) => {
    setInputText(prev => `${prev} @${username} `);
    setShowMentions(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Hidden File Inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
      />
      <input
        ref={docInputRef}
        type="file"
        accept="application/pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
      />

      {/* Category Tabs Header */}
      <div className="bg-slate-950 border-b border-slate-800 p-2 sm:p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5 px-0.5 flex-1 touch-pan-x">
          {categories.map(cat => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            const unreadCount = !isActive ? store.getUnreadMessageCount(cat.id) : 0;

            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap active:scale-95 relative ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/40'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : cat.color}`} />
                <span>#{cat.label}</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-500 text-white animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action Controls: Mark All Read & Message Search */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          {store.getUnreadMessageCount() > 0 && (
            <button
              onClick={() => {
                appStore.markAllMessagesAsRead();
                showToast('Messages Read', 'All channels marked as read.', 'success');
              }}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
              title="Mark all channels as read"
            >
              <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}

          <div className="relative shrink-0 w-full sm:w-44">
            <input
              type="text"
              placeholder="Search channel..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 pl-8 pr-7 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-950/40">
        {categoryMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MessageSquare className="w-10 h-10 mb-2 opacity-40 text-indigo-400" />
            <p className="text-xs font-semibold">No messages in #{activeCategory} yet.</p>
            <p className="text-[10px] text-slate-600 mt-1">Start the conversation with your friend group!</p>
          </div>
        ) : (
          categoryMessages.map(msg => (
            <MessageItem
              key={msg.id}
              message={msg}
              currentUser={currentUser}
              onReply={setReplyingTo}
              onOpenProfile={onOpenProfile}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Replying Preview Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-indigo-300">
          <span className="truncate">
            Replying to <strong className="text-white">@{replyingTo.sender?.full_name || 'Member'}</strong>: "{replyingTo.content}"
          </span>
          <button onClick={() => setReplyingTo(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment Preview Strip */}
      {attachedFile && (
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {attachedFilePreview ? (
              <img
                src={attachedFilePreview}
                alt="Attachment Preview"
                className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-indigo-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{attachedFile.name}</p>
              <p className="text-[10px] text-slate-400">
                {(attachedFile.size / 1024).toFixed(1)} KB • {isUploading ? `Uploading ${uploadProgress}%` : 'Ready to send'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemoveAttachment}
            className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
            title="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment Dropdown Action Menu */}
      {showAttachMenu && (
        <div className="absolute bottom-16 left-4 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl z-30 flex flex-col gap-1 w-44">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors text-left"
          >
            <ImageIcon className="w-4 h-4 text-indigo-400" />
            <span>Photos & Videos</span>
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors text-left"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Take Photo</span>
          </button>
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors text-left"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Document / PDF</span>
          </button>
        </div>
      )}

      {/* Mentions Picker Dropdown */}
      {showMentions && (
        <div className="bg-slate-900 border-t border-slate-800 p-2 flex gap-2 overflow-x-auto">
          {appStore.profiles.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleMentionInsert(p.username)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-indigo-300 hover:bg-slate-800"
            >
              <img src={p.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
              <span>@{p.username}</span>
            </button>
          ))}
        </div>
      )}

      {/* Message Input Controls Bar */}
      <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setShowAttachMenu(!showAttachMenu)}
          className={`p-2.5 rounded-xl border transition-colors ${
            attachedFile ? 'bg-indigo-950 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Attach photo, video or document"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setShowMentions(!showMentions)}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
          title="Mention @Friend"
        >
          <AtSign className="w-4 h-4" />
        </button>

        <input
          type="text"
          placeholder={`Message #${activeCategory}...`}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500"
        />

        <button
          type="submit"
          disabled={isUploading}
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
