import React, { useState, useRef } from 'react';
import { 
  X, 
  Images, 
  MapPin, 
  Calendar, 
  Tag, 
  AlertCircle, 
  Loader2, 
  Plus, 
  ArrowLeft, 
  ArrowRight, 
  Trash2, 
  CheckCircle2, 
  UploadCloud,
  Video,
  Sparkles,
  ExternalLink,
  Play
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import { validateUploadFile, uploadFileToStorage } from '../../services/storage';
import { extractYouTubeVideoId, isValidYouTubeUrl, getYouTubeThumbnailUrl, extractAllYouTubeLinks, YouTubeLinkItem } from '../../lib/youtube';

interface UploadMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PhotoUploadItem {
  id: string;
  file?: File;
  previewUrl: string;
  storagePath?: string;
  name: string;
  size: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  errorMessage?: string;
}

export const UploadMemoryModal: React.FC<UploadMemoryModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [photoItems, setPhotoItems] = useState<PhotoUploadItem[]>([]);
  
  // YouTube Videos section state (Supports multiple videos)
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeLinkItem[]>([]);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);

    const filesArray = Array.from(files);
    const maxAllowed = 15;

    if (photoItems.length + filesArray.length > maxAllowed) {
      setErrorMsg(`You can upload a maximum of ${maxAllowed} photos in one memory post.`);
      return;
    }

    const newItems: PhotoUploadItem[] = [];
    for (const file of filesArray) {
      const validation = validateUploadFile(file, ['image']);
      if (!validation.valid) {
        setErrorMsg(validation.error || `File ${file.name} is not a valid image format.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        previewUrl,
        name: file.name,
        size: file.size,
        status: 'uploading',
        progress: 15
      });
    }

    if (newItems.length === 0) return;

    const combinedItems = [...photoItems, ...newItems];
    setPhotoItems(combinedItems);

    // Upload new files to Supabase Storage ('memories' bucket)
    await uploadPhotoList(newItems, combinedItems);
  };

  const uploadPhotoList = async (itemsToUpload: PhotoUploadItem[], allCurrentItems: PhotoUploadItem[]) => {
    let currentPool = [...allCurrentItems];

    for (const item of itemsToUpload) {
      if (!item.file) continue;

      try {
        const uploadRes = await uploadFileToStorage(
          'memories',
          item.file,
          currentUser?.id || 'anonymous',
          (percent) => {
            currentPool = currentPool.map(it =>
              it.id === item.id ? { ...it, progress: percent, status: 'uploading' } : it
            );
            setPhotoItems([...currentPool]);
          }
        );

        if (uploadRes.error) {
          currentPool = currentPool.map(it =>
            it.id === item.id ? { 
              ...it, 
              status: 'error', 
              errorMessage: uploadRes.error || 'Upload failed' 
            } : it
          );
          setPhotoItems([...currentPool]);
        } else {
          currentPool = currentPool.map(it =>
            it.id === item.id ? { 
              ...it, 
              status: 'success', 
              storagePath: uploadRes.storagePath,
              progress: 100 
            } : it
          );
          setPhotoItems([...currentPool]);
        }
      } catch (err: any) {
        currentPool = currentPool.map(it =>
          it.id === item.id ? { 
            ...it, 
            status: 'error', 
            errorMessage: err.message || 'Upload failed' 
          } : it
        );
        setPhotoItems([...currentPool]);
      }
    }
  };

  const retryUpload = async (itemId: string) => {
    const target = photoItems.find(p => p.id === itemId);
    if (!target || !target.file) return;

    setPhotoItems(prev => prev.map(p => p.id === itemId ? { ...p, status: 'uploading', progress: 20, errorMessage: undefined } : p));
    await uploadPhotoList([target], photoItems);
  };

  const removePhoto = (id: string) => {
    setPhotoItems(prev => prev.filter(item => item.id !== id));
  };

  const movePhoto = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photoItems.length) return;

    const newArr = [...photoItems];
    const [moved] = newArr.splice(index, 1);
    newArr.splice(targetIndex, 0, moved);
    setPhotoItems(newArr);
  };

  const handleAddYoutubeLinks = () => {
    const trimmed = youtubeInput.trim();
    if (!trimmed) {
      setYoutubeError('Please enter one or more YouTube links.');
      return;
    }

    const parsed = extractAllYouTubeLinks(trimmed);
    if (parsed.length === 0) {
      setYoutubeError('No valid YouTube video links found. (e.g. youtube.com/watch?v=... or youtu.be/...)');
      return;
    }

    // Merge without duplicates
    const existingVideoIds = new Set(youtubeVideos.map(v => v.videoId));
    const newVideos: YouTubeLinkItem[] = [];

    for (const item of parsed) {
      if (!existingVideoIds.has(item.videoId)) {
        newVideos.push(item);
        existingVideoIds.add(item.videoId);
      }
    }

    if (newVideos.length === 0) {
      setYoutubeError('These YouTube videos are already in the list.');
      return;
    }

    const updated = [...youtubeVideos, ...newVideos];
    if (updated.length > 10) {
      setYoutubeError('You can add up to 10 YouTube videos per memory post.');
      setYoutubeVideos(updated.slice(0, 10));
    } else {
      setYoutubeVideos(updated);
      setYoutubeError(null);
    }

    setYoutubeInput('');
    setShowYoutubeInput(false);
  };

  const handleRemoveYoutubeVideo = (videoIdToRemove: string) => {
    setYoutubeVideos(prev => prev.filter(v => v.videoId !== videoIdToRemove));
  };

  const handleClearAllYoutube = () => {
    setYoutubeVideos([]);
    setYoutubeInput('');
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

    // Check if user has an unsubmitted video URL in input box
    let finalVideos = [...youtubeVideos];
    if (youtubeInput.trim()) {
      const parsedUnsubmitted = extractAllYouTubeLinks(youtubeInput.trim());
      for (const item of parsedUnsubmitted) {
        if (!finalVideos.some(v => v.videoId === item.videoId)) {
          finalVideos.push(item);
        }
      }
    }

    const hasPhotos = photoItems.length > 0;
    const hasVideos = finalVideos.length > 0;

    if (!hasPhotos && !hasVideos) {
      setErrorMsg('Please add at least one photo or a YouTube video.');
      return;
    }

    // Check if any photo is still uploading
    if (hasPhotos) {
      const isUploading = photoItems.some(p => p.status === 'uploading');
      if (isUploading) {
        setErrorMsg('Please wait for all photos to finish uploading before publishing.');
        return;
      }

      // Check if any photo failed
      const failedPhotos = photoItems.filter(p => p.status === 'error' || !p.storagePath);
      if (failedPhotos.length > 0) {
        setErrorMsg('Some photos could not be uploaded. Please retry or remove the failed photos.');
        return;
      }
    }

    const validPaths = photoItems
      .map(p => p.storagePath)
      .filter((p): p is string => Boolean(p));

    if (hasPhotos && validPaths.length === 0 && !hasVideos) {
      setErrorMsg('No valid media found. Please upload photos or add a YouTube video.');
      return;
    }

    const ytUrlsList = finalVideos.map(v => v.url);
    const primaryYtUrl = ytUrlsList[0] || null;
    const primaryYtId = finalVideos[0]?.videoId || null;

    setIsSubmitting(true);
    try {
      const res = await appStore.addMemory(
        title.trim(),
        caption.trim(),
        validPaths,
        date,
        location.trim(),
        taggedUserIds,
        primaryYtUrl,
        primaryYtId,
        ytUrlsList
      );

      if (res && res.success) {
        const parts: string[] = [];
        if (validPaths.length > 0) {
          parts.push(`${validPaths.length} photo${validPaths.length > 1 ? 's' : ''}`);
        }
        if (finalVideos.length > 0) {
          parts.push(`${finalVideos.length} YouTube video${finalVideos.length > 1 ? 's' : ''}`);
        }
        const mediaDesc = parts.join(' & ') || 'media';

        showToast(
          'Memory Created!', 
          `Published "${title}" with ${mediaDesc} to shared timeline.`, 
          'success'
        );
        onClose();
      } else {
        setErrorMsg(res?.error || 'Failed to save memory to database.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to publish memory post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasUploading = photoItems.some(p => p.status === 'uploading');
  const hasErrors = photoItems.some(p => p.status === 'error');
  const allSuccess = photoItems.length > 0 && photoItems.every(p => p.status === 'success');
  const hasAnyMedia = photoItems.length > 0 || youtubeVideos.length > 0 || Boolean(youtubeInput.trim());

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
            <Images className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Create Group Memory</h3>
            <p className="text-xs text-slate-400">Share photos and/or a YouTube video under one caption</p>
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
              placeholder="e.g. College Trip 🏖️ or Canteen Party 🎉"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Optional YouTube Video Section */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-slate-200">🎥 Add YouTube Videos</span>
                {youtubeVideos.length > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-950/80 border border-red-800/60 text-red-400 text-[10px] font-bold">
                    {youtubeVideos.length}/10
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">(optional)</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {youtubeVideos.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllYoutube}
                    disabled={isSubmitting}
                    className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-colors px-2 py-0.5"
                  >
                    Clear All
                  </button>
                )}
                {youtubeVideos.length < 10 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowYoutubeInput(true);
                      setYoutubeError(null);
                    }}
                    disabled={isSubmitting}
                    className="px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 hover:bg-red-900/80 text-[11px] font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{youtubeVideos.length > 0 ? 'Add more videos' : 'Add YouTube video'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* List of Added YouTube Videos */}
            {youtubeVideos.length > 0 && (
              <div className="space-y-2 pt-1">
                {youtubeVideos.map((video, idx) => (
                  <div 
                    key={video.videoId + idx} 
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900 border border-red-900/40 hover:border-red-800/60 transition-colors"
                  >
                    <div className="relative w-20 aspect-video rounded-lg overflow-hidden bg-black shrink-0 border border-red-500/20">
                      <img
                        src={getYouTubeThumbnailUrl(video.videoId, 'mq')}
                        alt="YouTube thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Video className="w-4 h-4 text-red-400 drop-shadow" />
                      </div>
                      <div className="absolute top-1 left-1 px-1 py-0.2 bg-black/70 rounded text-[9px] font-mono text-white">
                        #{idx + 1}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Video #{idx + 1} Added</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate font-mono">
                        ID: {video.videoId}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Open in YouTube"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveYoutubeVideo(video.videoId)}
                        disabled={isSubmitting}
                        className="p-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition-colors"
                        title="Remove Video"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Input field for YouTube link(s) */}
            {(showYoutubeInput || youtubeVideos.length === 0) && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <input
                    type="url"
                    disabled={isSubmitting}
                    placeholder="Paste YouTube link (multiple links or IDs separated by space/comma supported)..."
                    value={youtubeInput}
                    onChange={e => {
                      setYoutubeInput(e.target.value);
                      setYoutubeError(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddYoutubeLinks();
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleAddYoutubeLinks}
                    disabled={isSubmitting || !youtubeInput.trim()}
                    className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-colors shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                  {youtubeVideos.length > 0 && (
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
                  )}
                </div>

                {youtubeError && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {youtubeError}
                  </p>
                )}
                <p className="text-[10px] text-slate-400">
                  Supports video URLs, Shorts, and youtu.be links. You can add multiple videos to the same memory!
                </p>
              </div>
            )}
          </div>

          {/* Multiple Photo Selection & Previews */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Photos <span className="text-slate-500 text-[10px]">({photoItems.length}/15)</span>
              </label>
              {photoItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || photoItems.length >= 15}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add More Photos</span>
                </button>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/*"
              className="hidden"
              onChange={e => {
                handleFilesSelected(e.target.files);
                if (e.target) e.target.value = '';
              }}
            />

            {photoItems.length === 0 ? (
              /* Drop / Select Zone */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-indigo-500/60 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-slate-950/70 group"
              >
                <div className="w-10 h-10 mx-auto mb-1.5 rounded-xl bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-200">Click to Select Photos</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Select photo1.jpg, photo2.jpg, photo3.jpg... (Optional if video is attached)</p>
              </div>
            ) : (
              /* Photo Thumbnails Strip / Grid */
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1">
                  {photoItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800 group shadow-md"
                    >
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />

                      {/* Photo Sequence Badge */}
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-sm text-[9px] font-extrabold text-white border border-white/10">
                        #{idx + 1} {idx === 0 && 'Cover'}
                      </div>

                      {/* Status indicator */}
                      {item.status === 'uploading' && (
                        <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center p-1">
                          <Loader2 className="w-4 h-4 text-indigo-400 animate-spin mb-1" />
                          <span className="text-[9px] font-bold text-slate-300">{item.progress}%</span>
                        </div>
                      )}

                      {item.status === 'success' && (
                        <div className="absolute top-1 right-1 p-0.5 rounded-full bg-emerald-950/90 text-emerald-400 border border-emerald-700/50">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                      )}

                      {item.status === 'error' && (
                        <div className="absolute inset-0 bg-rose-950/80 flex flex-col items-center justify-center p-1 text-center">
                          <AlertCircle className="w-4 h-4 text-rose-400 mb-1" />
                          <button
                            type="button"
                            onClick={() => retryUpload(item.id)}
                            className="text-[9px] font-bold text-white bg-rose-700 hover:bg-rose-600 px-1.5 py-0.5 rounded"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {/* Hover action overlay (Reorder & Remove) */}
                      <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => movePhoto(idx, 'left')}
                            className="p-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
                            title="Move Left"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                        )}
                        {idx < photoItems.length - 1 && (
                          <button
                            type="button"
                            onClick={() => movePhoto(idx, 'right')}
                            className="p-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
                            title="Move Right"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(item.id)}
                          className="p-1 rounded bg-rose-950 text-rose-300 hover:bg-rose-800"
                          title="Remove Photo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add more button tile inside grid */}
                  {photoItems.length < 15 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="aspect-square rounded-xl border border-dashed border-slate-700 hover:border-indigo-500/70 bg-slate-950/40 hover:bg-slate-900 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-300 transition-colors"
                    >
                      <Plus className="w-4 h-4 mb-0.5" />
                      <span className="text-[10px] font-bold">Add Photo</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1 border-t border-slate-900">
                  <span>Photo #1 will be used as the cover photo</span>
                  {hasUploading ? (
                    <span className="text-indigo-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Uploading to storage...
                    </span>
                  ) : allSuccess ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3 h-3" /> {photoItems.length} photos ready
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* ONE Caption for the entire memory */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Caption / Story for this Memory
            </label>
            <textarea
              rows={2}
              disabled={isSubmitting}
              placeholder="e.g. College trip with the gang ❤️ Such an unforgettable weekend!"
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
                placeholder="e.g. Goa Beach, Campus Canteen"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Tag Crew Friends */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tag Crew Friends</label>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1">
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
          <button
            type="submit"
            disabled={isSubmitting || hasUploading || hasErrors || !hasAnyMedia}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing Memory Post...</span>
              </>
            ) : hasUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading Photos ({photoItems.filter(p => p.status === 'success').length}/{photoItems.length})...</span>
              </>
            ) : (
              <span>
                Publish Memory ({photoItems.length > 0 && `${photoItems.length} Photo${photoItems.length > 1 ? 's' : ''}`}{photoItems.length > 0 && youtubeVideos.length > 0 && ' + '}{youtubeVideos.length > 0 && `${youtubeVideos.length} YouTube Video${youtubeVideos.length > 1 ? 's' : ''}`}{!hasAnyMedia && 'Add Media'})
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
