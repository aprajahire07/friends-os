import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  GraduationCap, 
  MapPin, 
  Wallet, 
  Backpack, 
  QrCode, 
  Send, 
  MessageSquare, 
  Copy, 
  Check, 
  Trash2,
  ExternalLink,
  Sparkles,
  Camera,
  Share2
} from 'lucide-react';
import { Profile } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import { FileUpload } from '../ui/FileUpload';
import { getResolvedMediaUrl, getSyncMediaUrl } from '../../services/storage';
import { fetchProfileById } from '../../services/profiles';
import { Avatar } from '../ui/Avatar';

interface FriendProfileModalProps {
  friend: Profile | null;
  onClose: () => void;
  onOpenPaymentQR?: (friend: Profile) => void;
  onSendSnapTo?: (friend: Profile) => void;
  onSelectTab?: (tab: string) => void;
  onOpenChatWithFriend?: (friend: Profile) => void;
  onOpenAddMoneyForFriend?: (friend: Profile) => void;
  onOpenBorrowForFriend?: (friend: Profile) => void;
}

export const FriendProfileModal: React.FC<FriendProfileModalProps> = ({
  friend,
  onClose,
  onOpenPaymentQR,
  onSendSnapTo,
  onSelectTab,
  onOpenChatWithFriend,
  onOpenAddMoneyForFriend,
  onOpenBorrowForFriend,
}) => {
  const { showToast } = useToast();
  useAppStore();

  const [liveProfile, setLiveProfile] = useState<Profile | null>(friend);
  const [displayQrUrl, setDisplayQrUrl] = useState<string>('');
  const [copiedUPI, setCopiedUPI] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'qr'>('info');

  // Self QR edit states
  const [isEditingQR, setIsEditingQR] = useState(false);
  const [newQrPath, setNewQrPath] = useState('');
  const [newUpiId, setNewUpiId] = useState('');

  const currentUser = appStore.currentUser;
  const isSelf = friend?.id === currentUser?.id;

  // Reactively fetch fresh profile data on friend change
  useEffect(() => {
    if (!friend) {
      setLiveProfile(null);
      return;
    }

    // 1. Check current store profiles
    const storeMatched = appStore.profiles.find(p => p.id === friend.id) || 
                         (isSelf ? appStore.currentUser : friend);
    setLiveProfile(storeMatched);
    setNewQrPath(storeMatched.payment_qr_url || '');
    setNewUpiId(storeMatched.upi_id || '');

    // 2. Fetch fresh data from Supabase asynchronously
    let isMounted = true;
    fetchProfileById(friend.id).then(fresh => {
      if (fresh && isMounted) {
        setLiveProfile(fresh);
        setNewQrPath(fresh.payment_qr_url || '');
        setNewUpiId(fresh.upi_id || '');
      }
    }).catch(err => {
      console.warn('Profile fetch error:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [friend?.id, isSelf]);

  // Resolve QR URL whenever liveProfile changes
  useEffect(() => {
    let isMounted = true;
    if (liveProfile?.payment_qr_url) {
      getResolvedMediaUrl('payment-qr', liveProfile.payment_qr_url).then(url => {
        if (isMounted) setDisplayQrUrl(url);
      }).catch(() => {
        if (isMounted) setDisplayQrUrl('');
      });
    } else {
      setDisplayQrUrl('');
    }
    return () => {
      isMounted = false;
    };
  }, [liveProfile?.payment_qr_url]);

  if (!friend || !liveProfile) return null;

  // Financial status specifically with this friend
  const loansWithFriend = appStore.loans.filter(
    l =>
      l.status === 'pending' &&
      ((l.lender_id === currentUser.id && l.borrower_id === liveProfile.id) ||
        (l.lender_id === liveProfile.id && l.borrower_id === currentUser.id))
  );

  let netBalanceWithFriend = 0;
  loansWithFriend.forEach(l => {
    if (l.lender_id === currentUser.id) netBalanceWithFriend += l.amount;
    else netBalanceWithFriend -= l.amount;
  });

  let moneyText = 'Settled up (₹0)';
  if (netBalanceWithFriend > 0) {
    moneyText = `${liveProfile.full_name.split(' ')[0]} owes you ₹${netBalanceWithFriend}`;
  } else if (netBalanceWithFriend < 0) {
    moneyText = `You owe ${liveProfile.full_name.split(' ')[0]} ₹${Math.abs(netBalanceWithFriend)}`;
  }

  // Borrowed items with this friend
  const borrowedWithFriend = appStore.borrowed.filter(
    b =>
      b.status === 'borrowed' &&
      ((b.owner_id === currentUser.id && b.borrower_id === liveProfile.id) ||
        (b.owner_id === liveProfile.id && b.borrower_id === currentUser.id))
  );

  let borrowedText = 'Nothing borrowed';
  if (borrowedWithFriend.length > 0) {
    const item = borrowedWithFriend[0];
    if (item.borrower_id === currentUser.id) {
      borrowedText = `You borrowed ${liveProfile.full_name.split(' ')[0]}'s ${item.item_name}`;
    } else {
      borrowedText = `${liveProfile.full_name.split(' ')[0]} borrowed your ${item.item_name}`;
    }
  }

  const handleCopyUPI = () => {
    if (liveProfile.upi_id) {
      navigator.clipboard.writeText(liveProfile.upi_id);
      setCopiedUPI(true);
      showToast('Copied UPI ID', liveProfile.upi_id, 'info');
      setTimeout(() => setCopiedUPI(false), 2000);
    }
  };

  const handleSaveSelfQR = (e: React.FormEvent) => {
    e.preventDefault();
    appStore.updatePaymentQr(newQrPath, newUpiId.trim());
    showToast('Saved Payment QR', 'Your friends can now view your updated QR code to pay.', 'success');
    setIsEditingQR(false);
  };

  const handleRemoveSelfQR = () => {
    setNewQrPath('');
    setDisplayQrUrl('');
    appStore.updatePaymentQr('', newUpiId.trim());
    showToast('Removed QR Code', 'Your payment QR code was deleted.', 'info');
    setIsEditingQR(false);
  };

  const resolvedAvatarUrl = liveProfile.avatar_url 
    ? getSyncMediaUrl('avatars', liveProfile.avatar_url)
    : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 text-slate-100 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Profile Summary */}
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <Avatar
            profile={liveProfile}
            src={liveProfile.avatar_url}
            name={liveProfile.full_name}
            username={liveProfile.username}
            size="xl"
            showStatus={true}
            statusEmoji={liveProfile.status_emoji || '🟢'}
            className="border-2 border-indigo-500/50 shadow-lg"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black text-white truncate">
                {liveProfile.full_name}
              </h3>
              {isSelf && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800">
                  YOU
                </span>
              )}
            </div>
            
            <p className="text-xs text-indigo-400 font-mono">@{liveProfile.username}</p>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-emerald-400 text-[11px] font-bold">
                <span>{liveProfile.status_preset || '🟢 Available'}</span>
              </span>
              {liveProfile.status_text && liveProfile.status_text !== liveProfile.status_preset && (
                <span className="text-[11px] text-slate-300 italic truncate max-w-[150px]">
                  "{liveProfile.status_text}"
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Profile Tabs: Info vs Payment QR */}
        <div className="flex border-b border-slate-800 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all ${
              activeTab === 'info'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Profile Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'qr'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Payment & UPI QR</span>
            {liveProfile.payment_qr_url && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {activeTab === 'info' ? (
            <div className="space-y-3 text-xs">
              {/* College & Branch */}
              <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">College & Branch</p>
                  <p className="font-bold text-white">
                    {liveProfile.college} • Sem {liveProfile.semester}
                  </p>
                  {liveProfile.course_branch && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{liveProfile.course_branch}</p>
                  )}
                </div>
              </div>

              {/* Campus Location */}
              {liveProfile.current_location && (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold">Campus Location</p>
                    <p className="font-bold text-white">{liveProfile.current_location}</p>
                  </div>
                </div>
              )}

              {/* Financial Balance with Friend */}
              {!isSelf && (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-400 text-[10px] uppercase font-bold">Money Status</p>
                    <p className={`font-bold ${netBalanceWithFriend < 0 ? 'text-rose-400' : netBalanceWithFriend > 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {moneyText}
                    </p>
                  </div>
                  {onOpenAddMoneyForFriend && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenAddMoneyForFriend(liveProfile);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                    >
                      Pay / Split
                    </button>
                  )}
                </div>
              )}

              {/* Borrowed items with Friend */}
              {!isSelf && (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center shrink-0">
                    <Backpack className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-400 text-[10px] uppercase font-bold">Borrowed Items</p>
                    <p className="font-bold text-white">{borrowedText}</p>
                  </div>
                </div>
              )}

              {/* Birthday */}
              {liveProfile.birthday && (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold">Birthday</p>
                    <p className="font-bold text-white">{liveProfile.birthday}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* PAYMENT & UPI QR TAB */
            <div className="space-y-4 text-center">
              {/* QR Image Box */}
              <div className="p-4 bg-white rounded-2xl inline-block shadow-xl border-4 border-slate-800 max-w-[220px]">
                {displayQrUrl ? (
                  <img
                    src={displayQrUrl}
                    alt="Payment QR"
                    className="w-44 h-44 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-44 h-44 flex flex-col items-center justify-center text-slate-700 bg-slate-100 rounded-xl p-3">
                    <QrCode className="w-12 h-12 opacity-30 mb-2" />
                    <p className="text-[11px] font-semibold text-center text-slate-600">
                      {isSelf ? 'No QR uploaded yet. Upload yours below!' : 'No payment QR uploaded yet'}
                    </p>
                  </div>
                )}
              </div>

              {/* UPI ID Copy Bar */}
              {liveProfile.upi_id && (
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-mono text-emerald-400 font-bold truncate pr-2">
                    {liveProfile.upi_id}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUPI}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 font-semibold shrink-0 transition-colors"
                  >
                    {copiedUPI ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUPI ? 'Copied' : 'Copy UPI'}</span>
                  </button>
                </div>
              )}

              {/* Self Edit QR Option */}
              {isSelf && (
                <div className="pt-2 text-left">
                  {!isEditingQR ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingQR(true)}
                      className="w-full py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-colors"
                    >
                      {liveProfile.payment_qr_url ? 'Replace / Edit Payment QR' : '+ Upload Your Payment QR'}
                    </button>
                  ) : (
                    <form onSubmit={handleSaveSelfQR} className="space-y-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Upload New QR Code</span>
                        <button
                          type="button"
                          onClick={() => setIsEditingQR(false)}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                          UPI ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. username@okhdfcbank"
                          value={newUpiId}
                          onChange={e => setNewUpiId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">
                          QR Image
                        </label>
                        <FileUpload
                          bucket="payment-qr"
                          userId={currentUser.id}
                          allowedTypes={['image']}
                          initialStoragePath={newQrPath}
                          label="Choose QR Photo"
                          helperText="Google Pay / PhonePe / Paytm QR"
                          onUploadComplete={(paths) => {
                            if (paths.length > 0) {
                              setNewQrPath(paths[0]);
                              getResolvedMediaUrl('payment-qr', paths[0]).then(url => setDisplayQrUrl(url));
                            }
                          }}
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="submit"
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
                        >
                          Save QR Details
                        </button>

                        {liveProfile.payment_qr_url && (
                          <button
                            type="button"
                            onClick={handleRemoveSelfQR}
                            className="p-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded-xl transition-colors"
                            title="Delete current QR"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 1-on-1 Action Buttons */}
        {!isSelf && (
          <div className="pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => {
                onClose();
                if (onOpenChatWithFriend && liveProfile) {
                  onOpenChatWithFriend(liveProfile);
                } else if (onSelectTab) {
                  onSelectTab('chat');
                }
              }}
              className="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Chat</span>
            </button>

            <button
              onClick={() => {
                onClose();
                if (onSendSnapTo) onSendSnapTo(liveProfile);
              }}
              className="py-2 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors shadow"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Snap</span>
            </button>

            <button
              onClick={() => {
                onClose();
                if (onOpenAddMoneyForFriend) onOpenAddMoneyForFriend(liveProfile);
                else if (onSelectTab) onSelectTab('expenses');
              }}
              className="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Money</span>
            </button>

            <button
              onClick={() => {
                onClose();
                if (onOpenBorrowForFriend) onOpenBorrowForFriend(liveProfile);
                else if (onSelectTab) onSelectTab('borrowed');
              }}
              className="py-2 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
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
