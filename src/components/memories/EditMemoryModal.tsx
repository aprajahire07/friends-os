import React, { useState, useRef, useEffect } from 'react';
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
  Edit3,
  Plus,
  Images,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { Memory } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { isUserAdmin } from '../../services/appSettings';
import { useToast } from '../ui/Toast';
import { validateUploadFile, uploadFileToStorage, getSyncMediaUrl } from '../../services/storage';
import { extractAllYouTubeLinks, getYouTubeThumbnailUrl, YouTubeLinkItem } from '../../lib/youtube';

interface EditMemoryModalProps {
  memory: Memory | null;
  isOpen: boolean;
  onClose: () => void;
}

interface PhotoEditItem {
  id: string;
  storagePath: string;
  previewUrl: string;
  file?: File;
  name?: string;
  status: 'ready' | 'uploading' | 'error';
  progress?: number;
  errorMessage?: string;
}

export const EditMemoryModal: React.FC<EditMemoryModalProps> = ({ memory, isOpen, onClose }) => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;

  // Check strict creator or admin permission
  const isAdmin = isUserAdmin(currentUser);
  const isCreator = Boolean(
    currentUser && memory && (
      memory.creator_id === currentUser.id ||
      memory.creator_profile?.id === currentUser.id ||
      (memory.creator_profile?.email && currentUser.email && 
       memory.creator_profile.email.toLowerCase() === currentUser.email.toLowerCase())
    )
  );
  const canEdit = Boolean(isAdmin || isCreator);

  const [title, setTitle] = useState(memory?.title || '');
  const [caption, setCaption] = useState(memory?.caption || '');
  const [date, setDate] = useState(memory?.date || new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState(memory?.location || '');
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>(memory?.tagged_user_ids || []);
  
  // Photos State
  const [photos, setPhotos] = useState<PhotoEditItem[]>([]);
  const addFilesInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);

  // YouTube State (Multiple Videos Supported)
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeLinkItem[]>([]);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when memory prop changes
  useEffect(() => {
    if (memory && isOpen) {
      setTitle(memory.title || '');
      setCaption(memory.caption || '');
      setDate(memory.date || new Date().toISOString().split('T')[0]);
      setLocation(memory.location || '');
      setTaggedUserIds(memory.tagged_user_ids || []);
      
      // Initialize existing photos
      const initialPhotos: PhotoEditItem[] = (memory.media_urls || []).map((path, idx) => ({
        id: `existing-${idx}-${path}`,
        storagePath: path,
        previewUrl: getSyncMediaUrl('memories', path),
        name: `Photo #${idx + 1}`,
        status: 'ready'
      }));
      setPhotos(initialPhotos);

      // Initialize YouTube videos
      const rawSources = [
        ...(memory.youtube_urls || []),
        memory.youtube_url,
        memory.youtube_video_id
      ].filter(Boolean) as string[];
      const parsed = extractAllYouTubeLinks(rawSources);
      setYoutubeVideos(parsed);
      setYoutubeInput('');
      setShowYoutubeInput(false);
      setYoutubeError(null);
      setErrorMsg(null);
    }
  }, [memory, isOpen]);

  if (!isOpen || !memory) return null;

  // ----------------------------------------------------
  // PHOTO MANAGEMENT HANDLERS (Add, Replace, Delete, Reorder)
  // ----------------------------------------------------

  const handleAddPhotosSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);

    const filesArray = Array.from(files);
    const maxAllowed = 20;

    if (photos.length + filesArray.length > maxAllowed) {
      setErrorMsg(`You can have a maximum of ${maxAllowed} photos in one memory post.`);
      return;
    }

    const newItems: PhotoEditItem[] = [];
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
        storagePath: '',
        name: file.name,
        status: 'uploading',
        progress: 15
      });
    }

    if (newItems.length === 0) return;

    const updatedList = [...photos, ...newItems];
    setPhotos(updatedList);

    // Upload newly selected files
    await uploadNewPhotoBatch(newItems, updatedList);
  };

  const uploadNewPhotoBatch = async (newItems: PhotoEditItem[], currentPool: PhotoEditItem[]) => {
    let pool = [...currentPool];

    for (const item of newItems) {
      if (!item.file) continue;

      try {
        const uploadRes = await uploadFileToStorage(
          'memories',
          item.file,
          currentUser?.id || memory.creator_id || 'anonymous',
          (percent) => {
            pool = pool.map(p => p.id === item.id ? { ...p, progress: percent, status: 'uploading' } : p);
            setPhotos([...pool]);
          }
        );

        if (uploadRes.error || !uploadRes.storagePath) {
          pool = pool.map(p => p.id === item.id ? {
            ...p,
            status: 'error',
            errorMessage: uploadRes.error || 'Upload failed'
          } : p);
          setPhotos([...pool]);
        } else {
          pool = pool.map(p => p.id === item.id ? {
            ...p,
            status: 'ready',
            storagePath: uploadRes.storagePath,
            progress: 100
          } : p);
          setPhotos([...pool]);
        }
      } catch (err: any) {
        pool = pool.map(p => p.id === item.id ? {
          ...p,
          status: 'error',
          errorMessage: err.message || 'Upload failed'
        } : p);
        setPhotos([...pool]);
      }
    }
  };

  const handleTriggerReplacePhoto = (photoId: string) => {
    setReplacingPhotoId(photoId);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = '';
      replaceFileInputRef.current.click();
    }
  };

  const handleReplacePhotoSelected = async (files: FileList | null) => {
    if (!files || files.length === 0 || !replacingPhotoId) return;
    const file = files[0];
    const validation = validateUploadFile(file, ['image']);
    if (!validation.valid) {
      setErrorMsg(validation.error || `File ${file.name} is not a valid image.`);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const targetId = replacingPhotoId;
    setReplacingPhotoId(null);

    // Set status to uploading for this specific photo
    setPhotos(prev => prev.map(p => p.id === targetId ? {
      ...p,
      file,
      previewUrl,
      storagePath: '',
      name: file.name,
      status: 'uploading',
      progress: 20
    } : p));

    try {
      const uploadRes = await uploadFileToStorage(
        'memories',
        file,
        currentUser?.id || memory.creator_id || 'anonymous',
        (percent) => {
          setPhotos(prev => prev.map(p => p.id === targetId ? { ...p, progress: percent } : p));
        }
      );

      if (uploadRes.error || !uploadRes.storagePath) {
        setPhotos(prev => prev.map(p => p.id === targetId ? {
          ...p,
          status: 'error',
          errorMessage: uploadRes.error || 'Replacement upload failed'
        } : p));
      } else {
        setPhotos(prev => prev.map(p => p.id === targetId ? {
          ...p,
          status: 'ready',
          storagePath: uploadRes.storagePath,
          progress: 100
        } : p));
      }
    } catch (err: any) {
      setPhotos(prev => prev.map(p => p.id === targetId ? {
        ...p,
        status: 'error',
        errorMessage: err.message || 'Replacement failed'
      } : p));
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleMovePhoto = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photos.length) return;

    const updated = [...photos];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setPhotos(updated);
  };

  // ----------------------------------------------------
  // YOUTUBE VIDEOS HANDLERS
  // ----------------------------------------------------

  const handleAddYoutubeLinks = () => {
    const trimmed = youtubeInput.trim();
    if (!trimmed) {
      setYoutubeError('Please enter one or more YouTube links.');
      return;
    }

    const parsed = extractAllYouTubeLinks(trimmed);
    if (parsed.length === 0) {
      setYoutubeError('No valid YouTube video links found.');
      return;
    }

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
      setYoutubeError('Maximum 10 YouTube videos allowed.');
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

  // ----------------------------------------------------
  // SUBMIT HANDLER
  // ----------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Permission enforcement
    if (!canEdit) {
      setErrorMsg('Unauthorized: Only the creator of this memory or an Admin can save changes.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Please enter a memory title.');
      return;
    }

    // Check if any photo is still uploading
    const isUploadingAny = photos.some(p => p.status === 'uploading');
    if (isUploadingAny) {
      setErrorMsg('Please wait until all photos finish uploading.');
      return;
    }

    // Check for upload errors
    const errorPhotos = photos.filter(p => p.status === 'error');
    if (errorPhotos.length > 0) {
      setErrorMsg('Some photos failed to upload. Please remove them or try replacing them.');
      return;
    }

    // Parse any unsubmitted youtube link from text field
    let finalVideos = [...youtubeVideos];
    if (youtubeInput.trim()) {
      const parsedUnsubmitted = extractAllYouTubeLinks(youtubeInput.trim());
      for (const item of parsedUnsubmitted) {
        if (!finalVideos.some(v => v.videoId === item.videoId)) {
          finalVideos.push(item);
        }
      }
    }

    const finalMediaUrls = photos
      .map(p => p.storagePath)
      .filter(path => Boolean(path && typeof path === 'string'));

    const hasPhotos = finalMediaUrls.length > 0;
    const hasVideos = finalVideos.length > 0;

    if (!hasPhotos && !hasVideos) {
      setErrorMsg('A memory must have at least one photo or YouTube video link.');
      return;
    }

    const ytUrlsList = finalVideos.map(v => v.url);
    const primaryYtUrl = ytUrlsList[0] || null;
    const primaryYtId = finalVideos[0]?.videoId || null;

    setIsSubmitting(true);
    try {
      const success = await appStore.updateMemory(memory.id, {
        title: title.trim(),
        caption: caption.trim(),
        date,
        location: location.trim(),
        tagged_user_ids: taggedUserIds,
        media_urls: finalMediaUrls,
        youtube_url: primaryYtUrl,
        youtube_video_id: primaryYtId,
        youtube_urls: ytUrlsList
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

  // If user does not have permission, show access notice
  if (!canEdit) {
    const creatorName = memory.creator_profile?.full_name || memory.creator_profile?.username || 'the original uploader';
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-950/80 border border-rose-800/60 rounded-2xl text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Edit Access Restricted</h3>
              <p className="text-xs text-slate-400">Permission Required</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            This memory can only be edited by <strong className="text-white">{creatorName}</strong> or a Crew Admin.
          </p>
          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 text-slate-100 shadow-2xl relative max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Hidden File Inputs */}
        <input
          ref={addFilesInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={e => {
            handleAddPhotosSelected(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={replaceFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            handleReplacePhotoSelected(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-indigo-950/80 border border-indigo-800/60 rounded-2xl text-indigo-400 shadow-inner">
            <Edit3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Edit Memory Post</h3>
              {isAdmin && (
                <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800/70 text-amber-300 text-[10px] font-extrabold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Manage photos (delete, add, replace, reorder) and multiple YouTube videos.
            </p>
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

          {/* ---------------------------------------------------- */}
          {/* PHOTO MANAGEMENT SECTION (DELETE / ADD / REPLACE) */}
          {/* ---------------------------------------------------- */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Images className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">
                  Photos ({photos.length})
                </span>
                {photos.length > 0 && (
                  <span className="text-[10px] text-slate-400">
                    • Photo #1 is the collage cover
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => addFilesInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-800/70 text-indigo-300 hover:bg-indigo-900/90 text-[11px] font-bold transition-colors flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Photos</span>
              </button>
            </div>

            {/* Photos Grid with Delete, Replace, and Reorder Actions */}
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1">
                {photos.map((photo, index) => {
                  const isFirst = index === 0;
                  const isLast = index === photos.length - 1;
                  const isUploading = photo.status === 'uploading';
                  const isError = photo.status === 'error';

                  return (
                    <div
                      key={photo.id}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/90 shadow-md flex flex-col justify-between"
                    >
                      {/* Image Thumbnail */}
                      <img
                        src={photo.previewUrl}
                        alt={`Photo ${index + 1}`}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          // Fallback if local preview fails
                          (e.target as HTMLImageElement).src = getSyncMediaUrl('memories', photo.storagePath);
                        }}
                      />

                      {/* Dark gradient overlay for readable buttons */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-black/20 to-slate-950/60 opacity-90 group-hover:opacity-100 transition-opacity" />

                      {/* Top Badges */}
                      <div className="relative z-10 p-2 flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border backdrop-blur-md ${
                          isFirst 
                            ? 'bg-indigo-600/90 border-indigo-400 text-white shadow-sm' 
                            : 'bg-black/70 border-white/10 text-slate-200'
                        }`}>
                          {isFirst ? '★ Cover' : `#${index + 1}`}
                        </span>

                        {/* Delete Button */}
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="p-1.5 rounded-lg bg-rose-950/90 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-800/60 transition-all shadow-md active:scale-95 disabled:opacity-50"
                          title="Delete this photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Center Upload Progress Spinner */}
                      {isUploading && (
                        <div className="relative z-10 inset-0 flex flex-col items-center justify-center p-2 bg-black/60 backdrop-blur-xs">
                          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin mb-1" />
                          <span className="text-[10px] font-bold text-indigo-200">
                            {photo.progress || 25}%
                          </span>
                        </div>
                      )}

                      {isError && (
                        <div className="relative z-10 inset-0 flex flex-col items-center justify-center p-2 bg-rose-950/90 text-rose-200 text-center">
                          <AlertCircle className="w-4 h-4 mb-1 text-rose-400" />
                          <span className="text-[9px] font-bold leading-tight">Failed</span>
                        </div>
                      )}

                      {/* Bottom Action Controls: Replace and Reorder */}
                      <div className="relative z-10 p-1.5 bg-slate-950/80 backdrop-blur-sm border-t border-white/10 flex items-center justify-between gap-1">
                        {/* Replace Button */}
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleTriggerReplacePhoto(photo.id)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 hover:text-white transition-colors flex items-center gap-1 border border-slate-700/60"
                          title="Replace with another image"
                        >
                          <RefreshCw className="w-3 h-3 text-slate-300" />
                          <span>Replace</span>
                        </button>

                        {/* Reorder Arrows */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={isSubmitting || isFirst}
                            onClick={() => handleMovePhoto(index, 'left')}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-colors"
                            title="Move Left"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting || isLast}
                            onClick={() => handleMovePhoto(index, 'right')}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-colors"
                            title="Move Right"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add Photo Tile */}
                <div
                  onClick={() => addFilesInputRef.current?.click()}
                  className="aspect-square rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/60 bg-slate-950/40 hover:bg-slate-900/60 cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all text-slate-400 hover:text-indigo-300 group p-2 text-center"
                >
                  <div className="p-2 rounded-xl bg-slate-900 group-hover:bg-indigo-950/80 border border-slate-800 group-hover:border-indigo-800/60 text-slate-400 group-hover:text-indigo-400 transition-colors">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold">+ Add Photo</span>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => addFilesInputRef.current?.click()}
                className="py-6 px-4 rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/60 bg-slate-950/40 hover:bg-slate-900/60 cursor-pointer flex flex-col items-center justify-center gap-2 text-center transition-all group"
              >
                <div className="p-3 rounded-2xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-400 group-hover:scale-105 transition-transform">
                  <Images className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white">No photos in this memory post</p>
                  <p className="text-[11px] text-slate-400">Click to upload photos or keep it video-only</p>
                </div>
              </div>
            )}
          </div>

          {/* ---------------------------------------------------- */}
          {/* YOUTUBE VIDEOS SECTION */}
          {/* ---------------------------------------------------- */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-slate-200">YouTube Videos</span>
                {youtubeVideos.length > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-950/80 border border-red-800/60 text-red-400 text-[10px] font-bold">
                    {youtubeVideos.length}/10
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">(optional embed)</span>
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
                    className="px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 hover:bg-red-900/80 text-[11px] font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{youtubeVideos.length > 0 ? 'Add more' : 'Add Video'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* List of Attached YouTube Videos */}
            {youtubeVideos.length > 0 && (
              <div className="space-y-2 pt-1 max-h-48 overflow-y-auto">
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
                        <span>Video #{idx + 1} Attached</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate font-mono">
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

            {/* Input field */}
            {(showYoutubeInput || youtubeVideos.length === 0) && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <input
                    type="url"
                    disabled={isSubmitting}
                    placeholder="Paste YouTube links or IDs (separated by space/comma)..."
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
                  Supports YouTube watch links, youtu.be links, and YouTube Shorts.
                </p>
              </div>
            )}
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

