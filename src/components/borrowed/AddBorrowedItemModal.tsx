import React, { useState } from 'react';
import { X, Backpack } from 'lucide-react';
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

  const [itemName, setItemName] = useState('Calculator');
  const [fromUserId, setFromUserId] = useState(friendsList[0]?.id || '');
  const [returnBy, setReturnBy] = useState('Friday');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !fromUserId) return;

    const fromFriend = friendsList.find(p => p.id === fromUserId);

    appStore.addBorrowedItem(fromUserId, currentUser.id, itemName.trim(), returnBy);
    showToast(
      'Logged 🎒',
      `You borrowed ${fromFriend?.full_name.split(' ')[0]}'s ${itemName} (Due: ${returnBy})`,
      'success'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <h3 className="text-lg font-black text-white">Did you borrow something? 🎒</h3>
          <p className="text-xs text-slate-400 mt-0.5">Track borrowed calculators, books, or gadgets</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              I borrowed:
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Scientific Calculator"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              From:
            </label>
            <select
              value={fromUserId}
              onChange={e => setFromUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {friendsList.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name} (@{p.username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Return by:
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Friday or 18th August"
              value={returnBy}
              onChange={e => setReturnBy(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            Save
          </button>
        </form>
      </div>
    </div>
  );
};
