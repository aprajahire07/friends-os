import React from 'react';
import { X, Calendar, GraduationCap, MapPin, Wallet, Backpack, QrCode, Send, MessageSquare, Plus } from 'lucide-react';
import { Profile } from '../../types';
import { appStore } from '../../lib/store';

interface FriendProfileModalProps {
  friend: Profile | null;
  onClose: () => void;
  onOpenPaymentQR: (friend: Profile) => void;
  onSendSnapTo: (friend: Profile) => void;
  onSelectTab: (tab: string) => void;
  onOpenAddMoneyForFriend?: (friend: Profile) => void;
  onOpenBorrowForFriend?: (friend: Profile) => void;
}

export const FriendProfileModal: React.FC<FriendProfileModalProps> = ({
  friend,
  onClose,
  onOpenPaymentQR,
  onSendSnapTo,
  onSelectTab,
  onOpenAddMoneyForFriend,
  onOpenBorrowForFriend,
}) => {
  if (!friend) return null;

  const currentUser = appStore.currentUser;
  const isSelf = friend.id === currentUser.id;

  // Financial status specifically with this friend
  const loansWithFriend = appStore.loans.filter(
    l =>
      l.status === 'pending' &&
      ((l.lender_id === currentUser.id && l.borrower_id === friend.id) ||
        (l.lender_id === friend.id && l.borrower_id === currentUser.id))
  );

  let netBalanceWithFriend = 0;
  loansWithFriend.forEach(l => {
    if (l.lender_id === currentUser.id) netBalanceWithFriend += l.amount;
    else netBalanceWithFriend -= l.amount;
  });

  let moneyText = 'Settled up (₹0)';
  if (netBalanceWithFriend > 0) {
    moneyText = `${friend.full_name.split(' ')[0]} owes you ₹${netBalanceWithFriend}`;
  } else if (netBalanceWithFriend < 0) {
    moneyText = `You owe ${friend.full_name.split(' ')[0]} ₹${Math.abs(netBalanceWithFriend)}`;
  }

  // Borrowed items with this friend
  const borrowedWithFriend = appStore.borrowed.filter(
    b =>
      b.status === 'borrowed' &&
      ((b.owner_id === currentUser.id && b.borrower_id === friend.id) ||
        (b.owner_id === friend.id && b.borrower_id === currentUser.id))
  );

  let borrowedText = 'Nothing borrowed';
  if (borrowedWithFriend.length > 0) {
    const item = borrowedWithFriend[0];
    if (item.borrower_id === currentUser.id) {
      borrowedText = `You borrowed ${friend.full_name.split(' ')[0]}'s ${item.item_name}`;
    } else {
      borrowedText = `${friend.full_name.split(' ')[0]} borrowed your ${item.item_name}`;
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-slate-100 shadow-2xl relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Avatar & Header */}
        <div className="flex flex-col items-center text-center pb-4 border-b border-slate-800">
          <div className="relative mb-3">
            <img
              src={friend.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80'}
              alt={friend.full_name}
              className="w-20 h-20 rounded-full object-cover border-4 border-indigo-500/40 shadow-xl"
            />
            <span className="absolute bottom-0 right-0 text-lg bg-slate-950 p-1 rounded-full shadow">
              {friend.status_emoji || '🟢'}
            </span>
          </div>

          <h3 className="text-xl font-bold text-white">{friend.full_name}</h3>
          <p className="text-xs text-indigo-400 font-mono mt-0.5">@{friend.username}</p>

          <div className="flex flex-col items-center gap-1.5 mt-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-emerald-400 text-xs font-bold shadow">
              <span>{friend.status_preset || '🟢 Available'}</span>
            </span>
            {friend.status_text && friend.status_text !== friend.status_preset && (
              <p className="text-xs text-slate-300 italic bg-slate-950/60 px-3 py-1 rounded-xl border border-slate-800/80">
                "{friend.status_text}"
              </p>
            )}
          </div>
        </div>

        {/* Profile Sections */}
        <div className="py-4 space-y-3.5 text-xs border-b border-slate-800">
          {/* College */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">College</p>
              <p className="font-bold text-white">{friend.college} (Sem {friend.semester})</p>
            </div>
          </div>

          {/* Location */}
          {friend.current_location && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Campus Location</p>
                <p className="font-bold text-white">{friend.current_location}</p>
              </div>
            </div>
          )}

          {/* Money */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">Money</p>
              <p className={`font-bold ${netBalanceWithFriend < 0 ? 'text-rose-400' : netBalanceWithFriend > 0 ? 'text-emerald-400' : 'text-white'}`}>
                "{moneyText}"
              </p>
            </div>
          </div>

          {/* Borrowed */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center shrink-0">
              <Backpack className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">Borrowed</p>
              <p className="font-bold text-white">"{borrowedText}"</p>
            </div>
          </div>

          {/* Birthday */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">Birthday</p>
              <p className="font-bold text-white">{friend.birthday || '22 August'}</p>
            </div>
          </div>
        </div>

        {/* Simple Actions */}
        {!isSelf && (
          <div className="pt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onClose();
                onSelectTab('chat');
              }}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Message</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onSendSnapTo(friend);
              }}
              className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors shadow"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Snap</span>
            </button>

            <button
              onClick={() => {
                onClose();
                if (onOpenAddMoneyForFriend) onOpenAddMoneyForFriend(friend);
                else onSelectTab('expenses');
              }}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Add Money</span>
            </button>

            <button
              onClick={() => {
                onClose();
                if (onOpenBorrowForFriend) onOpenBorrowForFriend(friend);
                else onSelectTab('borrowed');
              }}
              className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Backpack className="w-3.5 h-3.5" />
              <span>Borrow</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
