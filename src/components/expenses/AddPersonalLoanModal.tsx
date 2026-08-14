import React, { useState } from 'react';
import { X, HandCoins, ArrowRight } from 'lucide-react';
import { appStore } from '../../lib/store';
import { PersonalLoan } from '../../types';
import { useToast } from '../ui/Toast';

interface AddPersonalLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddPersonalLoanModal: React.FC<AddPersonalLoanModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const currentUser = appStore.currentUser;
  const friendsList = appStore.profiles.filter(p => p.id !== currentUser.id);

  const [borrowerId, setBorrowerId] = useState(friendsList[0]?.id || '');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('Auto fare to college');
  const [category, setCategory] = useState<PersonalLoan['category']>('Auto');

  if (!isOpen) return null;

  const categories: PersonalLoan['category'][] = ['Auto', 'Bus', 'Metro', 'Food', 'Cash', 'Other'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowerId || !amount || Number(amount) <= 0 || !reason.trim()) return;

    appStore.addPersonalLoan(borrowerId, Number(amount), reason, category);
    const borrowerName = appStore.profiles.find(p => p.id === borrowerId)?.full_name || 'Friend';
    showToast('Lending Logged', `Logged ₹${amount} lent to ${borrowerName} (${category}).`, 'success');
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
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/60 rounded-2xl text-emerald-400">
            <HandCoins className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Log Personal Lending / Debt</h3>
            <p className="text-xs text-slate-400">Track 1-on-1 money given to a friend</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Who did you give money to?</label>
            <select
              value={borrowerId}
              onChange={e => setBorrowerId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
            >
              {friendsList.map(p => (
                <option key={p.id} value={p.id}>{p.full_name} (@{p.username})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Amount (₹)</label>
              <input
                type="number"
                required
                min={1}
                placeholder="40"
                value={amount}
                onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as PersonalLoan['category'])}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason / Notes</label>
            <input
              type="text"
              required
              placeholder="e.g. Auto fare to GH Raisoni"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
          >
            <span>Save Debt Entry</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
