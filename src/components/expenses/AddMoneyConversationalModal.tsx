import React, { useState } from 'react';
import { X, Check, Utensils, Car, Bus, Film, Sparkles, User, ArrowRight } from 'lucide-react';
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
  const friends = appStore.profiles.filter(p => p.id !== currentUser.id);

  // Flow Step: 'choose_type' | 'group_paid' | 'gave_money' | 'received_money'
  const [step, setStep] = useState<'choose_type' | 'group_paid' | 'gave_money' | 'received_money'>('choose_type');

  // "I paid for friends" state
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>(
    preselectedFriend ? [preselectedFriend.id] : friends.map(f => f.id)
  );
  const [category, setCategory] = useState<string>('🍕 Food');
  const [amountStr, setAmountStr] = useState<string>('');

  // "I gave someone money" state
  const [singleFriendId, setSingleFriendId] = useState<string>(
    preselectedFriend ? preselectedFriend.id : (friends[0]?.id || '')
  );
  const [reasonStr, setReasonStr] = useState<string>('Auto');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const categories = [
    { label: '🍕 Food', icon: '🍕' },
    { label: '🚕 Auto', icon: '🚕' },
    { label: '🚌 Bus', icon: '🚌' },
    { label: '🚇 Metro', icon: '🚇' },
    { label: '🎬 Movie', icon: '🎬' },
    { label: '☕ Cafe', icon: '☕' },
    { label: 'Other', icon: '💸' },
  ];

  const handleToggleFriend = (id: string) => {
    if (selectedFriendIds.includes(id)) {
      if (selectedFriendIds.length === 1) return; // Keep at least one
      setSelectedFriendIds(selectedFriendIds.filter(fId => fId !== id));
    } else {
      setSelectedFriendIds([...selectedFriendIds, id]);
    }
  };

  const handleSubmitGroupPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const total = parseFloat(amountStr);
    if (isNaN(total) || total <= 0) {
      showToast('Invalid Amount', 'Please enter a valid amount', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const allParticipantIds = Array.from(new Set([currentUser.id, ...selectedFriendIds]));

      await appStore.addGroupExpense(
        `${category} Treat / Bill`,
        total,
        category.split(' ')[1] || category,
        allParticipantIds
      );

      const friendNames = selectedFriendIds
        .map(id => appStore.profiles.find(p => p.id === id)?.full_name.split(' ')[0])
        .filter(Boolean)
        .join(', ');

      const share = Math.round((total / allParticipantIds.length) * 100) / 100;

      showToast(
        'Money Added 💰',
        `Split ₹${total} among ${allParticipantIds.length} people (₹${share} each for ${friendNames})`,
        'success'
      );

      onClose();
      resetState();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitGaveMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0 || !singleFriendId) {
      showToast('Invalid Details', 'Please select a friend and amount', 'error');
      return;
    }

    const friendObj = appStore.profiles.find(p => p.id === singleFriendId);

    setIsSubmitting(true);
    try {
      if (step === 'gave_money') {
        // You gave friend money => Friend owes you (Lender: currentUser, Borrower: singleFriendId)
        await appStore.addPersonalLoan(
          singleFriendId,
          amount,
          reasonStr,
          'Cash',
          currentUser.id
        );
        showToast('Added 💰', `${friendObj?.full_name.split(' ')[0]} now owes you ₹${amount}`, 'success');
      } else {
        // Someone gave you money => You owe friend (Lender: singleFriendId, Borrower: currentUser)
        await appStore.addPersonalLoan(
          currentUser.id,
          amount,
          reasonStr,
          'Cash',
          singleFriendId
        );
        showToast('Added 💰', `You now owe ${friendObj?.full_name.split(' ')[0]} ₹${amount}`, 'info');
      }

      onClose();
      resetState();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetState = () => {
    setStep('choose_type');
    setAmountStr('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'choose_type' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">What happened? 💰</h3>
            <p className="text-xs text-slate-400">Select how you want to log money:</p>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => setStep('group_paid')}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                    🍕 I paid for friends (Food/Auto/Movie)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Split a group bill easily between selected friends.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0" />
              </button>

              <button
                onClick={() => setStep('gave_money')}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-bold text-sm text-white group-hover:text-indigo-400 transition-colors">
                    💸 I gave money to a friend
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    "I paid Rahul ₹50 for Auto" (He owes you).
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 shrink-0" />
              </button>

              <button
                onClick={() => setStep('received_money')}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-pink-500/50 text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-bold text-sm text-white group-hover:text-pink-400 transition-colors">
                    🤲 A friend paid for me
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    "Aman paid ₹100 for my Coffee" (You owe him).
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-pink-400 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {step === 'group_paid' && (
          <form onSubmit={handleSubmitGroupPaid} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">I paid for friends 🍕</h3>
              <button
                type="button"
                onClick={() => setStep('choose_type')}
                className="text-xs font-bold text-indigo-400 hover:underline"
              >
                Change
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                Total Amount Paid (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-lg font-bold text-emerald-400">₹</span>
                <input
                  type="number"
                  required
                  placeholder="300"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-base font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                What was it for?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      category === cat.label
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                Split with who?
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {friends.map(f => {
                  const isChecked = selectedFriendIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleToggleFriend(f.id)}
                      className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        isChecked
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-white font-bold'
                          : 'bg-slate-950 border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img src={f.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                        <span>{f.full_name}</span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                          isChecked ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>{isSubmitting ? 'Saving Expense...' : 'Save & Split Expense'}</span>
            </button>
          </form>
        )}

        {(step === 'gave_money' || step === 'received_money') && (
          <form onSubmit={handleSubmitGaveMoney} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">
                {step === 'gave_money' ? 'I gave money 💸' : 'A friend paid for me 🤲'}
              </h3>
              <button
                type="button"
                onClick={() => setStep('choose_type')}
                className="text-xs font-bold text-indigo-400 hover:underline"
              >
                Change
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                Select Friend
              </label>
              <select
                value={singleFriendId}
                onChange={e => setSingleFriendId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {friends.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.full_name} (@{f.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-lg font-bold text-indigo-400">₹</span>
                <input
                  type="number"
                  required
                  placeholder="50"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-base font-bold text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                Reason / Note
              </label>
              <input
                type="text"
                placeholder="e.g. Auto fare / Canteen Coffee"
                value={reasonStr}
                onChange={e => setReasonStr(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>{isSubmitting ? 'Saving Record...' : 'Save Record'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
