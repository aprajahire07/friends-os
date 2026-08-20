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
  Sparkles,
  Video,
  Play,
  ExternalLink,
  Edit3
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
import { extractAllYouTubeLinks, getYouTubeEmbedUrl, getYouTubeThumbnailUrl, YouTubeLinkItem } from '../../lib/youtube';

export const MemoryGallery: React.FC = () => {
  const { showToast } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [memoryToEdit, setMemoryToEdit] = useState<Memory | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  
  // Carousel state: either photo index or video index
  // mode: 'photo' | 'video'
  const [activeMediaType, setActiveMediaType] = useState<'photo' | 'video'>('photo');
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  
  // Track playing video ID in feed card inline player
  const [activePlayingVideoId, setActivePlayingVideoId] = useState<string | null>(null);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<Memory | null>(null);

  const store = useAppStore();
  const currentUser = store.currentUser;
  const isAdmin = isUserAdmin(currentUser);

  const isLocked = store.memoriesLocked && !store.sessionUnlockedMemories && !isAdmin;
  const memories = store.memories;

  // Extract all valid YouTube videos from a memory
  const getMemoryVideos = (mem: Memory): YouTubeLinkItem[] => {
    const rawSources = [
      ...(mem.youtube_urls || []),
      mem.youtube_url,
      mem.youtube_video_id
    ].filter(Boolean) as string[];
    return extractAllYouTubeLinks(rawSources);
  };

  // Keyboard navigation for viewer modal
  useEffect(() => {
    if (!selectedMemory) return;

    const photos = selectedMemory.media_urls || [];
    const videos = getMemoryVideos(selectedMemory);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMemory(null);
      } else if (e.key === 'ArrowLeft') {
        if (activeMediaType === 'video') {
          if (activeMediaIndex > 0) {
            setActiveMediaIndex(prev => prev - 1);
          } else if (photos.length > 0) {
            setActiveMediaType('photo');
            setActiveMediaIndex(photos.length - 1);
          }
        } else {
          if (activeMediaIndex > 0) {
            setActiveMediaIndex(prev => prev - 1);
          }
        }
      } else if (e.key === 'ArrowRight') {
        if (activeMediaType === 'photo') {
          if (activeMediaIndex < photos.length - 1) {
            setActiveMediaIndex(prev => prev + 1);
          } else if (videos.length > 0) {
            setActiveMediaType('video');
            setActiveMediaIndex(0);
          }
        } else {
          if (activeMediaIndex < videos.length - 1) {
            setActiveMediaIndex(prev => prev + 1);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMemory, activeMediaType, activeMediaIndex]);

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

  const canEditOrDeleteMemory = (mem: Memory) => {
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

  const handleOpenMemoryModal = (mem: Memory, type: 'photo' | 'video' = 'photo', index = 0) => {
    setSelectedMemory(mem);
    setActiveMediaType(type);
    setActiveMediaIndex(index);
  };

  const isVideoUrl = (url?: string) => {
    if (!url) return false;
    return /\.(mp4|webm|mov|mkv)$/i.test(url);
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
          onClick={() => handleOpenMemoryModal(mem, 'photo', 0)}
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
              onClick={() => handleOpenMemoryModal(mem, 'photo', idx)}
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
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
          <div
            onClick={() => handleOpenMemoryModal(mem, 'photo', 0)}
            className="aspect-square relative overflow-hidden cursor-pointer group"
          >
            <img
              src={getSyncMediaUrl('memories', urls[0])}
              alt={`${mem.title} 1`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="grid grid-rows-2 gap-1.5 h-full">
            {urls.slice(1, 3).map((url, idx) => (
              <div
                key={idx}
                onClick={() => handleOpenMemoryModal(mem, 'photo', idx + 1)}
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
            onClick={() => handleOpenMemoryModal(mem, 'photo', idx)}
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
          onClick={() => handleOpenMemoryModal(mem, 'photo', 3)}
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

  // Helper to render YouTube videos section in a memory card
  const renderYouTubeSection = (mem: Memory) => {
    const videos = getMemoryVideos(mem);
    if (videos.length === 0) return null;

    return (
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Video className="w-4 h-4 text-red-400" />
            <span>YouTube Videos ({videos.length})</span>
          </div>
          {videos.length > 1 && (
            <span className="text-[10px] text-slate-400 font-medium">
              Click to play video or open
            </span>
          )}
        </div>

        <div className={`grid gap-3 ${videos.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {videos.map((video, idx) => {
            const isPlaying = activePlayingVideoId === `${mem.id}-${video.videoId}`;
            
            return (
              <div 
                key={video.videoId + idx} 
                className="bg-slate-950 border border-slate-800/90 rounded-2xl overflow-hidden shadow-lg group hover:border-red-900/60 transition-all flex flex-col"
              >
                {/* Video Player or Thumbnail */}
                <div className="relative aspect-video w-full bg-black">
                  {isPlaying ? (
                    <iframe
                      src={`${getYouTubeEmbedUrl(video.videoId)}&autoplay=1`}
                      title={`YouTube Video ${idx + 1}`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div 
                      onClick={() => setActivePlayingVideoId(`${mem.id}-${video.videoId}`)}
                      className="relative w-full h-full cursor-pointer group/thumb"
                    >
                      <img
                        src={getYouTubeThumbnailUrl(video.videoId, 'hq')}
                        alt="YouTube thumbnail"
                        className="w-full h-full object-cover group-hover/thumb:scale-103 transition-transform duration-300"
                        onError={(e) => {
                          // Fallback to medium quality if high quality is unavailable
                          (e.target as HTMLImageElement).src = getYouTubeThumbnailUrl(video.videoId, 'mq');
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover/thumb:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-2xl bg-red-600/90 group-hover/thumb:bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-600/40 group-hover/thumb:scale-110 transition-all duration-200">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>
                      
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-sm text-[10px] font-bold text-white flex items-center gap-1 border border-white/10">
                        <Video className="w-3 h-3 text-red-400" />
                        <span>Video #{idx + 1}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer actions on the video item */}
                <div className="p-2.5 bg-slate-900/90 flex items-center justify-between gap-2 border-t border-slate-800/80">
                  <div className="min-w-0 flex items-center gap-1.5 text-[11px] text-slate-300">
                    <span className="font-mono text-slate-400 text-[10px] truncate">
                      ID: {video.videoId}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenMemoryModal(mem, 'video', idx)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors"
                      title="Expand to Fullscreen Player"
                    >
                      Expand
                    </button>
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Open in YouTube"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Images className="w-5 h-5 text-indigo-400" />
              <span>Memories & Albums 📸</span>
            </h2>
            {store.memoriesLocked ? (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 font-bold text-[10px] flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                <Unlock className="w-3 h-3" /> Unlocked
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            College trips, campus hangouts, and gang moments with photos and multiple YouTube videos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin Settings Button */}
          {isAdmin && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all flex items-center gap-1.5 shadow"
              title="Admin Memory Lock & Passcode Settings"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>Admin Settings</span>
            </button>
          )}

          {/* Normal user Re-lock button if currently unlocked */}
          {!isLocked && store.memoriesLocked && !isAdmin && (
            <button
              onClick={() => {
                appStore.sessionUnlockedMemories = false;
                showToast('Memories Locked', 'Session locked successfully.', 'info');
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span>Lock</span>
            </button>
          )}

          {!isLocked && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Add Memory</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Notice Banner if Admin is viewing locked memories */}
      {isAdmin && store.memoriesLocked && (
        <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-between gap-3 text-xs text-indigo-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong>Admin Mode:</strong> Memories are locked for regular members. You have administrative access.
            </span>
          </div>
          <button
            onClick={() => appStore.toggleMemoriesLock(false)}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shrink-0"
          >
            Unlock for All
          </button>
        </div>
      )}

      {/* Conditional Rendering: Locked View vs Photo Gallery */}
      {isLocked ? (
        <MemoryLockedView />
      ) : memories.length === 0 ? (
        <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 text-xs space-y-3 shadow-xl">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
            <Images className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-white">Your memory timeline is waiting 📸</p>
          <p className="text-slate-400 max-w-sm mx-auto">
            Upload multiple photos and YouTube video links from your trip, parties, and campus days under one post with one shared caption!
          </p>
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
                <h3 className="text-[11px] font-extrabold text-indigo-400 uppercase tracking-widest px-2 bg-slate-900/80 py-0.5 rounded-full border border-indigo-900/40">
                  {groupKey}
                </h3>
                <span className="h-px bg-slate-800 flex-1"></span>
              </div>

              {/* Feed of Memory Posts */}
              <div className="space-y-6">
                {groupItems.map(mem => {
                  const creator = mem.creator_profile || store.profiles.find(p => p.id === mem.creator_id);
                  const photoCount = mem.media_urls?.length || 0;
                  const videos = getMemoryVideos(mem);
                  const videoCount = videos.length;

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

                        {/* Media Count Badges & Actions */}
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {photoCount > 0 && (
                            <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-extrabold text-indigo-300 flex items-center gap-1.5">
                              <Images className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{photoCount} {photoCount === 1 ? 'photo' : 'photos'}</span>
                            </span>
                          )}

                          {videoCount > 0 && (
                            <span className="px-2.5 py-1 rounded-xl bg-red-950/80 border border-red-800/70 text-[11px] font-extrabold text-red-300 flex items-center gap-1.5">
                              <Video className="w-3.5 h-3.5 text-red-400" />
                              <span>{videoCount} {videoCount === 1 ? 'video' : 'videos'}</span>
                            </span>
                          )}

                          {canEditOrDeleteMemory(mem) && (
                            <div className="flex items-center gap-1 ml-1">
                              <button
                                onClick={() => setMemoryToEdit(mem)}
                                className="p-2 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
                                title="Edit Memory"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => confirmDeleteMemory(e, mem)}
                                disabled={isDeleting}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition-colors disabled:opacity-50"
                                title="Delete Memory"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Multi-Photo Grid Collage (if any) */}
                      {renderPhotoGrid(mem)}

                      {/* Attached YouTube Videos (Multiple supported) */}
                      {renderYouTubeSection(mem)}

                      {/* Single Caption for the whole Memory Post */}
                      {mem.caption && (
                        <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80">
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

      {/* Fullscreen Photo & YouTube Video Carousel / Viewer Modal */}
      {selectedMemory && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
            {/* Top Bar */}
            {(() => {
              const photos = selectedMemory.media_urls || [];
              const videos = getMemoryVideos(selectedMemory);

              return (
                <div className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-2 rounded-xl border shrink-0 ${
                      activeMediaType === 'video' 
                        ? 'bg-red-950/80 text-red-400 border-red-800/60' 
                        : 'bg-indigo-950/80 text-indigo-400 border-indigo-800/60'
                    }`}>
                      {activeMediaType === 'video' ? <Video className="w-4 h-4" /> : <Images className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">{selectedMemory.title}</h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {activeMediaType === 'photo' ? (
                          <span>
                            Photo {activeMediaIndex + 1} of {photos.length || 1}
                          </span>
                        ) : (
                          <span className="text-red-400 font-semibold">
                            YouTube Video {activeMediaIndex + 1} of {videos.length}
                          </span>
                        )}
                        <span>•</span>
                        <span>{selectedMemory.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canEditOrDeleteMemory(selectedMemory) && (
                      <>
                        <button
                          onClick={() => {
                            const mem = selectedMemory;
                            setSelectedMemory(null);
                            setMemoryToEdit(mem);
                          }}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Edit Memory"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => confirmDeleteMemory(e, selectedMemory)}
                          disabled={isDeleting}
                          className="p-2 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-400 hover:bg-rose-900/80 hover:text-rose-200 transition-colors disabled:opacity-50"
                          title="Delete Memory"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedMemory(null)}
                      className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Main Media Viewer */}
            <div className="relative w-full bg-slate-950 flex items-center justify-center min-h-[300px] sm:min-h-[420px] max-h-[55vh] overflow-hidden select-none">
              {(() => {
                const photos = selectedMemory.media_urls || [];
                const videos = getMemoryVideos(selectedMemory);

                if (activeMediaType === 'video' && videos[activeMediaIndex]) {
                  const activeVid = videos[activeMediaIndex];
                  return (
                    <div className="w-full h-full aspect-video max-h-[55vh] flex items-center justify-center bg-black">
                      <iframe
                        key={activeVid.videoId}
                        src={`${getYouTubeEmbedUrl(activeVid.videoId)}&autoplay=1`}
                        title={`YouTube video ${activeMediaIndex + 1}`}
                        className="w-full h-full max-h-[55vh] border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                }

                const currentMedia = photos[activeMediaIndex] || photos[0];
                const isVideo = isVideoUrl(currentMedia);

                if (!currentMedia && videos.length > 0) {
                  // Fallback if no photo
                  const fallbackVid = videos[0];
                  return (
                    <div className="w-full h-full aspect-video max-h-[55vh] flex items-center justify-center bg-black">
                      <iframe
                        src={`${getYouTubeEmbedUrl(fallbackVid.videoId)}&autoplay=1`}
                        title="YouTube video"
                        className="w-full h-full max-h-[55vh] border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                }

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
              })()}

              {/* Prev / Next navigation arrows */}
              {(() => {
                const photos = selectedMemory.media_urls || [];
                const videos = getMemoryVideos(selectedMemory);
                const totalItems = photos.length + videos.length;

                if (totalItems <= 1) return null;

                const hasPrev = activeMediaType === 'video' 
                  ? activeMediaIndex > 0 || photos.length > 0 
                  : activeMediaIndex > 0;

                const hasNext = activeMediaType === 'photo' 
                  ? activeMediaIndex < photos.length - 1 || videos.length > 0 
                  : activeMediaIndex < videos.length - 1;

                return (
                  <>
                    {hasPrev && (
                      <button
                        onClick={() => {
                          if (activeMediaType === 'video') {
                            if (activeMediaIndex > 0) {
                              setActiveMediaIndex(prev => prev - 1);
                            } else if (photos.length > 0) {
                              setActiveMediaType('photo');
                              setActiveMediaIndex(photos.length - 1);
                            }
                          } else if (activeMediaIndex > 0) {
                            setActiveMediaIndex(prev => prev - 1);
                          }
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 text-white hover:bg-indigo-600 border border-white/10 transition-all shadow-lg active:scale-95"
                        title="Previous Item (Left Arrow)"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}

                    {hasNext && (
                      <button
                        onClick={() => {
                          if (activeMediaType === 'photo') {
                            if (activeMediaIndex < photos.length - 1) {
                              setActiveMediaIndex(prev => prev + 1);
                            } else if (videos.length > 0) {
                              setActiveMediaType('video');
                              setActiveMediaIndex(0);
                            }
                          } else if (activeMediaIndex < videos.length - 1) {
                            setActiveMediaIndex(prev => prev + 1);
                          }
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 text-white hover:bg-indigo-600 border border-white/10 transition-all shadow-lg active:scale-95"
                        title="Next Item (Right Arrow)"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Clickable Multi-Media Thumbnail Strip (Photos + YouTube Videos) */}
            {(() => {
              const photos = selectedMemory.media_urls || [];
              const videos = getMemoryVideos(selectedMemory);

              if (photos.length + videos.length <= 1) return null;

              return (
                <div className="px-4 py-2.5 bg-slate-950/90 border-t border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
                  {/* Photo Thumbnails */}
                  {photos.map((url, idx) => (
                    <button
                      key={`photo-${idx}`}
                      onClick={() => {
                        setActiveMediaType('photo');
                        setActiveMediaIndex(idx);
                      }}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                        activeMediaType === 'photo' && activeMediaIndex === idx 
                          ? 'border-indigo-500 scale-105 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500/30' 
                          : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={getSyncMediaUrl('memories', url)}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-slate-950/80 text-[8px] font-bold text-white">
                        P{idx + 1}
                      </span>
                    </button>
                  ))}

                  {/* YouTube Video Thumbnails */}
                  {videos.map((vid, idx) => (
                    <button
                      key={`video-${vid.videoId}-${idx}`}
                      onClick={() => {
                        setActiveMediaType('video');
                        setActiveMediaIndex(idx);
                      }}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                        activeMediaType === 'video' && activeMediaIndex === idx 
                          ? 'border-red-500 scale-105 shadow-md shadow-red-500/20 ring-2 ring-red-500/30' 
                          : 'border-red-900/60 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={getYouTubeThumbnailUrl(vid.videoId, 'mq')}
                        alt={`Video ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Video className="w-3.5 h-3.5 text-red-400" />
                      </div>
                      <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-red-950/90 text-[8px] font-bold text-red-200 border border-red-800/40">
                        V{idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Post Information: Caption, Location, Tags */}
            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto bg-slate-900">
              {selectedMemory.caption && (
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-200 leading-relaxed">
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
        memory={memoryToEdit} 
        isOpen={Boolean(memoryToEdit)} 
        onClose={() => setMemoryToEdit(null)} 
      />
      <MemorySettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </div>
  );
};
