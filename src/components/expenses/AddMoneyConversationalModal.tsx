import React, { useState } from 'react';
import { X, Check, Utensils, Car, Bus, Film, Sparkles, User, ArrowRight, Calendar, DollarSign, FileText, Tag, Users } from 'lucide-react';
import { appStore } from '../../lib/store';
import { Profile } from '../../types';
import { useToast } from '../ui/Toast';

interface AddMoneyConversationalModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedFriend?: Profile | null;
}

export const AddMoneyConversationalModal: React.FC<AddMoneyConversationalModalProps> = ({
  isOpen,
  onClose,
  preselectedFriend,
}) => {
  const { showToast } = useToast();
  const currentUser = appStore.currentUser;
  const friends = appStore.profiles.filter(p => p.id !== currentUser?.id);

  // Flow Step: 'choose_type' | 'paid_for_friends' | 'gave_money' | 'received_money'
  const [step, setStep] = useState<'choose_type' | 'paid_for_friends' | 'gave_money' | 'received_money'>('choose_type');

  // Form State
  const [selectedFriendId, setSelectedFriendId] = useState<string>(
    preselectedFriend ? preselectedFriend.id : (friends[0]?.id || '')
  );
  const [selectedMultiFriendIds, setSelectedMultiFriendIds] = useState<string[]>(
    preselectedFriend ? [preselectedFriend.id] : (friends.length > 0 ? [friends[0].id] : [])
  );
  const [includeMyself, setIncludeMyself] = useState<boolean>(true);
  const [amountStr, setAmountStr] = useState<string>('');
  const [reasonStr, setReasonStr] = useState<string>('Auto');
  const [category, setCategory] = useState<string>('Auto');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const categories = [
    { label: 'Auto', icon: '🚕' },
    { label: 'Food', icon: '🍕' },
    { label: 'Cafe', icon: '☕' },
    { label: 'Bus', icon: '🚌' },
    { label: 'Metro', icon: '🚇' },
    { label: 'Movie', icon: '🎬' },
    { label: 'Cash', icon: '💵' },
    { label: 'Other', icon: '💸' },
  ];

  const handleSelectCategory = (cat: string) => {
    setCategory(cat);
    if (!reasonStr || reasonStr === 'Auto' || reasonStr === 'Food' || reasonStr === 'Cafe' || reasonStr === 'Bus' || reasonStr === 'Metro' || reasonStr === 'Movie' || reasonStr === 'Cash' || reasonStr === 'Other') {
      setReasonStr(cat);
    }
  };

  const handleToggleMultiFriend = (id: string) => {
    if (selectedMultiFriendIds.includes(id)) {
      setSelectedMultiFriendIds(selectedMultiFriendIds.filter(fId => fId !== id));
    } else {
      setSelectedMultiFriendIds([...selectedMultiFriendIds, id]);
    }
  };

  const handleSelectAllFriends = () => {
    if (selectedMultiFriendIds.length === friends.length) {
      // keep only the first
      setSelectedMultiFriendIds(friends.length > 0 ? [friends[0].id] : []);
    } else {
      setSelectedMultiFriendIds(friends.map(f => f.id));
    }
  };

  const resetState = () => {
    setStep('choose_type');
    setAmountStr('');
    setReasonStr('Auto');
    setCategory('Auto');
    setIncludeMyself(true);
    setSelectedFriendId(preselectedFriend ? preselectedFriend.id : (friends[0]?.id || ''));
    setSelectedMultiFriendIds(preselectedFriend ? [preselectedFriend.id] : (friends.length > 0 ? [friends[0].id] : []));
    setTransactionDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !currentUser) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      showToast('Invalid Amount', 'Please enter a valid amount greater than 0', 'error');
      return;
    }

    const finalReason = reasonStr.trim() || category || 'Personal expense';

    setIsSubmitting(true);
    try {
      if (step === 'paid_for_friends') {
        if (selectedMultiFriendIds.length === 0) {
          showToast('Select Friends', 'Please select at least one friend to split with', 'error');
          setIsSubmitting(false);
          return;
        }

        // Total participants: selected friends + (1 if myself is included)
        const totalParticipants = selectedMultiFriendIds.length + (includeMyself ? 1 : 0);
        const perPersonShare = Math.round((amount / totalParticipants) * 100) / 100;

        // Record loan for each selected friend (they owe current user their share)
        for (const friendId of selectedMultiFriendIds) {
          await appStore.addPersonalLoan(
            friendId,
            perPersonShare,
            finalReason,
            category as any,
            currentUser.id
          );
        }

        if (includeMyself) {
          showToast(
            'Money Recorded 💰',
            `Total ₹${amount} split among ${totalParticipants} people (₹${perPersonShare} each). Your share (₹${perPersonShare}) is paid by you, and ${selectedMultiFriendIds.length} friends owe you.`,
            'success'
          );
        } else {
          showToast(
            'Money Recorded 💰',
            `Total ₹${amount} split across ${selectedMultiFriendIds.length} friends (₹${perPersonShare} each).`,
            'success'
          );
        }
      } else if (step === 'gave_money') {
        // "I Gave Money": Current user gave money to friend => friend owes current user
        const targetFriendId = selectedFriendId;
        const friendObj = friends.find(f => f.id === targetFriendId);
        await appStore.addPersonalLoan(
          targetFriendId,
          amount,
          finalReason,
          category as any,
          currentUser.id
        );
        showToast(
          'Money Recorded 💰',
          `Recorded: You gave ₹${amount} to ${friendObj?.full_name.split(' ')[0] || 'friend'}.`,
          'success'
        );
      } else if (step === 'received_money') {
        // "A Friend Paid for Me": Friend paid for current user => current user owes friend
        const targetFriendId = selectedFriendId;
        const friendObj = friends.find(f => f.id === targetFriendId);
        await appStore.addPersonalLoan(
          currentUser.id,
          amount,
          finalReason,
          category as any,
          targetFriendId
        );
        showToast(
          'Money Recorded 💰',
          `Recorded: ${friendObj?.full_name.split(' ')[0] || 'Friend'} paid ₹${amount} for you.`,
          'info'
        );
      }

      onClose();
      resetState();
    } catch (err: any) {
      showToast('Error', err?.message || 'Could not record money transaction', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'choose_type' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>💰</span>
                <span>Record Money</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">Select the type of transaction:</p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                id="btn-paid-for-friends"
                onClick={() => setStep('paid_for_friends')}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                    <span>🍕</span>
                    <span>I Paid for Friends</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    You paid a bill, auto, coffee, or treat for one or more friends.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0" />
              </button>

              <button
                type="button"
                id="btn-gave-money"
                onClick={() => setStep('gave_money')}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-bold text-sm text-white group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <span>💸</span>
                    <span>I Gave Money</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    "I transferred or gave cash to a friend" (They owe you).
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 shrink-0" />
              </button>

              <button
                type="button"
                id="btn-friend-paid-for-me"
                onClick={() => setStep('received_money')}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-pink-500/50 text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-bold text-sm text-white group-hover:text-pink-400 transition-colors flex items-center gap-2">
                    <span>🤲</span>
                    <span>A Friend Paid for Me</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    "A friend paid for my coffee / auto" (You owe them).
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-pink-400 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {step !== 'choose_type' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>
                  {step === 'paid_for_friends' && '🍕 I Paid for Friends'}
                  {step === 'gave_money' && '💸 I Gave Money'}
                  {step === 'received_money' && '🤲 A Friend Paid for Me'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setStep('choose_type')}
                className="text-xs font-bold text-indigo-400 hover:underline"
              >
                Change
              </button>
            </div>

            {/* Friend Selector */}
            {step === 'paid_for_friends' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Select Friends ({selectedMultiFriendIds.length} selected)</span>
                  </label>
                  {friends.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSelectAllFriends}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
                    >
                      {selectedMultiFriendIds.length === friends.length ? 'Clear (keep 1)' : 'Select All'}
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {/* Current User Option */}
                  {currentUser && (
                    <button
                      type="button"
                      id="btn-toggle-include-myself"
                      onClick={() => setIncludeMyself(!includeMyself)}
                      className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        includeMyself
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-white font-bold'
                          : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={currentUser.avatar_url}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover border border-emerald-500/40"
                        />
                        <div className="text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="block text-xs font-bold text-white">You ({currentUser.full_name.split(' ')[0]})</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                              Your share is Paid
                            </span>
                          </div>
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {includeMyself ? 'Included in split' : 'Not included (you paid full for friends)'}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          includeMyself ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {includeMyself && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  )}

                  {/* Friends List */}
                  {friends.map(f => {
                    const isChecked = selectedMultiFriendIds.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleToggleMultiFriend(f.id)}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          isChecked
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-white font-bold'
                            : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <img src={f.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-700" />
                          <div className="text-left">
                            <span className="block text-xs font-bold text-white">{f.full_name}</span>
                            <span className="block text-[10px] text-slate-400 font-normal">@{f.username}</span>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            isChecked ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700 bg-slate-900'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {amountStr && parseFloat(amountStr) > 0 && selectedMultiFriendIds.length > 0 && (() => {
                  const totalCount = selectedMultiFriendIds.length + (includeMyself ? 1 : 0);
                  const perPerson = Math.round((parseFloat(amountStr) / totalCount) * 100) / 100;
                  const totalReceivable = Math.round((perPerson * selectedMultiFriendIds.length) * 100) / 100;

                  return (
                    <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-emerald-300">
                        <span>
                          Split across <strong className="text-white">{totalCount} people</strong> {includeMyself ? '(You + friends)' : '(Friends only)'}:
                        </span>
                        <strong className="text-emerald-400 font-black text-sm">
                          ₹{perPerson.toFixed(2)} / person
                        </strong>
                      </div>

                      <div className="pt-1 border-t border-emerald-900/40 flex items-center justify-between text-[11px] text-slate-300">
                        {includeMyself ? (
                          <>
                            <span className="text-emerald-400 font-semibold">
                              ✅ Your share (₹{perPerson.toFixed(2)}): Paid
                            </span>
                            <span className="text-amber-300 font-semibold">
                              🔴 Friends owe you: ₹{totalReceivable.toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <span className="text-amber-300 font-semibold">
                            🔴 Friends owe you: ₹{parseFloat(amountStr).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{step === 'gave_money' ? 'Friend You Gave Money To' : 'Friend Who Paid For You'}</span>
                </label>
                <select
                  value={selectedFriendId}
                  onChange={e => setSelectedFriendId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {friends.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.full_name} (@{f.username})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Amount Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Amount (₹)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-lg font-bold text-emerald-400">₹</span>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="500"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-base font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Category Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>Category</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => handleSelectCategory(cat.label)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      category === cat.label
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reason / Note */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Reason / Note</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Auto / Canteen / Coffee / Movie"
                value={reasonStr}
                onChange={e => setReasonStr(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Date</span>
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={e => setTransactionDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>{isSubmitting ? 'Saving Transaction...' : 'Save Transaction'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
