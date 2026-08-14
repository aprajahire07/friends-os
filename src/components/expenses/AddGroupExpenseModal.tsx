import React, { useState } from 'react';
import { X, Wallet, Users, Check } from 'lucide-react';
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
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    appStore.profiles.map(p => p.id) // Default all members selected
  );

  if (!isOpen) return null;

  const categories = ['Food', 'Party', 'Cab / Travel', 'Movie', 'Hostel', 'Rent', 'Other'];

  const toggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      if (selectedUserIds.length === 1) return; // Must have at least 1
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const perPersonShare = totalAmount && selectedUserIds.length > 0
    ? Number((Number(totalAmount) / selectedUserIds.length).toFixed(2))
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !totalAmount || Number(totalAmount) <= 0) return;

    appStore.addGroupExpense(title, Number(totalAmount), category, selectedUserIds);
    showToast('Expense Added!', `₹${totalAmount} split equally (₹${perPersonShare} each).`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-950/80 border border-amber-800/60 rounded-2xl text-amber-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Add Group Expense / Party</h3>
            <p className="text-xs text-slate-400">Split bills equally among crew members</p>
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

          {/* Participant Multi-Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span>Select Participants ({selectedUserIds.length})</span>
              <span className="text-amber-400 font-bold">₹{perPersonShare} / person</span>
            </label>

            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {appStore.profiles.map(p => {
                const isSelected = selectedUserIds.includes(p.id);

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleUserSelection(p.id)}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-amber-950/60 border-amber-500/80 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <img src={p.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                      <span className="truncate">{p.full_name.split(' ')[0]}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all"
          >
            Create Expense & Calculate Shares
          </button>
        </form>
      </div>
    </div>
  );
};
