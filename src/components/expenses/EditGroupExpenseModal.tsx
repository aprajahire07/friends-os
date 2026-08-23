import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Trash2, Check, AlertCircle, Users, DollarSign } from 'lucide-react';
import { GroupExpense, ExpenseParticipant, Profile } from '../../types';
import { appStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import { Avatar } from '../ui/Avatar';

interface EditGroupExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: GroupExpense | null;
}

export const EditGroupExpenseModal: React.FC<EditGroupExpenseModalProps> = ({
  isOpen,
  onClose,
  expense,
}) => {
  const { showToast } = useToast();
  const allProfiles = appStore.profiles;

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Food');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [customShares, setCustomShares] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = ['Food', 'Party', 'Cab / Travel', 'Movie', 'Hostel', 'Rent', 'Other'];

  useEffect(() => {
    if (expense) {
      setTitle(expense.title || '');
      setCategory(expense.category || 'Food');
      setTotalAmount(expense.total_amount || 0);

      const userIds = expense.participants.map(p => p.user_id);
      setSelectedUserIds(userIds);

      const sharesMap: Record<string, number> = {};
      let isCustom = false;
      const expectedEqual = userIds.length > 0 ? Number((expense.total_amount / userIds.length).toFixed(2)) : 0;

      expense.participants.forEach(p => {
        sharesMap[p.user_id] = p.share_amount;
        if (Math.abs(p.share_amount - expectedEqual) > 0.05) {
          isCustom = true;
        }
      });

      setCustomShares(sharesMap);
      setSplitMode(isCustom ? 'custom' : 'equal');
    }
  }, [expense]);

  if (!isOpen || !expense) return null;

  const numTotal = Number(totalAmount) || 0;

  // Calculate shares based on mode
  const currentSharesSum = useMemo(() => {
    if (splitMode === 'equal') {
      return numTotal;
    }
    return Object.entries(customShares)
      .filter(([uid]) => selectedUserIds.includes(uid))
      .reduce((sum, [, val]) => sum + (Number(val) || 0), 0);
  }, [splitMode, customShares, selectedUserIds, numTotal]);

  const difference = Math.round((numTotal - currentSharesSum) * 100) / 100;
  const isMatch = Math.abs(difference) < 0.01;

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      if (selectedUserIds.length <= 1) {
        showToast('Minimum 1', 'Expense must have at least one participant', 'error');
        return;
      }
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
      if (!customShares[userId]) {
        setCustomShares(prev => ({ ...prev, [userId]: 0 }));
      }
    }
  };

  const handleShareChange = (userId: string, value: string) => {
    const val = parseFloat(value);
    setCustomShares(prev => ({
      ...prev,
      [userId]: isNaN(val) ? 0 : val
    }));
  };

  const handleDistributeEqually = () => {
    if (selectedUserIds.length === 0 || numTotal <= 0) return;
    const share = Number((numTotal / selectedUserIds.length).toFixed(2));
    const newShares: Record<string, number> = {};
    selectedUserIds.forEach(id => {
      newShares[id] = share;
    });
    setCustomShares(newShares);
    setSplitMode('equal');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!title.trim()) {
      showToast('Title Required', 'Please enter a title for the split', 'error');
      return;
    }

    if (numTotal <= 0) {
      showToast('Invalid Amount', 'Total amount must be greater than 0', 'error');
      return;
    }

    if (selectedUserIds.length === 0) {
      showToast('No Participants', 'Please select at least one participant', 'error');
      return;
    }

    if (splitMode === 'custom' && !isMatch) {
      showToast(
        'Split Mismatch',
        `Split amounts (₹${currentSharesSum}) must equal the total amount (₹${numTotal}). Difference: ₹${difference}`,
        'error'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const equalShare = Number((numTotal / selectedUserIds.length).toFixed(2));

      // Build updated participants array preserving previous settlement status if possible
      const updatedParticipants: ExpenseParticipant[] = selectedUserIds.map(uid => {
        const existingPart = expense.participants.find(p => p.user_id === uid);
        const shareAmount = splitMode === 'custom'
          ? (customShares[uid] !== undefined ? customShares[uid] : 0)
          : equalShare;

        return {
          user_id: uid,
          share_amount: shareAmount,
          status: existingPart?.status || (uid === expense.paid_by ? 'settled' : 'pending'),
          claimed_at: existingPart?.claimed_at,
          settled_at: existingPart?.settled_at,
        };
      });

      await appStore.updateGroupExpense(expense.id, {
        title: title.trim(),
        category,
        total_amount: numTotal,
        participants: updatedParticipants,
      });

      showToast('Split Updated ✅', 'Expense changes saved to database and shared with friends!', 'success');
      onClose();
    } catch (err) {
      showToast('Update Failed', 'Could not update expense split', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-amber-950/80 border border-amber-800/60 rounded-2xl text-amber-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Edit Split Expense ✏️</h3>
            <p className="text-xs text-slate-400">Update total, category, members, or individual shares</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Expense Title / Reason
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Dinner at CCD"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Total Amount (₹)
              </label>
              <input
                type="number"
                required
                min={1}
                value={totalAmount}
                onChange={e => setTotalAmount(e.target.value ? Number(e.target.value) : '')}
                placeholder="1000"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Split Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
              Split Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDistributeEqually}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  splitMode === 'equal'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Equal Split (₹{selectedUserIds.length > 0 ? Number((numTotal / selectedUserIds.length).toFixed(2)) : 0} each)
              </button>

              <button
                type="button"
                onClick={() => setSplitMode('custom')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  splitMode === 'custom'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Custom Individual Shares
              </button>
            </div>
          </div>

          {/* Participant Breakdown & Custom Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Participants ({selectedUserIds.length})</span>
              </span>
              {splitMode === 'custom' && (
                <span className={isMatch ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  Total: ₹{currentSharesSum} / ₹{numTotal} {isMatch ? '✅' : `(Diff: ₹${difference})`}
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {allProfiles.map(p => {
                const isSelected = selectedUserIds.includes(p.id);
                const shareVal = splitMode === 'custom'
                  ? (customShares[p.id] !== undefined ? customShares[p.id] : 0)
                  : (selectedUserIds.length > 0 ? Number((numTotal / selectedUserIds.length).toFixed(2)) : 0);

                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                      isSelected
                        ? 'bg-slate-950 border-slate-700 text-white'
                        : 'bg-slate-950/40 border-slate-900 text-slate-500 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleUser(p.id)}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                      <Avatar profile={p} size="xs" />
                      <span className="font-semibold text-white">
                        {p.full_name} {p.id === expense.paid_by && '(Payer)'}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold">₹</span>
                        {splitMode === 'custom' ? (
                          <input
                            type="number"
                            min={0}
                            value={customShares[p.id] !== undefined ? customShares[p.id] : ''}
                            onChange={e => handleShareChange(p.id, e.target.value)}
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-amber-300 text-right focus:outline-none focus:border-amber-500"
                          />
                        ) : (
                          <span className="font-bold text-amber-400 px-2 py-1 bg-slate-900 rounded-lg border border-slate-800">
                            {shareVal}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {splitMode === 'custom' && !isMatch && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>
                  Split amounts must equal the total amount. Currently {difference > 0 ? `short by ₹${difference}` : `exceeds by ₹${Math.abs(difference)}`}.
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || (splitMode === 'custom' && !isMatch)}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow flex items-center gap-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
