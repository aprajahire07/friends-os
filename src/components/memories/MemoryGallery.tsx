import React, { useState } from 'react';
import { Images, Plus, X, Lock, Unlock, Settings, ShieldCheck } from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { isUserAdmin } from '../../services/appSettings';
import { Memory } from '../../types';
import { getSyncMediaUrl } from '../../services/storage';
import { UploadMemoryModal } from './UploadMemoryModal';
import { MemoryLockedView } from './MemoryLockedView';
import { MemorySettingsModal } from './MemorySettingsModal';

export const MemoryGallery: React.FC = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  const store = useAppStore();
  const currentUser = store.currentUser;
  const isAdmin = isUserAdmin(currentUser);

  const isLocked = store.memoriesLocked && !store.sessionUnlockedMemories && !isAdmin;
  const memories = store.memories;

  // Group memories by Year and Month
  const groupedMemories: { [yearMonth: string]: Memory[] } = {};
  if (!isLocked) {
    memories.forEach(mem => {
      const parts = mem.date.split('-'); // e.g. "2026-08-10"
      const year = parts[0] || '2026';
      const monthNum = parseInt(parts[1] || '8', 10);
      const monthName = new Date(2026, monthNum - 1, 1).toLocaleString('en-US', { month: 'long' });
      const key = `${year} — ${monthName}`;

      if (!groupedMemories[key]) groupedMemories[key] = [];
      groupedMemories[key].push(mem);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24 md:pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Images className="w-5 h-5 text-indigo-400" />
              <span>Memories 📸</span>
            </h2>
            {store.memoriesLocked ? (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 font-bold text-[10px] flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                <Unlock className="w-3 h-3" /> Unlocked
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Photos from college trips, campus days, and friend moments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin Settings Button */}
          {isAdmin && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all flex items-center gap-1.5 shadow"
              title="Admin Memory Lock & Passcode Settings"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>Admin Lock Settings</span>
            </button>
          )}

          {!isLocked && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Add Memory</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Notice Banner if Admin is viewing locked memories */}
      {isAdmin && store.memoriesLocked && (
        <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-between gap-3 text-xs text-indigo-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong>Admin Mode:</strong> Memories are locked for regular members. You have administrative access.
            </span>
          </div>
          <button
            onClick={() => appStore.toggleMemoriesLock(false)}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shrink-0"
          >
            Unlock for All
          </button>
        </div>
      )}

      {/* Conditional Rendering: Locked View vs Photo Gallery */}
      {isLocked ? (
        <MemoryLockedView />
      ) : memories.length === 0 ? (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 text-xs space-y-3">
          <p className="text-sm font-bold text-white">Your memories are waiting 📸</p>
          <p className="text-slate-400">Share your first college trip or canteen moment with the group.</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30"
          >
            Add First Memory
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMemories).map(([groupKey, groupItems]) => (
            <div key={groupKey} className="space-y-3">
              <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider">
                {groupKey}
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {groupItems.map(mem => (
                  <div
                    key={mem.id}
                    onClick={() => setSelectedMemory(mem)}
                    className="relative aspect-square rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer group shadow-lg"
                  >
                    <img
                      src={getSyncMediaUrl('memories', mem.media_urls[0]) || 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80'}
                      alt={mem.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                      <p className="text-xs font-bold text-white line-clamp-1">{mem.title}</p>
                      <p className="text-[10px] text-slate-300">{mem.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Photo Modal */}
      {selectedMemory && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedMemory(null)}
              className="absolute top-4 right-4 z-10 p-2 text-white rounded-xl bg-slate-950/60 hover:bg-slate-950 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <img
              src={getSyncMediaUrl('memories', selectedMemory.media_urls[0])}
              alt={selectedMemory.title}
              className="w-full max-h-[60vh] object-contain bg-slate-950"
            />

            <div className="p-5 space-y-2">
              <h3 className="text-lg font-bold text-white">{selectedMemory.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{selectedMemory.caption}</p>
              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800">
                <span>📍 {selectedMemory.location || 'College'}</span>
                <span>📅 {selectedMemory.date}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <UploadMemoryModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} />
      <MemorySettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </div>
  );
};
