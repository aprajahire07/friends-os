import React, { useState, useEffect } from 'react';
import { 
  Images, 
  Plus, 
  X, 
  Lock, 
  Unlock, 
  Settings, 
  ShieldCheck, 
  Trash2, 
  Tag, 
  ChevronLeft, 
  ChevronRight, 
  User,
  MapPin,
  Calendar,
  Layers,
  Video,
  Edit3,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { isUserAdmin } from '../../services/appSettings';
import { Memory } from '../../types';
import { getSyncMediaUrl } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { UploadMemoryModal } from './UploadMemoryModal';
import { EditMemoryModal } from './EditMemoryModal';
import { MemoryLockedView } from './MemoryLockedView';
import { MemorySettingsModal } from './MemorySettingsModal';
import { extractYouTubeVideoId, getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '../../lib/youtube';

export const MemoryGallery: React.FC = () => {
  const { showToast } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0); // 0..N-1 for photos, or special for video
  const [isDeleting, setIsDeleting] = useState(false);

  const [memoryToDelete, setMemoryToDelete] = useState<Memory | null>(null);

  const store = useAppStore();
  const currentUser = store.currentUser;
  const isAdmin = isUserAdmin(currentUser);

  const isLocked = store.memoriesLocked && !store.sessionUnlockedMemories && !isAdmin;
  const memories = store.memories;

  // Keyboard navigation for photo carousel
  useEffect(() => {
    if (!selectedMemory) return;

    const totalPhotos = selectedMemory.media_urls?.length || 0;
    const hasVideo = Boolean(selectedMemory.youtube_video_id || (selectedMemory.youtube_url && extractYouTubeVideoId(selectedMemory.youtube_url)));
    const totalItems = totalPhotos + (hasVideo ? 1 : 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMemory(null);
      } else if (e.key === 'ArrowLeft') {
        setActiveMediaIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveMediaIndex(prev => Math.min(totalItems - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMemory]);

  // Group memories by Year and Month
  const groupedMemories: { [yearMonth: string]: Memory[] } = {};
  if (!isLocked) {
    memories.forEach(mem => {
      const parts = (mem.date || new Date().toISOString().split('T')[0]).split('-');
      const year = parts[0] || '2026';
      const monthNum = parseInt(parts[1] || '8', 10);
      const monthName = new Date(2026, Math.max(0, monthNum - 1), 1).toLocaleString('en-US', { month: 'long' });
      const key = `${year} — ${monthName}`;

      if (!groupedMemories[key]) groupedMemories[key] = [];
      groupedMemories[key].push(mem);
    });
  }

  const canManageMemory = (mem: Memory) => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    if (mem.creator_id === currentUser.id) return true;
    if (mem.creator_profile?.id === currentUser.id) return true;
    if (mem.creator_profile?.email && currentUser.email && mem.creator_profile.email.toLowerCase() === currentUser.email.toLowerCase()) return true;
    return false;
  };

  const confirmDeleteMemory = (e: React.MouseEvent, mem: Memory) => {
    e.stopPropagation();
    setMemoryToDelete(mem);
  };

  const handleExecuteDelete = async () => {
    if (!memoryToDelete) return;
    const mem = memoryToDelete;

    setIsDeleting(true);
    try {
      const success = await appStore.deleteMemory(mem.id);
      if (success) {
        showToast('Memory Deleted', `"${mem.title}" has been deleted.`, 'info');
        if (selectedMemory?.id === mem.id) {
          setSelectedMemory(null);
        }
        setMemoryToDelete(null);
      } else {
        showToast('Delete Failed', 'You may not have permission to delete this memory.', 'error');
      }
    } catch (err: any) {
      showToast('Delete Error', err?.message || 'Failed to delete memory.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenMemoryModal = (mem: Memory, initialIndex = 0) => {
    setSelectedMemory(mem);
    setActiveMediaIndex(initialIndex);
  };

  const isVideoUrl = (url?: string) => {
    if (!url) return false;
    return /\.(mp4|webm|mov|mkv)$/i.test(url);
  };

  // Helper to get safe video ID for a memory
  const getMemoryVideoId = (mem: Memory): string | null => {
    if (mem.youtube_video_id) return mem.youtube_video_id;
    if (mem.youtube_url) return extractYouTubeVideoId(mem.youtube_url);
    return null;
  };

  // Helper to render YouTube responsive embed container
  const renderYouTubeEmbed = (videoId: string, title?: string) => {
    const embedUrl = getYouTubeEmbedUrl(videoId);

    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-md">
        <iframe
          src={embedUrl}
          title={title || 'YouTube video player'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="w-full h-full border-0 absolute inset-0"
        />
      </div>
    );
  };

  // Helper to render the multi-photo collage grid
  const renderPhotoGrid = (mem: Memory) => {
    const urls = mem.media_urls || [];
    const count = urls.length;

    if (count === 0) {
      return null;
    }

    if (count === 1) {
      const isVideo = isVideoUrl(urls[0]);
      return (
        <div 
          onClick={() => handleOpenMemoryModal(mem, 0)}
          className="aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer group relative shadow-md"
        >
          {isVideo ? (
            <video
              src={getSyncMediaUrl('memories', urls[0])}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          ) : (
            <img
              src={getSyncMediaUrl('memories', urls[0])}
              alt={mem.title}
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            />
          )}
        </div>
      );
    }

    if (count === 2) {
      return (
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
          {urls.slice(0, 2).map((url, idx) => (
            <div
              key={idx}
              onClick={() => handleOpenMemoryModal(mem, idx)}
              className="aspect-square relative overflow-hidden cursor-pointer group"
            >
              <img
                src={getSyncMediaUrl('memories', url)}
                alt={`${mem.title} ${idx + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      );
    }

    if (count === 3) {
      return (
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
          <div
            onClick={() => handleOpenMemoryModal(mem, 0)}
            className="col-span-2 aspect-[4/3] relative overflow-hidden cursor-pointer group"
          >
            <img
              src={getSyncMediaUrl('memories', urls[0])}
              alt={`${mem.title} 1`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="grid grid-rows-2 gap-1.5">
            {urls.slice(1, 3).map((url, idx) => (
              <div
                key={idx}
                onClick={() => handleOpenMemoryModal(mem, idx + 1)}
                className="h-full relative overflow-hidden cursor-pointer group"
              >
                <img
                  src={getSyncMediaUrl('memories', url)}
                  alt={`${mem.title} ${idx + 2}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 4 or more photos: 2x2 grid with +N more overlay on 4th photo
    const remaining = count - 4;
    return (
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
        {urls.slice(0, 3).map((url, idx) => (
          <div
            key={idx}
            onClick={() => handleOpenMemoryModal(mem, idx)}
            className="aspect-square relative overflow-hidden cursor-pointer group"
          >
            <img
              src={getSyncMediaUrl('memories', url)}
              alt={`${mem.title} ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ))}

        {/* 4th photo with +N overlay if more */}
        <div
          onClick={() => handleOpenMemoryModal(mem, 3)}
          className="aspect-square relative overflow-hidden cursor-pointer group"
        >
          <img
            src={getSyncMediaUrl('memories', urls[3])}
            alt={`${mem.title} 4`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {remaining > 0 && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center text-white transition-colors group-hover:bg-slate-950/65">
              <span className="text-xl font-extrabold tracking-tight">+{remaining}</span>
              <span className="text-[10px] font-bold text-slate-300">More Photos</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLocked) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header with Admin settings toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-950/80 border border-indigo-800/60 rounded-2xl text-indigo-400 shadow-inner">
              <Images className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Memories Timeline</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Protected
                </span>
              </h2>
              <p className="text-xs text-slate-400">Vault locked. Enter passcode to access shared memories.</p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
              title="Memories Lock Settings (Admin Only)"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

        <MemoryLockedView />
        <MemorySettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 p-4 sm:p-5 rounded-3xl backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-950/80 border border-indigo-800/60 rounded-2xl text-indigo-400 shadow-inner">
            <Images className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Memories Timeline</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-800/60 text-indigo-300 font-semibold">
                {memories.length} {memories.length === 1 ? 'post' : 'posts'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">Group shared memories, multi-photo posts & YouTube videos</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isAdmin && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Security & Lock Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Memory</span>
          </button>
        </div>
      </div>

      {/* Main Feed of Memories or Empty State */}
      {memories.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-3xl p-12 text-center bg-slate-900/30 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-950/60 border border-indigo-800/40 mx-auto flex items-center justify-center text-indigo-400">
            <Images className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Group Memories Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Be the first to post a multi-photo memory story or share a YouTube video with your crew!
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add First Memory Post</span>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedMemories).map(([groupKey, groupItems]) => (
            <div key={groupKey} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-px bg-slate-800 flex-1"></span>
                <h3 className="text-[11px] font-extrabold text-indigo-400 uppercase tracking-widest px-2.5 bg-slate-900/80 py-0.5 rounded-full border border-indigo-900/40">
                  {groupKey}
                </h3>
                <span className="h-px bg-slate-800 flex-1"></span>
              </div>

              {/* Feed of Memory Posts */}
              <div className="space-y-6">
                {groupItems.map(mem => {
                  const creator = mem.creator_profile || store.profiles.find(p => p.id === mem.creator_id);
                  const photoCount = mem.media_urls?.length || 0;
                  const videoId = getMemoryVideoId(mem);
                  const canEdit = canManageMemory(mem);

                  return (
                    <div
                      key={mem.id}
                      className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden p-4 sm:p-5 text-slate-100 shadow-xl space-y-3.5 hover:border-slate-700/80 transition-colors"
                    >
                      {/* Post Header: Creator, Title, Meta */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-950 border border-indigo-800/60 overflow-hidden flex items-center justify-center shrink-0">
                            {creator?.avatar_url ? (
                              <img
                                src={getSyncMediaUrl('avatars', creator.avatar_url)}
                                alt={creator.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-bold text-indigo-300">
                                {creator?.full_name?.charAt(0) || 'U'}
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white leading-snug">{mem.title}</h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                              <span>by @{creator?.username || 'crew'}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                {mem.date}
                              </span>
                              {mem.location && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <MapPin className="w-3 h-3 text-rose-400" />
                                    {mem.location}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Media Badges & Action Buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {photoCount > 0 && (
                            <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-extrabold text-indigo-300 flex items-center gap-1.5">
                              <Images className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{photoCount} {photoCount === 1 ? 'photo' : 'photos'}</span>
                            </span>
                          )}

                          {videoId && (
                            <span className="px-2.5 py-1 rounded-xl bg-red-950/60 border border-red-800/60 text-[11px] font-extrabold text-red-300 flex items-center gap-1.5">
                              <Video className="w-3.5 h-3.5 text-red-400" />
                              <span>YouTube</span>
                            </span>
                          )}

                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMemory(mem);
                              }}
                              className="p-2 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
                              title="Edit Memory"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {canManageMemory(mem) && (
                            <button
                              onClick={(e) => confirmDeleteMemory(e, mem)}
                              disabled={isDeleting}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition-colors disabled:opacity-50"
                              title="Delete Memory"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Embedded YouTube Video if present */}
                      {videoId && (
                        <div className="w-full">
                          {renderYouTubeEmbed(videoId, mem.title)}
                        </div>
                      )}

                      {/* Multi-Photo Grid Collage */}
                      {photoCount > 0 && renderPhotoGrid(mem)}

                      {/* Single Caption for the whole Memory Post */}
                      {mem.caption && (
                        <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80 whitespace-pre-line">
                          {mem.caption}
                        </p>
                      )}

                      {/* Tagged Friends Footer */}
                      {mem.tagged_user_ids && mem.tagged_user_ids.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                            <Tag className="w-3 h-3 text-indigo-400" /> With:
                          </span>
                          {mem.tagged_user_ids.map(uid => {
                            const taggedUser = store.profiles.find(p => p.id === uid);
                            return (
                              <span
                                key={uid}
                                className="px-2 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-800/60 text-[10px] font-semibold text-indigo-300"
                              >
                                @{taggedUser?.username || uid}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Photo/Video Viewer Modal */}
      {selectedMemory && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
            {/* Top Bar */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-indigo-950/80 text-indigo-400 border border-indigo-800/60 shrink-0">
                  <Images className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{selectedMemory.title}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    {selectedMemory.media_urls && selectedMemory.media_urls.length > 0 && (
                      <span>
                        Photo {Math.min(activeMediaIndex + 1, selectedMemory.media_urls.length)} of {selectedMemory.media_urls.length}
                      </span>
                    )}
                    {getMemoryVideoId(selectedMemory) && (
                      <>
                        <span>•</span>
                        <span className="text-red-400 font-semibold flex items-center gap-1">
                          <Video className="w-3 h-3" /> YouTube Video
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>{selectedMemory.date}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {canManageMemory(selectedMemory) && (
                  <button
                    onClick={() => {
                      setEditingMemory(selectedMemory);
                    }}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                    title="Edit Memory"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}

                {canManageMemory(selectedMemory) && (
                  <button
                    onClick={(e) => confirmDeleteMemory(e, selectedMemory)}
                    disabled={isDeleting}
                    className="p-2 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-400 hover:bg-rose-900/80 hover:text-rose-200 transition-colors disabled:opacity-50"
                    title="Delete Memory"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedMemory(null)}
                  className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Carousel / Video Viewer */}
            <div className="relative w-full bg-slate-950 flex items-center justify-center min-h-[300px] sm:min-h-[420px] max-h-[55vh] overflow-hidden select-none">
              {(() => {
                const photos = selectedMemory.media_urls || [];
                const videoId = getMemoryVideoId(selectedMemory);

                // If currently showing a photo
                if (photos.length > 0 && activeMediaIndex < photos.length) {
                  const currentMedia = photos[activeMediaIndex];
                  const isVideo = isVideoUrl(currentMedia);

                  if (isVideo) {
                    return (
                      <video
                        key={currentMedia}
                        src={getSyncMediaUrl('memories', currentMedia)}
                        controls
                        autoPlay
                        className="w-full max-h-[55vh] object-contain"
                      />
                    );
                  }

                  return (
                    <img
                      key={currentMedia}
                      src={getSyncMediaUrl('memories', currentMedia)}
                      alt={`${selectedMemory.title} photo ${activeMediaIndex + 1}`}
                      className="w-full max-h-[55vh] object-contain transition-all duration-200"
                    />
                  );
                }

                // If showing YouTube video
                if (videoId) {
                  return (
                    <div className="w-full h-full p-2 flex items-center justify-center">
                      <div className="w-full max-w-2xl aspect-video">
                        {renderYouTubeEmbed(videoId, selectedMemory.title)}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="text-slate-500 text-xs">No media preview available</div>
                );
              })()}

              {/* Prev / Next navigation arrows */}
              {selectedMemory.media_urls && selectedMemory.media_urls.length > 1 && (
                <>
                  {activeMediaIndex > 0 && (
                    <button
                      onClick={() => setActiveMediaIndex(prev => prev - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 text-white hover:bg-indigo-600 border border-white/10 transition-all shadow-lg active:scale-95"
                      title="Previous Photo (Left Arrow)"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}

                  {activeMediaIndex < selectedMemory.media_urls.length - 1 && (
                    <button
                      onClick={() => setActiveMediaIndex(prev => prev + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 text-white hover:bg-indigo-600 border border-white/10 transition-all shadow-lg active:scale-95"
                      title="Next Photo (Right Arrow)"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Clickable Thumbnail Strip */}
            {selectedMemory.media_urls && selectedMemory.media_urls.length > 1 && (
              <div className="px-4 py-2 bg-slate-950/90 border-t border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
                {selectedMemory.media_urls.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveMediaIndex(idx)}
                    className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                      activeMediaIndex === idx 
                        ? 'border-indigo-500 scale-105 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500/30' 
                        : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={getSyncMediaUrl('memories', url)}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-slate-950/80 text-[8px] font-bold text-white">
                      {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Post Information: Caption, Location, Tags */}
            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto bg-slate-900">
              {selectedMemory.caption && (
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                  <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mb-1">Caption</p>
                  <p>{selectedMemory.caption}</p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-3">
                  {selectedMemory.location && (
                    <span className="flex items-center gap-1 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      {selectedMemory.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {selectedMemory.date}
                  </span>
                </div>

                {/* Tagged Friends */}
                {selectedMemory.tagged_user_ids && selectedMemory.tagged_user_ids.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Tag className="w-3 h-3 text-indigo-400 shrink-0" />
                    {selectedMemory.tagged_user_ids.map(uid => {
                      const taggedUser = store.profiles.find(p => p.id === uid);
                      return (
                        <span
                          key={uid}
                          className="px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-[10px] font-semibold text-indigo-300"
                        >
                          @{taggedUser?.username || uid}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      {memoryToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="relative max-w-sm w-full bg-slate-900 border border-rose-900/60 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="text-base font-bold text-white">Delete Memory Post?</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-slate-200">"{memoryToDelete.title}"</strong>?
                  {memoryToDelete.media_urls && memoryToDelete.media_urls.length > 0 && ` Associated photo files (${memoryToDelete.media_urls.length}) will also be deleted.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setMemoryToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Memory'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <UploadMemoryModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} />
      <EditMemoryModal 
        isOpen={Boolean(editingMemory)} 
        memory={editingMemory} 
        onClose={() => setEditingMemory(null)} 
      />
      <MemorySettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </div>
  );
};
