import React, { useState } from 'react';
import { X, Backpack, Calendar, ArrowDownLeft, ArrowUpRight, Check } from 'lucide-react';
import { appStore } from '../../lib/store';
import { useToast } from '../ui/Toast';

interface AddBorrowedItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddBorrowedItemModal: React.FC<AddBorrowedItemModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const currentUser = appStore.currentUser;
  const friendsList = appStore.profiles.filter(p => p.id !== currentUser.id);

  // Direction: 'borrowed_by_me' (I borrowed from Friend) vs 'lent_by_me' (I lent to Friend)
  const [direction, setDirection] = useState<'borrowed_by_me' | 'lent_by_me'>('borrowed_by_me');
  const [selectedFriendId, setSelectedFriendId] = useState(friendsList[0]?.id || '');
  const [itemName, setItemName] = useState('Calculator');
  const [description, setDescription] = useState('');

  // Default due date: 7 days from today in YYYY-MM-DD
  const getDefaultDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  };

  const [dueDate, setDueDate] = useState<string>(getDefaultDate(7));

  if (!isOpen) return null;

  const datePresets = [
    { label: 'Tomorrow', days: 1 },
    { label: '3 Days', days: 3 },
    { label: '1 Week', days: 7 },
    { label: '2 Weeks', days: 14 },
    { label: '1 Month', days: 30 },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !selectedFriendId) return;

    const targetFriend = friendsList.find(p => p.id === selectedFriendId);
    if (!targetFriend) return;

    // If I borrowed: Owner = Friend, Borrower = Me
    // If I lent: Owner = Me, Borrower = Friend
    const ownerId = direction === 'borrowed_by_me' ? selectedFriendId : currentUser.id;
    const borrowerId = direction === 'borrowed_by_me' ? currentUser.id : selectedFriendId;

    appStore.addBorrowedItem(ownerId, borrowerId, itemName.trim(), dueDate, description.trim());

    if (direction === 'borrowed_by_me') {
      showToast(
        'Item Logged 🎒',
        `You borrowed ${targetFriend.full_name.split(' ')[0]}'s ${itemName} (Due: ${dueDate})`,
        'success'
      );
    } else {
      showToast(
        'Item Lent 🎒',
        `${targetFriend.full_name.split(' ')[0]} borrowed your ${itemName} (Due: ${dueDate})`,
        'success'
      );
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Backpack className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-black text-white">Track Borrowed Item</h3>
          </div>
          <p className="text-xs text-slate-400">
            Keep clear, shared records of items lent or borrowed with friends
          </p>
        </div>

        {/* Direction Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => setDirection('borrowed_by_me')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              direction === 'borrowed_by_me'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>I Borrowed</span>
          </button>

          <button
            type="button"
            onClick={() => setDirection('lent_by_me')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              direction === 'lent_by_me'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>I Lent Out</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Item Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Item Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Scientific Calculator, Laptop Charger, Book"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Target Friend */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              {direction === 'borrowed_by_me' ? 'Borrowed From (Owner):' : 'Lent To (Borrower):'}
            </label>
            {friendsList.length === 0 ? (
              <p className="text-xs text-amber-400">No other friends found. Invite friends first!</p>
            ) : (
              <select
                value={selectedFriendId}
                onChange={e => setSelectedFriendId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {friendsList.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} (@{p.username})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Due Date & Presets */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Expected Return Date *
              </label>
              <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {dueDate}
              </span>
            </div>

            <input
              type="date"
              required
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 mb-2"
            />

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              {datePresets.map(preset => {
                const targetDateStr = getDefaultDate(preset.days);
                const isSelected = dueDate === targetDateStr;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDueDate(targetDateStr)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description/Note (Optional) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Notes / Condition (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Casio fx-991EX with cover"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={!itemName.trim() || !selectedFriendId}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Save to Borrowed Tracker</span>
          </button>
        </form>
      </div>
    </div>
  );
};

