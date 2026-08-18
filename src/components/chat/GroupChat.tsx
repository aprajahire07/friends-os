import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, 
  Paperclip, 
  Search, 
  X, 
  MessageSquare, 
  Users, 
  User, 
  Trash2, 
  Check, 
  CheckCheck, 
  Camera, 
  Image as ImageIcon, 
  FileText, 
  Loader2, 
  AtSign, 
  ChevronLeft, 
  ShieldAlert, 
  Sparkles,
  Lock,
  Smile
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

  // Active chat mode: 'group' or 'private'
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
  const [attachedFileType, setAttachedFileType] = useState<'image' | 'video' | 'document' | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
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
    return store.messages.filter(m => {
      const isDirect = m.category === 'direct' || Boolean(m.recipient_id) || m.category?.startsWith('dm_');
      if (isDirect) return false;
      if (!searchQuery) return true;
      return m.content.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [store.messages, searchQuery]);

  // Private Messages for the currently selected friend
  const privateMessages = useMemo(() => {
    if (!selectedFriendId) return [];
    const myId = currentUser.id;
    const fId = selectedFriendId;

    return store.messages.filter(m => {
      const isBetweenUs = 
        (m.sender_id === myId && m.recipient_id === fId) ||
        (m.sender_id === fId && m.recipient_id === myId) ||
        (m.category === `dm_${fId}` && (m.sender_id === myId || m.sender_id === fId)) ||
        (m.category === `dm_${myId}` && (m.sender_id === myId || m.sender_id === fId));

      if (!isBetweenUs) return false;
      if (!searchQuery) return true;
      return m.content.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [store.messages, selectedFriendId, currentUser.id, searchQuery]);

  // Active messages list based on mode
  const currentMessages = activeMode === 'group' ? groupMessages : privateMessages;

  // Unread count badges
  const groupUnreadCount = store.getGroupUnreadCount();
  const totalDmUnreadCount = useMemo(() => {
    return otherProfiles.reduce((acc, p) => acc + store.getDirectUnreadCount(p.id), 0);
  }, [otherProfiles, store.messages, store.messageReads]);

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
      showToast('Group Chat Cleared', 'All group chat messages have been removed.', 'success');
    } else if (activeMode === 'private' && selectedFriend) {
      await appStore.clearPrivateChat(selectedFriend.id);
      showToast('Private Chat Cleared', `Chat with ${selectedFriend.full_name} has been cleared.`, 'success');
    }
  };

  // Helper for friend last message snippet
  const getFriendLastMessage = (friendId: string) => {
    const myId = currentUser.id;
    const friendMsgs = store.messages.filter(m => {
      return (
        (m.sender_id === myId && m.recipient_id === friendId) ||
        (m.sender_id === friendId && m.recipient_id === myId) ||
        (m.category === `dm_${friendId}` && (m.sender_id === myId || m.sender_id === friendId)) ||
        (m.category === `dm_${myId}` && (m.sender_id === myId || m.sender_id === friendId))
      );
    });

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

      {/* Main Top Header: Mode Switcher & Actions */}
      <div className="bg-slate-950 border-b border-slate-800 px-3 py-2.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        
        {/* Mode Switcher Buttons */}
        <div className="flex items-center gap-2 bg-slate-900/90 p-1 rounded-2xl border border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveMode('group');
              setSearchQuery('');
              setReplyingTo(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeMode === 'group'
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Group Chat</span>
            {groupUnreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-500 text-white animate-pulse">
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
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeMode === 'private'
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Private Chat</span>
            {totalDmUnreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-cyan-500 text-white animate-pulse">
                {totalDmUnreadCount > 99 ? '99+' : totalDmUnreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Action Controls: Live indicator, Search & Clear Chat */}
        <div className="flex items-center gap-2 justify-between sm:justify-end w-full sm:w-auto">
          {/* Live sync pulse */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-[10px] font-bold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Chat</span>
          </div>

          {/* Clear Chat Button */}
          {(activeMode === 'group' || (activeMode === 'private' && selectedFriend)) && (
            <button
              type="button"
              onClick={() => setShowClearConfirmModal(true)}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
              title="Clear Chat History"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}

          {/* Search Message Box */}
          {(activeMode === 'group' || (activeMode === 'private' && selectedFriend)) && (
            <div className="relative shrink-0 w-36 sm:w-44">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-2.5 py-1.5 pl-7 pr-6 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
              />
              <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
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
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* GROUP CHAT MODE */}
        {activeMode === 'group' && (
          <div className="flex-1 flex flex-col h-full bg-slate-950/40 overflow-hidden">
            {/* Group Info Sub-Header */}
            <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="font-bold text-slate-200">College Crew Group</span>
                <span className="text-[11px] text-slate-500">• {store.profiles.length} friends</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Real-time synced</span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {groupMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-950/50 border border-indigo-800/40 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
                    <Users className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-bold text-slate-300">Welcome to Group Chat!</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Start a conversation with your entire crew. Everyone in the group can see and reply here.
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

        {/* PRIVATE CHAT MODE */}
        {activeMode === 'private' && (
          <div className="flex-1 flex h-full overflow-hidden">
            
            {/* Friends DM List Sidebar (Always visible on desktop, visible on mobile if no friend selected) */}
            <div className={`w-full md:w-80 md:border-r border-slate-800 flex flex-col bg-slate-950/80 ${
              selectedFriendId ? 'hidden md:flex' : 'flex'
            }`}>
              {/* Friends Search Bar */}
              <div className="p-3 border-b border-slate-800">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search friend to chat..."
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

              {/* Friends List Items */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-900/60 p-2 space-y-1">
                {filteredFriends.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    No friends found matching "{searchFriendQuery}".
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
                        onClick={() => {
                          setSelectedFriendId(friend.id);
                          setSearchQuery('');
                          setReplyingTo(null);
                        }}
                        className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all text-left ${
                          isSelected
                            ? 'bg-indigo-950/70 border border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
                            : 'hover:bg-slate-900/80 border border-transparent'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <Avatar
                            profile={friend}
                            src={friend.avatar_url}
                            name={friend.full_name}
                            username={friend.username}
                            size="md"
                          />
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
                        </div>

                        {/* Name & Last Message */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-slate-200 truncate">
                              {friend.full_name}
                            </p>
                            {lastMsg && (
                              <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                                {formatMsgTime(lastMsg.created_at)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-[11px] text-slate-400 truncate">
                              {lastMsg ? (
                                <>
                                  {lastMsg.sender_id === currentUser.id ? 'You: ' : ''}
                                  {lastMsg.content || (lastMsg.media_url ? '📷 Photo' : 'Message')}
                                </>
                              ) : (
                                <span className="text-slate-600 italic">Tap to start chat</span>
                              )}
                            </p>

                            {unread > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-cyan-500 text-white shrink-0 animate-pulse">
                                {unread}
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

            {/* Private 1-on-1 Chat Conversation Window */}
            <div className={`flex-1 flex flex-col h-full bg-slate-950/40 overflow-hidden ${
              !selectedFriendId ? 'hidden md:flex' : 'flex'
            }`}>
              {selectedFriend ? (
                <>
                  {/* Private Chat Header */}
                  <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Back button on mobile */}
                      <button
                        type="button"
                        onClick={() => setSelectedFriendId(null)}
                        className="md:hidden p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                        title="Back to friend chats"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <Avatar
                        profile={selectedFriend}
                        src={selectedFriend.avatar_url}
                        name={selectedFriend.full_name}
                        username={selectedFriend.username}
                        size="sm"
                        onClick={() => onOpenProfile && onOpenProfile(selectedFriend)}
                        className="cursor-pointer hover:ring-2 hover:ring-indigo-500"
                      />

                      <div>
                        <p 
                          onClick={() => onOpenProfile && onOpenProfile(selectedFriend)}
                          className="text-xs font-bold text-white hover:text-indigo-400 cursor-pointer flex items-center gap-1.5"
                        >
                          <span>{selectedFriend.full_name}</span>
                          <Lock className="w-3 h-3 text-cyan-400" />
                        </p>
                        <p className="text-[10px] text-slate-400">
                          @{selectedFriend.username} • {selectedFriend.course_branch || 'CSE'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenProfile && onOpenProfile(selectedFriend)}
                        className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors"
                      >
                        Profile
                      </button>
                    </div>
                  </div>

                  {/* Private Messages Stream */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {privateMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                        <Avatar
                          profile={selectedFriend}
                          src={selectedFriend.avatar_url}
                          name={selectedFriend.full_name}
                          username={selectedFriend.username}
                          size="lg"
                          className="mb-3 ring-4 ring-slate-800"
                        />
                        <p className="text-sm font-bold text-slate-200">
                          Private chat with {selectedFriend.full_name}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs">
                          Messages here are completely private between you two. Say hi! 👋
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
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
                    <MessageSquare className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-bold text-slate-300">Select a friend to chat</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Choose any friend from the list on the left to start a 1-on-1 private conversation.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
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
      {showMentions && activeMode === 'group' && (
        <div className="bg-slate-900 border-t border-slate-800 p-2 flex gap-2 overflow-x-auto">
          {store.profiles.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setInputText(prev => `${prev} @${p.username} `);
                setShowMentions(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-indigo-300 hover:bg-slate-800"
            >
              <Avatar profile={p} src={p.avatar_url} name={p.full_name} username={p.username} size="sm" />
              <span>@{p.username}</span>
            </button>
          ))}
        </div>
      )}

      {/* Message Input Controls Bar (Visible if in group mode, or if friend is selected in private mode) */}
      {(activeMode === 'group' || (activeMode === 'private' && selectedFriendId)) && (
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

          {activeMode === 'group' && (
            <button
              type="button"
              onClick={() => setShowMentions(!showMentions)}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
              title="Mention @Friend"
            >
              <AtSign className="w-4 h-4" />
            </button>
          )}

          <input
            type="text"
            placeholder={
              activeMode === 'group'
                ? "Message College Crew..."
                : `Message @${selectedFriend?.username || 'Friend'} privately...`
            }
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500"
          />

          <button
            type="submit"
            disabled={isUploading || (!inputText.trim() && !attachedFile)}
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
      )}

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">
                {activeMode === 'group' ? 'Clear Group Chat?' : `Clear chat with ${selectedFriend?.full_name}?`}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {activeMode === 'group' 
                  ? 'This will clear all group conversation messages. This action cannot be undone.' 
                  : `Are you sure you want to delete all messages in your private conversation with ${selectedFriend?.full_name}?`}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearChat}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-colors"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
