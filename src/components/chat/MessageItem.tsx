import React, { useState } from 'react';
import { Reply, Trash2, Smile, Image as ImageIcon, FileText, Download, ExternalLink } from 'lucide-react';
import { ChatMessage, Profile } from '../../types';
import { appStore } from '../../lib/store';
import { getSyncMediaUrl } from '../../services/storage';
import { Avatar } from '../ui/Avatar';

interface MessageItemProps {
  message: ChatMessage;
  currentUser: Profile;
  onReply: (message: ChatMessage) => void;
  onOpenProfile?: (profile: Profile) => void;
  isChatPrivate?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  currentUser, 
  onReply, 
  onOpenProfile,
  isChatPrivate = false
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const isSelf = message.sender_id === currentUser.id;

  const sender = message.sender || appStore.profiles.find(p => p.id === message.sender_id);
  const reactionEmojis = ['👍', '❤️', '🔥', '😂', '🍕', '🎉'];

  const handleDelete = () => {
    if (confirm('Delete this message?')) {
      appStore.deleteMessage(message.id);
    }
  };

  const handleToggleReaction = (emoji: string) => {
    appStore.toggleReaction(message.id, emoji);
    setShowEmojiPicker(false);
  };

  const formattedTime = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const resolvedMediaUrl = message.media_url ? getSyncMediaUrl('chat-media', message.media_url) : null;
  const isDocument = message.media_url && (
    message.media_url.endsWith('.pdf') || 
    message.media_url.endsWith('.doc') || 
    message.media_url.endsWith('.docx') || 
    message.media_url.endsWith('.txt')
  );

  return (
    <div className={`flex items-start gap-3 my-3 group ${isSelf ? 'flex-row-reverse' : ''}`}>
      {/* Avatar with reliable fallback */}
      <Avatar
        profile={sender}
        src={sender?.avatar_url}
        name={sender?.full_name || 'Member'}
        username={sender?.username}
        size="sm"
        onClick={() => sender && onOpenProfile && onOpenProfile(sender)}
        className={`mt-1 ${onOpenProfile ? 'hover:ring-2 hover:ring-indigo-500' : ''}`}
        title={sender?.full_name ? `View ${sender.full_name}'s profile` : ''}
      />

      <div className={`max-w-[75%] md:max-w-[65%] flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
        {/* Sender Name & Timestamp */}
        <div className="flex items-center gap-2 mb-1 px-1">
          <span
            onClick={() => sender && onOpenProfile && onOpenProfile(sender)}
            className={`text-[11px] font-bold text-slate-300 ${onOpenProfile ? 'cursor-pointer hover:text-indigo-400 hover:underline' : ''}`}
          >
            {sender?.full_name || 'Member'}
          </span>
          <span className="text-[9px] text-slate-500 font-mono">{formattedTime}</span>
        </div>

        {/* Message Bubble Container */}
        <div className="relative group/bubble">
          {/* Quoted Reply context if any */}
          {message.reply_to_message && (
            <div className="mb-1 p-2 rounded-lg bg-slate-950/80 border-l-2 border-indigo-500 text-[11px] text-slate-400">
              <span className="font-bold text-indigo-300">@{message.reply_to_message.sender_name}: </span>
              <span>{isChatPrivate ? '••••••••••••' : message.reply_to_message.content}</span>
            </div>
          )}

          {/* Main Bubble */}
          <div
            className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-md ${
              isSelf
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-tr-none'
                : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
            }`}
          >
            {/* Media Attachment */}
            {resolvedMediaUrl && (
              <div className="mb-2">
                {isChatPrivate ? (
                  <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-slate-400">
                    <span className="text-xs">🔒</span>
                    <span className="text-[11px] font-mono">Attachment Hidden</span>
                  </div>
                ) : isDocument ? (
                  <a
                    href={resolvedMediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-700/50 hover:bg-slate-950 text-indigo-300 hover:text-indigo-200 transition-colors"
                  >
                    <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                    <span className="font-semibold text-xs truncate flex-1">
                      {message.media_url.split('/').pop() || 'Attached Document'}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  </a>
                ) : resolvedMediaUrl ? (
                  <div className="relative group/img cursor-pointer" onClick={() => setShowFullImage(true)}>
                    <img
                      src={resolvedMediaUrl}
                      alt="Attachment"
                      className="max-h-60 rounded-xl object-cover border border-slate-700/50 hover:opacity-95 transition-opacity"
                    />
                  </div>
                ) : null}
              </div>
            )}

            {isChatPrivate ? (
              <p className="font-mono text-slate-400/80 tracking-widest text-[11px] select-none py-0.5">
                ••••••••••••••••••••
              </p>
            ) : (
              message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>

          {/* Action Hover Controls */}
          <div className={`absolute top-0 -translate-y-1/2 hidden group-hover/bubble:flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg shadow-xl z-10 ${
            isSelf ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'
          }`}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-400"
              title="React"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onReply(message)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-400"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
            {isSelf && (
              <button
                onClick={handleDelete}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Floating Reaction Bar Picker */}
          {showEmojiPicker && (
            <div className="absolute z-20 top-full mt-1 p-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex gap-1">
              {reactionEmojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleToggleReaction(emoji)}
                  className="p-1 hover:bg-slate-800 rounded text-sm transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Existing Reactions Pills */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(message.reactions).map(([emoji, rawIds]) => {
              const userIds = (rawIds || []) as string[];
              if (userIds.length === 0) return null;
              const hasVoted = userIds.includes(currentUser.id);

              return (
                <button
                  key={emoji}
                  onClick={() => handleToggleReaction(emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                    hasVoted
                      ? 'bg-indigo-950 border-indigo-500 text-indigo-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {showFullImage && resolvedMediaUrl && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-w-2xl max-h-[85vh]">
            <img
              src={resolvedMediaUrl}
              alt="Full Preview"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
