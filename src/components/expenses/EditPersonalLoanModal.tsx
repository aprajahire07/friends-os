import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, DollarSign, Tag, FileText } from 'lucide-react';
import { PersonalLoan, Profile } from '../../types';
import { appStore } from '../../lib/store';
import { useToast } from '../ui/Toast';

interface EditPersonalLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: PersonalLoan | null;
}

export const EditPersonalLoanModal: React.FC<EditPersonalLoanModalProps> = ({
  isOpen,
  onClose,
  loan,
}) => {
  const { showToast } = useToast();
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<string>('Other');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = ['Auto', 'Bus', 'Metro', 'Food', 'Cash', 'Hostel', 'Stationery', 'Other'];

  useEffect(() => {
    if (loan) {
      setAmount(loan.amount || 0);
      setReason(loan.reason || '');
      setCategory(loan.category || 'Other');
    }
  }, [loan]);

  if (!isOpen || !loan) return null;

  const numAmount = Number(amount) || 0;
  const lender = loan.lender_profile || appStore.profiles.find(p => p.id === loan.lender_id);
  const borrower = loan.borrower_profile || appStore.profiles.find(p => p.id === loan.borrower_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (numAmount <= 0) {
      showToast('Invalid Amount', 'Please enter an amount greater than 0', 'error');
      return;
    }

    if (!reason.trim()) {
      showToast('Reason Required', 'Please enter a reason for the loan', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await appStore.updatePersonalLoan(loan.id, {
        amount: numAmount,
        reason: reason.trim(),
        category,
      });

      showToast('Loan Updated', `Updated transaction to ₹${numAmount} for "${reason.trim()}".`, 'success');
      onClose();
    } catch (err) {
      showToast('Update Failed', 'Could not update loan transaction', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <h3 className="text-base font-black text-white">Edit Loan Transaction</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counterparty summary */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold">Lender (Gave)</span>
            <span className="font-bold text-white">{lender?.full_name || 'Lender'}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-semibold">Borrower (Owes)</span>
            <span className="font-bold text-white">{borrower?.full_name || 'Borrower'}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Amount (₹)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-base">
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="1"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full pl-8 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-lg font-black text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Reason / Description</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Metro, Auto, Chai, Exam Form..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Category</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    category === cat
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
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
