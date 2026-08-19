import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Calendar, 
  Tag, 
  AlertCircle, 
  Loader2, 
  Video, 
  CheckCircle2, 
  Trash2,
  ExternalLink,
  Edit3
} from 'lucide-react';
import { Memory } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import { extractYouTubeVideoId, isValidYouTubeUrl, getYouTubeThumbnailUrl } from '../../lib/youtube';

interface EditMemoryModalProps {
  memory: Memory | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditMemoryModal: React.FC<EditMemoryModalProps> = ({ memory, isOpen, onClose }) => {
  const { showToast } = useToast();
  const store = useAppStore();

  const [title, setTitle] = useState(memory?.title || '');
  const [caption, setCaption] = useState(memory?.caption || '');
  const [date, setDate] = useState(memory?.date || new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState(memory?.location || '');
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>(memory?.tagged_user_ids || []);
  
  // YouTube State
  const initialYtUrl = memory?.youtube_url || (memory?.youtube_video_id ? `https://www.youtube.com/watch?v=${memory.youtube_video_id}` : '');
  const [youtubeInput, setYoutubeInput] = useState(initialYtUrl);
  const [youtubeUrl, setYoutubeUrl] = useState(initialYtUrl);
  const [showYoutubeInput, setShowYoutubeInput] = useState(Boolean(initialYtUrl));
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when memory prop changes
  React.useEffect(() => {
    if (memory) {
      setTitle(memory.title || '');
      setCaption(memory.caption || '');
      setDate(memory.date || new Date().toISOString().split('T')[0]);
      setLocation(memory.location || '');
      setTaggedUserIds(memory.tagged_user_ids || []);
      const yt = memory.youtube_url || (memory.youtube_video_id ? `https://www.youtube.com/watch?v=${memory.youtube_video_id}` : '');
      setYoutubeInput(yt);
      setYoutubeUrl(yt);
      setShowYoutubeInput(Boolean(yt));
      setYoutubeError(null);
      setErrorMsg(null);
    }
  }, [memory, isOpen]);

  if (!isOpen || !memory) return null;

  const currentVideoId = youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : null;

  const handleApplyYoutubeUrl = () => {
    const trimmed = youtubeInput.trim();
    if (!trimmed) {
      setYoutubeUrl('');
      setYoutubeError(null);
      return;
    }

    const videoId = extractYouTubeVideoId(trimmed);
    if (!videoId) {
      setYoutubeError('Please enter a valid YouTube video link.');
      return;
    }

    setYoutubeUrl(trimmed);
    setYoutubeError(null);
  };

  const handleRemoveYoutube = () => {
    setYoutubeInput('');
    setYoutubeUrl('');
    setYoutubeError(null);
    setShowYoutubeInput(false);
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
      setErrorMsg('Please enter a memory title.');
      return;
    }

    const hasPhotos = memory.media_urls && memory.media_urls.length > 0;
    const finalVideoId = youtubeUrl ? extractYouTubeVideoId(youtubeUrl) : null;

    if (!hasPhotos && !finalVideoId) {
      setErrorMsg('A memory must have at least one photo or a YouTube video.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await appStore.updateMemory(memory.id, {
        title: title.trim(),
        caption: caption.trim(),
        date,
        location: location.trim(),
        tagged_user_ids: taggedUserIds,
        youtube_url: youtubeUrl ? youtubeUrl.trim() : null,
        youtube_video_id: finalVideoId
      });

      if (success) {
        showToast(
          'Memory Updated',
          `Successfully saved changes for "${title.trim()}".`,
          'success'
        );
        onClose();
      } else {
        setErrorMsg('Failed to update memory in database.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update memory.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Close Button */}
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
            <p className="text-xs text-slate-400">Update title, caption, YouTube video, or details</p>
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
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-slate-200">YouTube Video</span>
                <span className="text-[10px] text-slate-400">(optional embed)</span>
              </div>
              {!showYoutubeInput && !currentVideoId && (
                <button
                  type="button"
                  onClick={() => setShowYoutubeInput(true)}
                  className="px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 hover:bg-red-900/80 text-[11px] font-bold transition-colors flex items-center gap-1.5"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Add YouTube Video</span>
                </button>
              )}
            </div>

            {/* If video is currently attached and validated */}
            {currentVideoId ? (
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900 border border-red-900/40">
                <div className="relative w-20 aspect-video rounded-lg overflow-hidden bg-black shrink-0 border border-red-500/20">
                  <img
                    src={getYouTubeThumbnailUrl(currentVideoId, 'mq')}
                    alt="YouTube thumbnail"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <Video className="w-4 h-4 text-red-400 drop-shadow" />
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>YouTube video attached</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate font-mono">
                    ID: {currentVideoId}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setYoutubeInput(youtubeUrl);
                      setShowYoutubeInput(true);
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveYoutube}
                    className="p-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition-colors"
                    title="Remove Video"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : showYoutubeInput ? (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <input
                    type="url"
                    disabled={isSubmitting}
                    placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                    value={youtubeInput}
                    onChange={e => {
                      setYoutubeInput(e.target.value);
                      setYoutubeError(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyYoutubeUrl();
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleApplyYoutubeUrl}
                    className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-sm transition-colors shrink-0"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowYoutubeInput(false);
                      setYoutubeError(null);
                    }}
                    className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {youtubeError && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {youtubeError}
                  </p>
                )}
                <p className="text-[10px] text-slate-400">
                  Supports YouTube watch links, shortened youtu.be links, and YouTube Shorts.
                </p>
              </div>
            ) : null}
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Caption / Story
            </label>
            <textarea
              rows={2}
              disabled={isSubmitting}
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
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Tag Crew Friends */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tag Friends</label>
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

          {/* Save Button */}
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
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 active:scale-[0.99]"
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
