import React from 'react';
import { X, Backpack, Calendar, User, CheckCircle2, Clock, FileText } from 'lucide-react';
import { BorrowedItem } from '../../types';
import { appStore } from '../../lib/store';

interface BorrowedDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: BorrowedItem | null;
}

export const BorrowedDetailModal: React.FC<BorrowedDetailModalProps> = ({
  isOpen,
  onClose,
  item
}) => {
  if (!isOpen || !item) return null;

  const currentUser = appStore.currentUser;
  const isOwner = item.owner_id === currentUser.id;
  const owner = item.owner_profile || appStore.profiles.find(p => p.id === item.owner_id);
  const borrower = item.borrower_profile || appStore.profiles.find(p => p.id === item.borrower_id);
  const isReturned = item.status === 'returned';

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Backpack className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-black text-white">Borrowed Item Details</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Card */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
          isReturned 
            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
            : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {isReturned ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-indigo-400 shrink-0" />
            )}
            <div>
              <p className="text-xs font-bold">
                {isReturned ? 'Returned to Owner' : 'Currently Borrowed'}
              </p>
              <p className="text-[10px] text-slate-400">
                {isReturned 
                  ? `Returned on ${formatDate(item.returned_at || item.expected_return_date)}`
                  : `Due by ${formatDate(item.expected_return_date)}`}
              </p>
            </div>
          </div>
          <span className="text-2xl">🎒</span>
        </div>

        {/* Item Information */}
        <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Backpack className="w-3.5 h-3.5 text-indigo-400" /> Item Name
            </span>
            <span className="font-bold text-white text-sm">{item.item_name}</span>
          </div>

          {item.description && (
            <div className="flex items-start justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> Description
              </span>
              <span className="font-medium text-slate-300 max-w-[60%] text-right">{item.description}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" /> Owner (Lender)
            </span>
            <div className="flex items-center gap-2">
              <img
                src={owner?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                alt={owner?.full_name}
                className="w-5 h-5 rounded-full object-cover border border-slate-700"
              />
              <span className="font-bold text-white">
                {owner?.full_name} {isOwner && '(You)'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" /> Borrower
            </span>
            <div className="flex items-center gap-2">
              <img
                src={borrower?.avatar_url || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100&q=80'}
                alt={borrower?.full_name}
                className="w-5 h-5 rounded-full object-cover border border-slate-700"
              />
              <span className="font-bold text-white">
                {borrower?.full_name} {item.borrower_id === currentUser.id && '(You)'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Borrowed Date
            </span>
            <span className="text-slate-300 font-medium">{formatDate(item.borrowed_date || item.created_at)}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Expected Return
            </span>
            <span className="text-amber-300 font-medium">{formatDate(item.expected_return_date)}</span>
          </div>

          {isReturned && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Returned Date
              </span>
              <span className="text-emerald-400 font-bold">{formatDate(item.returned_at || item.expected_return_date)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
