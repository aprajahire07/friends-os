import React, { useState, useMemo } from 'react';
import { X, Wallet, Users, Check, AlertCircle } from 'lucide-react';
import { appStore } from '../../lib/store';
import { useToast } from '../ui/Toast';

interface AddGroupExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddGroupExpenseModal: React.FC<AddGroupExpenseModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [category, setCategory] = useState('Food');
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    appStore.profiles.map(p => p.id) // Default all members selected
  );
  const [customShares, setCustomShares] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const categories = ['Food', 'Party', 'Cab / Travel', 'Movie', 'Hostel', 'Rent', 'Other'];
  const numTotal = Number(totalAmount) || 0;

  const toggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      if (selectedUserIds.length === 1) return; // Must have at least 1
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

  const perPersonShare = numTotal > 0 && selectedUserIds.length > 0
    ? Number((numTotal / selectedUserIds.length).toFixed(2))
    : 0;

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
      await appStore.addGroupExpense(
        title.trim(),
        numTotal,
        category,
        selectedUserIds,
        splitMode === 'custom' ? customShares : undefined
      );

      showToast('Split Created!', `₹${numTotal} split successfully across members.`, 'success');
      onClose();
    } catch (err: any) {
      showToast('Error', err?.message || 'Unable to create split. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-950/80 border border-amber-800/60 rounded-2xl text-amber-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Add Group Expense / Party</h3>
            <p className="text-xs text-slate-400">Split bills equally or set custom shares</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Title / Expense Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Pizza Party at Dominos"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Total Amount (₹)</label>
              <input
                type="number"
                required
                min={1}
                placeholder="800"
                value={totalAmount}
                onChange={e => setTotalAmount(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Split Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Split Type</label>
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
                Equal Split
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
                Custom Shares
              </button>
            </div>
          </div>

          {/* Participant Multi-Select */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span>Select Participants ({selectedUserIds.length})</span>
              {splitMode === 'equal' ? (
                <span className="text-amber-400 font-bold">₹{perPersonShare} / person</span>
              ) : (
                <span className={isMatch ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  ₹{currentSharesSum} / ₹{numTotal} {isMatch ? '✅' : `(Diff: ₹${difference})`}
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {appStore.profiles.map(p => {
                const isSelected = selectedUserIds.includes(p.id);

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500/80 text-amber-200'
                        : 'bg-slate-950/40 border-slate-900 text-slate-500 opacity-60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleUserSelection(p.id)}
                      className="flex items-center gap-2 truncate flex-1 text-left"
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                        isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-700'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <img src={p.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                      <span className="truncate text-white font-medium">{p.full_name.split(' ')[0]}</span>
                    </button>

                    {isSelected && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold">₹</span>
                        {splitMode === 'custom' ? (
                          <input
                            type="number"
                            min={0}
                            value={customShares[p.id] !== undefined ? customShares[p.id] : ''}
                            onChange={e => handleShareChange(p.id, e.target.value)}
                            placeholder="0"
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-amber-300 text-right focus:outline-none focus:border-amber-500"
                          />
                        ) : (
                          <span className="font-bold text-amber-400">{perPersonShare}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {splitMode === 'custom' && !isMatch && (
              <div className="mt-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>
                  Split amounts must equal the total amount. Currently {difference > 0 ? `short by ₹${difference}` : `exceeds by ₹${Math.abs(difference)}`}.
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || (splitMode === 'custom' && !isMatch)}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all"
          >
            {isSubmitting ? 'Saving Split...' : 'Create Expense & Calculate Shares'}
          </button>
        </form>
      </div>
    </div>
  );
};
