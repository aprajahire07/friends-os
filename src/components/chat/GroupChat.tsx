import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, 
  Paperclip, 
  Search, 
  X, 
  MessageSquare, 
  Users, 
  Trash2, 
  Camera, 
  Image as ImageIcon, 
  FileText, 
  Loader2, 
  AtSign, 
  ArrowLeft, 
  Lock,
  Smile,
  CheckCircle2
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { ChatMessage, Profile } from '../../types';
import { MessageItem } from './MessageItem';
import { useToast } from '../ui/Toast';
import { uploadFileToStorage, validateUploadFile } from '../../services/storage';
import { Avatar } from '../ui/Avatar';

interface GroupChatProps {
  onOpenProfile?: (profile: Profile) => void;
  initialFriendId?: string | null;
}

export const GroupChat: React.FC<GroupChatProps> = ({ onOpenProfile, initialFriendId }) => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;

  // Active chat tab: 'group' or 'private'
  const [activeMode, setActiveMode] = useState<'group' | 'private'>('group');
  
  // For Private 1-on-1 Chat
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(initialFriendId || null);
  const [searchFriendQuery, setSearchFriendQuery] = useState('');

  // Search & Input state
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFilePreview, setAttachedFilePreview] = useState<string | null>(null);
  const [, setAttachedFileType] = useState<'image' | 'video' | 'document' | null>(null);
  const [, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // If initialFriendId was passed, switch to private mode directly
  useEffect(() => {
    if (initialFriendId) {
      setActiveMode('private');
      setSelectedFriendId(initialFriendId);
    }
  }, [initialFriendId]);

  // All friends except current user
  const otherProfiles = useMemo(() => {
    return store.profiles.filter(p => p.id !== currentUser.id);
  }, [store.profiles, currentUser.id]);

  // Selected friend object
  const selectedFriend = useMemo(() => {
    if (!selectedFriendId) return null;
    return store.profiles.find(p => p.id === selectedFriendId) || null;
  }, [store.profiles, selectedFriendId]);

  // Group Messages
  const groupMessages = useMemo(() => {
    const msgs = store.getGroupMessages();
    if (!searchQuery) return msgs;
    return msgs.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [store.messages, store.clearedChats, searchQuery]);

  // Private Messages for the currently selected friend
  const privateMessages = useMemo(() => {
    if (!selectedFriendId) return [];
    const msgs = store.getPrivateMessages(selectedFriendId);
    if (!searchQuery) return msgs;
    return msgs.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [store.messages, store.clearedChats, selectedFriendId, searchQuery]);

  // Active messages list based on mode
  const currentMessages = activeMode === 'group' ? groupMessages : privateMessages;

  // Unread count badges
  const groupUnreadCount = store.getGroupUnreadCount();
  const totalDmUnreadCount = useMemo(() => {
    return otherProfiles.reduce((acc, p) => acc + store.getDirectUnreadCount(p.id), 0);
  }, [otherProfiles, store.messages, store.messageReads, store.clearedChats]);

  // Mark group read when group chat is open
  useEffect(() => {
    if (activeMode === 'group') {
      appStore.markCategoryAsRead('general');
    } else if (activeMode === 'private' && selectedFriendId) {
      appStore.markDirectMessagesAsRead(selectedFriendId);
    }
  }, [activeMode, selectedFriendId, currentMessages.length]);

  // Auto-scroll on new message or channel change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, activeMode, selectedFriendId]);

  // File selection
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

  // Send message
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

    if (activeMode === 'group') {
      await appStore.addMessage(
        'general',
        inputText.trim(),
        mediaStoragePath,
        replyingTo?.id
      );
    } else if (activeMode === 'private' && selectedFriendId) {
      await appStore.addMessage(
        'direct',
        inputText.trim(),
        mediaStoragePath,
        replyingTo?.id,
        selectedFriendId
      );
    }

    setInputText('');
    handleRemoveAttachment();
    setReplyingTo(null);
  };

  // Clear Chat execution
  const handleConfirmClearChat = async () => {
    setShowClearConfirmModal(false);
    if (activeMode === 'group') {
      await appStore.clearGroupChat();
      showToast('Group Chat Cleared', 'All group chat messages have been removed from your screen.', 'success');
    } else if (activeMode === 'private' && selectedFriend) {
      await appStore.clearPrivateChat(selectedFriend.id);
      showToast('Private Chat Cleared', `Chat with ${selectedFriend.full_name} has been cleared.`, 'success');
    }
  };

  // Helper for friend last message snippet
  const getFriendLastMessage = (friendId: string) => {
    const friendMsgs = store.getPrivateMessages(friendId);
    if (friendMsgs.length === 0) return null;
    return friendMsgs[friendMsgs.length - 1];
  };

  // Format timestamp helper
  const formatMsgTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Filtered friends for private chat list
  const filteredFriends = useMemo(() => {
    return otherProfiles.filter(p => {
      if (!searchFriendQuery) return true;
      const q = searchFriendQuery.toLowerCase();
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        p.course_branch?.toLowerCase().includes(q)
      );
    });
  }, [otherProfiles, searchFriendQuery]);

  return (
    <div className="flex flex-col h-full flex-1 min-h-0 w-full bg-slate-900 border border-slate-800/90 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl relative select-none">
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
        accept="application/pdf,text/*,.txt,.c,.cpp,.h,.java,.py,.js,.jsx,.ts,.tsx,.json,.md,.html,.css,.sql,.doc,.docx,.ppt,.pptx,.zip"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
      />

      {/* TOP STATIC NAVIGATION TAB BAR */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-3 py-2.5 shrink-0">
        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveMode('group');
              setSearchQuery('');
              setReplyingTo(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeMode === 'group'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Group Chat</span>
            {groupUnreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-400 text-slate-950">
                {groupUnreadCount > 99 ? '99+' : groupUnreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('private');
              setSearchQuery('');
              setReplyingTo(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeMode === 'private'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Lock className="w-4 h-4 text-cyan-300" />
            <span>Private Chat</span>
            {totalDmUnreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-400 text-slate-950">
                {totalDmUnreadCount > 99 ? '99+' : totalDmUnreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SUB-HEADER / ACTIONS BAR */}
      <div className="bg-slate-950/70 border-b border-slate-800/60 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        {/* Left Side: Mode or Friend Information */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {activeMode === 'group' ? (
            <div className="flex items-center gap-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="font-bold text-xs text-slate-200 truncate">College Crew</span>
              <span className="text-[11px] text-slate-400 shrink-0">({store.profiles.length} friends)</span>
            </div>
          ) : selectedFriend ? (
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedFriendId(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 flex items-center gap-1 text-xs px-2"
                title="Back to friend list"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Friends</span>
              </button>
              <div 
                className="flex items-center gap-2 cursor-pointer truncate"
                onClick={() => onOpenProfile && onOpenProfile(selectedFriend)}
              >
                <Avatar profile={selectedFriend} src={selectedFriend.avatar_url} name={selectedFriend.full_name} size="sm" />
                <div className="truncate">
                  <div className="font-bold text-xs text-white truncate">{selectedFriend.full_name}</div>
                  <div className="text-[10px] text-slate-400 truncate">@{selectedFriend.username}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-400">
              Select a friend to start private 1-on-1 chat
            </div>
          )}
        </div>

        {/* Right Side: Search & Clear Chat */}
        <div className="flex items-center gap-2 shrink-0">
          {(activeMode === 'group' || (activeMode === 'private' && selectedFriend)) && (
            <>
              {/* Search Toggle / Box */}
              <div className="relative w-28 sm:w-40">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-2 py-1 pl-6 pr-5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Clear Chat Button */}
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(true)}
                className="p-1.5 sm:px-2.5 sm:py-1 bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Clear chat history"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Clear Chat</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* MAIN BODY VIEW */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        
        {/* VIEW 1: GROUP CHAT */}
        {activeMode === 'group' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950/30">
            {/* Stable Vertical Message Scroll Area */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2" style={{ touchAction: 'pan-y' }}>
              {groupMessages.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-center text-indigo-400 mb-2">
                    <Users className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-200">Group Chat</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Send a message to start chatting with everyone in your group.
                  </p>
                </div>
              ) : (
                groupMessages.map(msg => (
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
          </div>
        )}

        {/* VIEW 2: PRIVATE CHAT */}
        {activeMode === 'private' && (
          <div className="flex-1 flex h-full overflow-hidden">
            {/* Friends Selection List (Full on mobile when no friend chosen, sidebar on desktop) */}
            <div className={`w-full md:w-80 md:border-r border-slate-800 flex flex-col bg-slate-950/90 ${
              selectedFriendId ? 'hidden md:flex' : 'flex'
            }`}>
              {/* Friends Search Input */}
              <div className="p-2.5 border-b border-slate-800 bg-slate-950">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search friends..."
                    value={searchFriendQuery}
                    onChange={e => setSearchFriendQuery(e.target.value)}
                    className="w-full px-3 py-2 pl-8 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  {searchFriendQuery && (
                    <button
                      onClick={() => setSearchFriendQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Friends List Scroll Area */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1" style={{ touchAction: 'pan-y' }}>
                {filteredFriends.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No friends found.
                  </div>
                ) : (
                  filteredFriends.map(friend => {
                    const isSelected = selectedFriendId === friend.id;
                    const lastMsg = getFriendLastMessage(friend.id);
                    const unread = store.getDirectUnreadCount(friend.id);

                    return (
                      <button
                        key={friend.id}
                        type="button"
                        onClick={() => setSelectedFriendId(friend.id)}
                        className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition-all text-left ${
                          isSelected
                            ? 'bg-indigo-950/70 border border-indigo-700/60'
                            : 'hover:bg-slate-900 border border-transparent'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <Avatar
                            profile={friend}
                            src={friend.avatar_url}
                            name={friend.full_name}
                            size="md"
                          />
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="font-bold text-xs text-slate-200 truncate">{friend.full_name}</span>
                            {lastMsg && (
                              <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                                {formatMsgTime(lastMsg.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-[11px] text-slate-400 truncate">
                              {lastMsg ? lastMsg.content : `@${friend.username}`}
                            </p>
                            {unread > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500 text-slate-950 shrink-0">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Private Message Stream for Selected Friend */}
            <div className={`flex-1 flex flex-col h-full bg-slate-950/30 ${
              selectedFriendId ? 'flex' : 'hidden md:flex'
            }`}>
              {selectedFriend ? (
                <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2" style={{ touchAction: 'pan-y' }}>
                  {privateMessages.length === 0 ? (
                    <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
                      <Avatar
                        profile={selectedFriend}
                        src={selectedFriend.avatar_url}
                        name={selectedFriend.full_name}
                        size="lg"
                        className="mb-3"
                      />
                      <p className="text-sm font-bold text-slate-200">{selectedFriend.full_name}</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        This is the beginning of your private 1-on-1 chat history.
                      </p>
                    </div>
                  ) : (
                    privateMessages.map(msg => (
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
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-3">
                    <MessageSquare className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-bold text-slate-300">Select a Friend</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Choose a friend from the left sidebar to start private messaging.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* REPLIED MESSAGE BANNER */}
      {replyingTo && (
        <div className="px-3 py-2 bg-indigo-950/80 border-t border-indigo-800/80 flex items-center justify-between text-xs text-indigo-200 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-indigo-300 shrink-0">Replying to {replyingTo.sender?.full_name || 'User'}:</span>
            <span className="truncate opacity-80">{replyingTo.content}</span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ATTACHED FILE PREVIEW */}
      {attachedFile && (
        <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 truncate">
            {attachedFilePreview ? (
              <img src={attachedFilePreview} alt="Preview" className="w-9 h-9 object-cover rounded-lg shrink-0 border border-slate-700" />
            ) : (
              <FileText className="w-6 h-6 text-indigo-400 shrink-0" />
            )}
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{attachedFile.name}</p>
              <p className="text-[10px] text-slate-400">{(attachedFile.size / 1024).toFixed(1)} KB</p>
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

      {/* ATTACHMENT MENU DROPDOWN */}
      {showAttachMenu && (
        <div className="absolute bottom-16 left-3 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl z-30 flex flex-col gap-1 w-44">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800 text-left"
          >
            <ImageIcon className="w-4 h-4 text-indigo-400" />
            <span>Photos & Videos</span>
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800 text-left"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Take Photo</span>
          </button>
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800 text-left"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Document / PDF</span>
          </button>
        </div>
      )}

      {/* MENTIONS PICKER */}
      {showMentions && activeMode === 'group' && (
        <div className="bg-slate-900 border-t border-slate-800 p-2 flex gap-2 overflow-x-auto shrink-0">
          {store.profiles.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setInputText(prev => `${prev} @${p.username} `);
                setShowMentions(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-indigo-300 hover:bg-slate-800 shrink-0"
            >
              <Avatar profile={p} src={p.avatar_url} name={p.full_name} username={p.username} size="sm" />
              <span>@{p.username}</span>
            </button>
          ))}
        </div>
      )}

      {/* BOTTOM INPUT BAR */}
      {(activeMode === 'group' || (activeMode === 'private' && selectedFriendId)) && (
        <form 
          id="chat-message-composer"
          onSubmit={handleSendMessage} 
          className="p-2 sm:p-3 bg-slate-950 border-t border-slate-800/90 flex items-center gap-2 shrink-0 z-20"
        >
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className={`p-2.5 rounded-xl border transition-colors shrink-0 touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center ${
              attachedFile ? 'bg-indigo-950 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {activeMode === 'group' && (
            <button
              type="button"
              onClick={() => setShowMentions(!showMentions)}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 transition-colors shrink-0 touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Mention @Friend"
            >
              <AtSign className="w-4 h-4" />
            </button>
          )}

          <input
            id="chat-text-input"
            type="text"
            placeholder={
              activeMode === 'group'
                ? "Message College Crew..."
                : `Message @${selectedFriend?.username || 'Friend'}...`
            }
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onFocus={() => {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 120);
            }}
            className="flex-1 min-w-0 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 min-h-[40px]"
          />

          <button
            id="chat-send-btn"
            type="submit"
            disabled={isUploading || (!inputText.trim() && !attachedFile)}
            className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 shrink-0 touch-manipulation min-w-[44px] sm:min-w-[70px] min-h-[40px]"
            title="Send message"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      )}

      {/* CLEAR CHAT CONFIRMATION MODAL */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/50 border border-rose-800/60 flex items-center justify-center text-rose-400 mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-center font-bold text-white text-base">
              Clear {activeMode === 'group' ? 'Group Chat' : `Chat with ${selectedFriend?.full_name}`}?
            </h3>
            
            <p className="text-center text-xs text-slate-400 mt-1.5 mb-5 leading-relaxed">
              {activeMode === 'group'
                ? 'Are you sure you want to clear the entire group chat history? Messages will be cleared from your screen.'
                : `Are you sure you want to clear your private conversation history with ${selectedFriend?.full_name}?`}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleConfirmClearChat}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
