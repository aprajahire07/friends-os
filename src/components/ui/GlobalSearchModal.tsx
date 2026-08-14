import React, { useState } from 'react';
import { X, Search, Users, MessageSquare, Wallet, Calendar, Images, Backpack, Cake } from 'lucide-react';
import { appStore } from '../../lib/store';
import { NavigationTab } from '../../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavigationTab) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose, onSelectTab }) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const matchingFriends = q ? appStore.profiles.filter(p => p.full_name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q) || p.college.toLowerCase().includes(q)) : [];
  const matchingMessages = q ? appStore.messages.filter(m => m.content.toLowerCase().includes(q)) : [];
  const matchingExpenses = q ? appStore.expenses.filter(e => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)) : [];
  const matchingPlans = q ? appStore.plans.filter(p => p.title.toLowerCase().includes(q) || p.location.toLowerCase().includes(q)) : [];
  const matchingMemories = q ? appStore.memories.filter(m => m.title.toLowerCase().includes(q) || m.caption.toLowerCase().includes(q)) : [];
  const matchingBorrowed = q ? appStore.borrowed.filter(b => b.item_name.toLowerCase().includes(q)) : [];
  const matchingDates = q ? appStore.importantDates.filter(d => d.title.toLowerCase().includes(q)) : [];

  const totalResults = matchingFriends.length + matchingMessages.length + matchingExpenses.length + matchingPlans.length + matchingMemories.length + matchingBorrowed.length + matchingDates.length;

  const handleNavigate = (tab: NavigationTab) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-start justify-center p-4 pt-16">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-4 text-slate-100 shadow-2xl relative">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Search className="w-5 h-5 text-indigo-400" />
          <input
            type="text"
            autoFocus
            placeholder="Search friends, messages, expenses, plans, memories..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-500"
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto mt-3 space-y-4 pr-1">
          {!q && (
            <p className="text-center py-8 text-xs text-slate-500">
              Type keywords above to search authorized FRIEND OS group data.
            </p>
          )}

          {q && totalResults === 0 && (
            <p className="text-center py-8 text-xs text-slate-400">
              No matching records found for "{query}".
            </p>
          )}

          {matchingFriends.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" /> Friends ({matchingFriends.length})
              </h4>
              <div className="space-y-1">
                {matchingFriends.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleNavigate('friends')}
                    className="w-full flex items-center gap-3 p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-left transition-colors"
                  >
                    <img src={f.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <p className="text-xs font-bold text-white">{f.full_name} (@{f.username})</p>
                      <p className="text-[10px] text-slate-400">{f.college} • {f.course_branch}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingMessages.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> Messages ({matchingMessages.length})
              </h4>
              <div className="space-y-1">
                {matchingMessages.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleNavigate('discussions')}
                    className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-left transition-colors"
                  >
                    <p className="text-xs text-slate-200 line-clamp-1">{m.content}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Category: #{m.category}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingExpenses.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-indigo-400" /> Expenses ({matchingExpenses.length})
              </h4>
              <div className="space-y-1">
                {matchingExpenses.map(e => (
                  <button
                    key={e.id}
                    onClick={() => handleNavigate('expenses')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 transition-colors"
                  >
                    <span className="text-xs font-medium text-white">{e.title}</span>
                    <span className="text-xs font-bold text-emerald-400">₹{e.total_amount}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingPlans.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Plans ({matchingPlans.length})
              </h4>
              <div className="space-y-1">
                {matchingPlans.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleNavigate('plans')}
                    className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-left transition-colors"
                  >
                    <p className="text-xs font-bold text-white">{p.title}</p>
                    <p className="text-[10px] text-slate-400">{p.date} at {p.time} • {p.location}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingMemories.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Images className="w-3.5 h-3.5 text-indigo-400" /> Memories ({matchingMemories.length})
              </h4>
              <div className="space-y-1">
                {matchingMemories.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleNavigate('memories')}
                    className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-left transition-colors"
                  >
                    <p className="text-xs font-bold text-white">{m.title}</p>
                    <p className="text-[10px] text-slate-400">{m.caption}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
