import React, { useState, useEffect } from 'react';
import {
  X,
  Youtube,
  Calendar,
  MapPin,
  Tag,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Trash2,
  Edit3,
  Play,
  ExternalLink,
  Plus
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { Memory } from '../../types';
import { useToast } from '../ui/Toast';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../../lib/youtube';

interface EditMemoryModalProps {
  memory: Memory | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditMemoryModal: React.FC<EditMemoryModalProps> = ({
  memory,
  isOpen,
  onClose
}) => {
  const { showToast } = useToast();
  const store = useAppStore();

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [youtubeInputUrl, setYoutubeInputUrl] = useState('');
  const [showYouTubeInput, setShowYouTubeInput] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (memory && isOpen) {
      setTitle(memory.title || '');
      setCaption(memory.caption || '');
      setDate(memory.date || new Date().toISOString().split('T')[0]);
      setLocation(memory.location || '');
      setTaggedUserIds(memory.tagged_user_ids || []);
      
      const existingYt = memory.youtube_url || (memory.youtube_video_id ? `https://www.youtube.com/watch?v=${memory.youtube_video_id}` : '');
      setYoutubeInputUrl(existingYt);
      setShowYouTubeInput(Boolean(existingYt));
      setYoutubeError(null);
      setErrorMsg(null);
    }
  }, [memory, isOpen]);

  if (!isOpen || !memory) return null;

  const extractedYtId = extractYouTubeVideoId(youtubeInputUrl);
  const hasValidYouTube = Boolean(extractedYtId);

  const handleYouTubeChange = (val: string) => {
    setYoutubeInputUrl(val);
    if (!val.trim()) {
      setYoutubeError(null);
    } else {
      const vidId = extractYouTubeVideoId(val);
      if (!vidId) {
        setYoutubeError('Please enter a valid YouTube video link (watch, shorts, or youtu.be).');
      } else {
        setYoutubeError(null);
      }
    }
  };

  const handleRemoveYouTube = () => {
    setYoutubeInputUrl('');
    setYoutubeError(null);
    setShowYouTubeInput(false);
  };

  const toggleTagUser = (uid: string) => {
    if (taggedUserIds.includes(uid)) {
      setTaggedUserIds(taggedUserIds.filter(id => id !== uid));
    } else {
      setTaggedUserIds([...taggedUserIds, uid]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Memory title is required.');
      return;
    }

    const photoCount = memory.media_urls?.length || 0;
    if (photoCount === 0 && !hasValidYouTube) {
      setErrorMsg('This memory has no photos, so a YouTube video is required.');
      return;
    }

    if (youtubeInputUrl.trim() && !hasValidYouTube) {
      setErrorMsg('Please enter a valid YouTube video link or remove the link.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalYtUrl = hasValidYouTube && extractedYtId ? `https://www.youtube.com/watch?v=${extractedYtId}` : null;
      const success = await appStore.updateMemory(memory.id, {
        title: title.trim(),
        caption: caption.trim(),
        date,
        location: location.trim(),
        youtube_url: finalYtUrl,
        youtube_video_id: extractedYtId,
        tagged_user_ids: taggedUserIds
      });

      if (success) {
        showToast('Memory Updated', `Updated "${title}" successfully.`, 'success');
        onClose();
      } else {
        setErrorMsg('Failed to update memory.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error saving changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-indigo-950/80 border border-indigo-800/60 rounded-2xl text-indigo-400 shadow-inner">
            <Edit3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Edit Memory</h3>
            <p className="text-xs text-slate-400">Update story, details, or attach a YouTube video</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Memory Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Memory Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isSubmitting}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            />
          </div>

          {/* YouTube Video Section */}
          <div className="space-y-2">
            {!showYouTubeInput && !hasValidYouTube ? (
              <button
                type="button"
                onClick={() => setShowYouTubeInput(true)}
                disabled={isSubmitting}
                className="w-full py-2.5 px-3 rounded-2xl bg-slate-950/70 border border-slate-800/90 hover:border-rose-600/50 hover:bg-slate-950 text-slate-300 hover:text-white flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Youtube className="w-3.5 h-3.5" />
                  </div>
                  <span>🎥 Attach YouTube video <span className="text-slate-500 font-normal">(optional)</span></span>
                </div>
                <Plus className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              </button>
            ) : (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Youtube className="w-4 h-4 text-rose-500" />
                    <span>YouTube Video Link</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveYouTube}
                    disabled={isSubmitting}
                    className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove Video</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="url"
                    disabled={isSubmitting}
                    placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                    value={youtubeInputUrl}
                    onChange={e => handleYouTubeChange(e.target.value)}
                    className={`w-full pl-3.5 pr-8 py-2 bg-slate-900 border rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors ${
                      youtubeError 
                        ? 'border-rose-500 focus:border-rose-400' 
                        : hasValidYouTube 
                          ? 'border-emerald-500/80 focus:border-emerald-400' 
                          : 'border-slate-800 focus:border-indigo-500'
                    }`}
                  />
                  {hasValidYouTube && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {youtubeError && (
                  <div className="text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{youtubeError}</span>
                  </div>
                )}

                {hasValidYouTube && extractedYtId && (
                  <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 p-2 flex items-center gap-3">
                    <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-slate-800">
                      <img
                        src={getYouTubeThumbnailUrl(extractedYtId, 'mq') || ''}
                        alt="YouTube thumbnail"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow">
                          <Play className="w-3 h-3 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-wider border border-rose-500/30">
                        YouTube Attached
                      </span>
                      <p className="text-xs font-mono text-slate-300 mt-1 truncate">
                        ID: {extractedYtId}
                      </p>
                      <a
                        href={`https://www.youtube.com/watch?v=${extractedYtId}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <span>Open on YouTube</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Caption / Story
            </label>
            <textarea
              rows={3}
              disabled={isSubmitting}
              placeholder="Write a caption..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Date & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Date</label>
              <input
                type="date"
                required
                disabled={isSubmitting}
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Location</label>
              <input
                type="text"
                disabled={isSubmitting}
                placeholder="Location"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Tag Crew Friends */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tag Crew Friends</label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
              {store.profiles.map(p => {
                const isTagged = taggedUserIds.includes(p.id);

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => toggleTagUser(p.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                      isTagged 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    @{p.username}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (Boolean(youtubeInputUrl.trim()) && !hasValidYouTube)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
