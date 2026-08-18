import React, { useState, useEffect } from 'react';
import { Search, MapPin, Send, MessageSquare, GraduationCap, Cake, Users, Plus } from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { Profile } from '../../types';
import { StatusPicker } from './StatusPicker';
import { FriendProfileModal } from './FriendProfileModal';
import { useToast } from '../ui/Toast';
import { Avatar } from '../ui/Avatar';

interface FriendsListProps {
  onOpenPaymentQR: (friend: Profile) => void;
  onSendSnapTo: (friend: Profile) => void;
  onSelectTab: (tab: string) => void;
  onOpenAddMoneyForFriend?: (friend: Profile) => void;
  onOpenBorrowForFriend?: (friend: Profile) => void;
}

export const FriendsList: React.FC<FriendsListProps> = ({
  onOpenPaymentQR,
  onSendSnapTo,
  onSelectTab,
  onOpenAddMoneyForFriend,
  onOpenBorrowForFriend,
}) => {
  const { showToast } = useToast();
  useAppStore();
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationInput, setLocationInput] = useState(
    appStore.currentUser.current_location || 'GH Raisoni — Block A, Room A-203'
  );

  useEffect(() => {
    setLocationInput(appStore.currentUser.current_location || 'GH Raisoni — Block A, Room A-203');
  }, [appStore.currentUser.id, appStore.currentUser.current_location]);

  const friends = appStore.profiles;
  const filtered = friends.filter(
    f =>
      f.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.college.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    appStore.updateCurrentLocation(locationInput);
    showToast('Location Updated 📍', `Set status location to "${locationInput}"`, 'success');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 md:pb-12">
      {/* Header & Live Status Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Friends 👥</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Realtime statuses, live campus locations & payment QR codes.
          </p>
        </div>

        {/* Live Status Control */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 font-medium">Your status:</span>
          <StatusPicker />
        </div>
      </div>

      {/* Compact Campus Location Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 text-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-slate-400 text-[11px]">Campus Location:</span>
          <span className="text-white truncate max-w-[200px]">
            {appStore.currentUser.current_location || 'Not set'}
          </span>
        </div>

        <form onSubmit={handleUpdateLocation} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="e.g. Canteen, Library 2nd Fl..."
            value={locationInput}
            onChange={e => setLocationInput(e.target.value)}
            className="flex-1 sm:w-56 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors shadow active:scale-95 shrink-0"
          >
            Save
          </button>
        </form>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Search friends..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Friends Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map(f => {
          const isSelf = f.id === appStore.currentUser.id;

          return (
            <div
              key={f.id}
              onClick={() => setSelectedFriend(f)}
              className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 text-slate-100 shadow-lg flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5 truncate">
                <Avatar
                  profile={f}
                  src={f.avatar_url}
                  name={f.full_name}
                  username={f.username}
                  size="lg"
                  showStatus={true}
                  statusEmoji={f.status_emoji || '🟢'}
                  className="border-2 border-indigo-500/40 shadow"
                />

                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white truncate">{f.full_name}</h3>
                    {isSelf && (
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                        YOU
                      </span>
                    )}
                  </div>
                  
                  {/* Status & Custom Text */}
                  <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5 truncate">
                    <span className="text-emerald-400 font-semibold">{f.status_preset || '🟢 Available'}</span>
                    {f.status_text && f.status_text !== f.status_preset && (
                      <span className="text-slate-300 italic truncate max-w-[130px]">
                        "{f.status_text}"
                      </span>
                    )}
                    {f.current_location && (
                      <span className="text-slate-400 truncate max-w-[140px]">
                        • 📍 {f.current_location.split('—')[0]}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isSelf && (
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onSelectTab('chat')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                    title="Message"
                  >
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                  </button>

                  <button
                    onClick={() => onSendSnapTo(f)}
                    className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors"
                    title="Send Snap"
                  >
                    <Send className="w-4 h-4 text-amber-400" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Friend Detail Modal */}
      <FriendProfileModal
        friend={selectedFriend ? (friends.find(p => p.id === selectedFriend.id) || selectedFriend) : null}
        onClose={() => setSelectedFriend(null)}
        onOpenPaymentQR={onOpenPaymentQR}
        onSendSnapTo={onSendSnapTo}
        onSelectTab={onSelectTab}
        onOpenAddMoneyForFriend={onOpenAddMoneyForFriend}
        onOpenBorrowForFriend={onOpenBorrowForFriend}
      />
    </div>
  );
};

