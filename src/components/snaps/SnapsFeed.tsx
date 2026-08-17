import React, { useState, useEffect, useRef } from 'react';
import { 
  Flame, 
  Send, 
  Eye, 
  Clock, 
  Sparkles, 
  X, 
  Check, 
  EyeOff, 
  Loader2, 
  AlertCircle,
  Camera,
  Users,
  UserCheck
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { SnapMessage, Profile } from '../../types';
import { SendSnapModal } from './SendSnapModal';
import { useToast } from '../ui/Toast';
import { getSnapSignedUrl } from '../../services/snaps';

export const SnapsFeed: React.FC = () => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;

  const [activeSnapToView, setActiveSnapToView] = useState<SnapMessage | null>(null);
  const [activeSnapImageUrl, setActiveSnapImageUrl] = useState<string>('');
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(5);
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [recipientForSend, setRecipientForSend] = useState<Profile | null>(null);

  const snaps = store.snaps;
  const streaks = store.streaks;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // When activeSnapToView changes: fetch authorized signed URL and start timer once ready
  useEffect(() => {
    if (!activeSnapToView) {
      setActiveSnapImageUrl('');
      setIsImageLoading(false);
      setImageLoadError(null);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    let isCancelled = false;
    setIsImageLoading(true);
    setImageLoadError(null);
    const duration = activeSnapToView.view_duration || 5;
    setTimeLeft(duration);

    // Resolve secure signed URL from private Supabase Storage
    const storagePath = activeSnapToView.image_url;
    getSnapSignedUrl(storagePath)
      .then(signedUrl => {
        if (isCancelled) return;
        if (!signedUrl) {
          setImageLoadError('Could not load image from secure storage.');
          setIsImageLoading(false);
          return;
        }

        setActiveSnapImageUrl(signedUrl);

        // Preload image in memory
        const img = new Image();
        img.src = signedUrl;
        img.onload = () => {
          if (isCancelled) return;
          setIsImageLoading(false);

          // Start timer countdown only after image has loaded
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
              if (prev <= 1) {
                if (timerRef.current) clearInterval(timerRef.current);
                handleCloseSnapView();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        };
        img.onerror = () => {
          if (isCancelled) return;
          setIsImageLoading(false);
          setImageLoadError('Failed to render snap image.');
        };
      })
      .catch(err => {
        if (isCancelled) return;
        console.error('Error fetching signed URL for snap:', err);
        setImageLoadError('Failed to access secure snap image.');
        setIsImageLoading(false);
      });

    return () => {
      isCancelled = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeSnapToView]);

  const handleOpenSnap = (snap: SnapMessage) => {
    // If receiver already opened, reject one-time view
    const isReceiver = snap.sender_id !== currentUser?.id;
    if (isReceiver && (snap.status === 'opened' || snap.status === 'expired')) {
      showToast('Snap Expired', 'You have already viewed this snap once.', 'info');
      return;
    }

    // Open snap viewer
    setActiveSnapToView(snap);

    // Immediately record opened status in Supabase so sender gets Realtime 'Opened' update!
    appStore.openSnap(snap.id);
  };

  const handleCloseSnapView = () => {
    if (activeSnapToView) {
      appStore.destroySnap(activeSnapToView.id);
    }
    setActiveSnapToView(null);
  };

  const handleOpenSendTo = (friend: Profile) => {
    setRecipientForSend(friend);
    setShowSendModal(true);
  };

  // Filter into received vs sent snaps
  const receivedSnaps = snaps.filter(s => s.sender_id !== currentUser?.id);
  const sentSnaps = snaps.filter(s => s.sender_id === currentUser?.id);

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
            <span>Snaps & Daily Streaks</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Keep streaks alive with 1-time ephemeral photo snaps sent to anyone or everyone.
          </p>
        </div>

        <button
          onClick={() => {
            setRecipientForSend(null);
            setShowSendModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
        >
          <Camera className="w-4 h-4" />
          <span>New Snap</span>
        </button>
      </div>

      {/* Streaks Row */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-100">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-amber-400" />
          <span>Active Crew Streaks</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {streaks.map(st => {
            const friend = appStore.profiles.find(p => p.id === st.friend_id);
            if (!friend) return null;

            return (
              <div
                key={st.friend_id}
                onClick={() => handleOpenSendTo(friend)}
                className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <img 
                    src={friend.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} 
                    alt="" 
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-700" 
                  />
                  <div className="truncate">
                    <p className="text-xs font-bold text-white truncate">{friend.full_name.split(' ')[0]}</p>
                    <p className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      <span>{st.streak_count} Days</span>
                    </p>
                  </div>
                </div>

                <Send className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Received Snaps Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span>Inbox (Received Snaps)</span>
            {receivedSnaps.filter(s => s.status !== 'opened' && s.status !== 'expired').length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                {receivedSnaps.filter(s => s.status !== 'opened' && s.status !== 'expired').length} New
              </span>
            )}
          </h3>
        </div>

        {receivedSnaps.length === 0 ? (
          <div className="p-6 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 text-xs">
            No received snaps in inbox yet.
          </div>
        ) : (
          receivedSnaps.map(snap => {
            const sender = appStore.profiles.find(p => p.id === snap.sender_id);
            const isOpened = snap.status === 'opened' || snap.status === 'expired';

            return (
              <div
                key={snap.id}
                onClick={() => !isOpened && handleOpenSnap(snap)}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  !isOpened
                    ? 'bg-amber-950/40 border-amber-500/60 shadow-lg cursor-pointer hover:bg-amber-900/40'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={sender?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-slate-700"
                    />
                    {!isOpened && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>📸 New Snap from {sender?.full_name || 'Friend'}</span>
                      {snap.is_everyone && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-normal">
                          Crew Broadcast
                        </span>
                      )}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {new Date(snap.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 1-Time View ({snap.view_duration || 5}s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isOpened}
                    onClick={() => !isOpened && handleOpenSnap(snap)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                      isOpened
                        ? 'bg-slate-950 text-slate-500 border border-slate-800 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20 animate-pulse'
                    }`}
                  >
                    {isOpened ? (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>Opened</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3 h-3" />
                        <span>Tap to View</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sent Snaps Feed */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Sent Snaps</h3>

        {sentSnaps.length === 0 ? (
          <div className="p-6 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 text-xs">
            No sent snaps yet. Tap "New Snap" to start!
          </div>
        ) : (
          sentSnaps.map(snap => {
            const hasRecipients = snap.recipients && snap.recipients.length > 0;
            const singleRecipient = appStore.profiles.find(p => p.id === snap.recipient_id);

            return (
              <div
                key={snap.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-400">
                      {snap.is_everyone ? <Users className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {snap.is_everyone 
                          ? `Broadcast to Everyone (${snap.recipients?.length || 'All'} friends)`
                          : `Sent to ${singleRecipient?.full_name || 'Friend'}`
                        }
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {new Date(snap.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {snap.view_duration || 5}s Timer
                        {snap.caption && ` • "${snap.caption}"`}
                      </p>
                    </div>
                  </div>

                  {!hasRecipients && (
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                      snap.status === 'opened'
                        ? 'bg-indigo-950/60 border-indigo-800 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}>
                      {snap.status === 'opened' ? <Eye className="w-3 h-3 text-indigo-400" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
                      <span>{snap.status === 'opened' ? '✓ Opened' : '✓ Sent'}</span>
                    </span>
                  )}
                </div>

                {/* Per-recipient status list if multi-recipient */}
                {hasRecipients && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2">
                    {snap.recipients?.map(rec => {
                      const friend = appStore.profiles.find(p => p.id === rec.recipient_id);
                      const isRecOpened = rec.status === 'opened' || rec.status === 'expired';
                      return (
                        <div
                          key={rec.recipient_id}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border ${
                            isRecOpened
                              ? 'bg-indigo-950/40 border-indigo-800 text-indigo-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          <img
                            src={friend?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                            alt=""
                            className="w-3.5 h-3.5 rounded-full object-cover"
                          />
                          <span>{friend?.full_name.split(' ')[0] || 'Friend'}</span>
                          {isRecOpened ? (
                            <span className="text-[10px] text-indigo-400 flex items-center gap-0.5 font-mono">
                              <Eye className="w-2.5 h-2.5" /> Opened
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">
                              Delivered
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Fullscreen Snap Viewer Overlay (One-Time Ephemeral View) */}
      {activeSnapToView && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4">
          <div className="relative max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            {/* Top Timer Progress Bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-slate-800 z-20">
              <div
                className="h-full bg-amber-400 transition-all duration-1000 ease-linear"
                style={{ width: isImageLoading ? '100%' : `${(timeLeft / (activeSnapToView.view_duration || 5)) * 100}%` }}
              />
            </div>

            {/* Header info */}
            <div className="absolute top-4 inset-x-4 flex items-center justify-between text-white z-20 bg-slate-950/70 p-2 rounded-2xl backdrop-blur-md border border-slate-800/80">
              <div className="flex items-center gap-2">
                <img
                  src={appStore.profiles.find(p => p.id === activeSnapToView.sender_id)?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover border border-slate-700"
                />
                <span className="text-xs font-bold truncate max-w-[130px]">
                  {appStore.profiles.find(p => p.id === activeSnapToView.sender_id)?.full_name}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-black font-mono bg-amber-500 text-slate-950 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{timeLeft}s</span>
                </span>
                <button 
                  onClick={handleCloseSnapView} 
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image display container */}
            <div className="h-[480px] w-full bg-black relative flex items-center justify-center">
              {isImageLoading ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-amber-400 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-xs font-bold text-white">Loading secure snap image...</p>
                </div>
              ) : imageLoadError ? (
                <div className="p-6 text-center text-rose-400 flex flex-col items-center gap-2">
                  <AlertCircle className="w-8 h-8 text-rose-500" />
                  <p className="text-xs font-bold text-white">{imageLoadError}</p>
                  <button
                    onClick={handleCloseSnapView}
                    className="mt-2 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <img
                  src={activeSnapImageUrl}
                  alt="Snap"
                  className="w-full h-full object-contain"
                />
              )}

              {/* Caption Overlay */}
              {!isImageLoading && !imageLoadError && activeSnapToView.caption && (
                <div className="absolute bottom-6 inset-x-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 p-3 rounded-2xl text-center text-xs font-semibold text-white shadow-2xl">
                  {activeSnapToView.caption}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <SendSnapModal
        recipient={recipientForSend}
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
      />
    </div>
  );
};
