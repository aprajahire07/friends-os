import React, { useState, useEffect } from 'react';
import { Flame, Send, Eye, Clock, Sparkles, X, Check, EyeOff } from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { SnapMessage, Profile } from '../../types';
import { SendSnapModal } from './SendSnapModal';
import { useToast } from '../ui/Toast';
import { getResolvedMediaUrl } from '../../services/storage';

export const SnapsFeed: React.FC = () => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;

  const [activeSnapToView, setActiveSnapToView] = useState<SnapMessage | null>(null);
  const [activeSnapImageUrl, setActiveSnapImageUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showSendModal, setShowSendModal] = useState(false);
  const [recipientForSend, setRecipientForSend] = useState<Profile | null>(null);

  const snaps = store.snaps;
  const streaks = store.streaks;

  // Countdown timer for active viewing snap
  useEffect(() => {
    if (!activeSnapToView) {
      setActiveSnapImageUrl('');
      return;
    }

    getResolvedMediaUrl('snaps', activeSnapToView.image_url).then(url => {
      setActiveSnapImageUrl(url);
    });

    setTimeLeft(5);

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleCloseSnapView();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSnapToView]);

  const handleOpenSnap = (snap: SnapMessage) => {
    if (snap.status === 'opened' && snap.recipient_id === currentUser.id) {
      showToast('Snap Expired', 'You have already viewed this snap once.', 'info');
      return;
    }

    setActiveSnapToView(snap);
    appStore.markSnapAsOpened(snap.id);
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
            Keep streaks alive with daily college photos & timed snaps.
          </p>
        </div>

        <button
          onClick={() => {
            setRecipientForSend(null);
            setShowSendModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
        >
          <Send className="w-4 h-4" />
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
                  <img src={friend.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
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

      {/* Snaps Inbox */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Snap History & Inbox</h3>

        {snaps.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 text-xs">
            No snaps sent yet. Tap "New Snap" above to send one!
          </div>
        ) : (
          snaps.map(snap => {
            const isSender = snap.sender_id === currentUser.id;
            const otherPersonId = isSender ? snap.recipient_id : snap.sender_id;
            const otherPerson = appStore.profiles.find(p => p.id === otherPersonId);
            const isOpened = snap.status === 'opened' || snap.status === 'expired';

            return (
              <div
                key={snap.id}
                onClick={() => !isSender && handleOpenSnap(snap)}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  !isSender && !isOpened
                    ? 'bg-amber-950/40 border-amber-500/60 shadow-lg cursor-pointer hover:bg-amber-900/40'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={otherPerson?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-slate-700"
                    />
                    {!isSender && !isOpened && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {isSender ? `Sent to ${otherPerson?.full_name}` : `New Snap from ${otherPerson?.full_name}`}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {new Date(snap.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 5s Timer
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isSender ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-950 text-slate-400 border border-slate-800 flex items-center gap-1">
                      {isOpened ? <Eye className="w-3 h-3 text-indigo-400" /> : <EyeOff className="w-3 h-3" />}
                      <span>{isOpened ? 'Opened' : 'Delivered'}</span>
                    </span>
                  ) : (
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                      isOpened
                        ? 'bg-slate-950 text-slate-500 border border-slate-800'
                        : 'bg-amber-500 text-slate-950 font-black shadow'
                    }`}>
                      {isOpened ? 'Opened' : 'Tap to View'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Fullscreen Snap Viewer Overlay */}
      {activeSnapToView && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4">
          <div className="relative max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            {/* Top Timer Progress Bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-slate-800 z-10">
              <div
                className="h-full bg-amber-400 transition-all duration-1000 ease-linear"
                style={{ width: `${(timeLeft / 5) * 100}%` }}
              />
            </div>

            {/* Header info */}
            <div className="absolute top-4 inset-x-4 flex items-center justify-between text-white z-10 bg-slate-950/60 p-2 rounded-2xl backdrop-blur-md">
              <div className="flex items-center gap-2">
                <img
                  src={appStore.profiles.find(p => p.id === activeSnapToView.sender_id)?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover"
                />
                <span className="text-xs font-bold">
                  {appStore.profiles.find(p => p.id === activeSnapToView.sender_id)?.full_name}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-black font-mono bg-amber-500 text-slate-950 px-2 py-0.5 rounded-lg">
                  {timeLeft}s
                </span>
                <button onClick={handleCloseSnapView} className="p-1 hover:text-amber-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image display */}
            <div className="h-[480px] w-full bg-black relative flex items-center justify-center">
              <img
                src={activeSnapImageUrl || activeSnapToView.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80'}
                alt="Snap"
                className="w-full h-full object-cover"
              />

              {/* Caption Overlay */}
              {activeSnapToView.caption && (
                <div className="absolute bottom-6 inset-x-4 bg-slate-950/80 backdrop-blur-md border border-slate-800 p-3 rounded-2xl text-center text-xs font-semibold text-white shadow-2xl">
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
