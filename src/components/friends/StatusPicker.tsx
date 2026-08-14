import React, { useState, useEffect } from 'react';
import { UserStatusPreset } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import { CheckCircle2, Clock } from 'lucide-react';

export const StatusPicker: React.FC = () => {
  const { showToast } = useToast();
  useAppStore();
  const user = appStore.currentUser;

  const presets: UserStatusPreset[] = [
    '🟢 Available',
    '🟡 Busy',
    '🔴 Do Not Disturb',
    '📚 Studying',
    '😴 Sleeping',
    '🏫 College',
    '🏠 Home',
    '🎮 Gaming',
    '✈️ Travelling',
  ];

  const [selectedPreset, setSelectedPreset] = useState<UserStatusPreset>(user.status_preset || '🟢 Available');
  const [customText, setCustomText] = useState(user.status_text || '');
  const [expireHours, setExpireHours] = useState<number>(0);

  // Sync state whenever active user or their status changes
  useEffect(() => {
    setSelectedPreset(user.status_preset || '🟢 Available');
    setCustomText(user.status_text || '');
  }, [user.id, user.status_preset, user.status_text]);

  const handleUpdateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    appStore.updateUserStatus(selectedPreset, customText, expireHours > 0 ? expireHours : undefined);
    showToast('Status Updated 🟢', `Set to ${selectedPreset} ${customText ? `"${customText}"` : ''}`, 'success');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>Set Your Current Status</span>
        </h3>
        {/* Active Status Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
          <span className="text-slate-400 font-medium">Current:</span>
          <span className="text-emerald-400 font-bold">{user.status_preset || '🟢 Available'}</span>
          {user.status_text && user.status_text !== user.status_preset && (
            <span className="text-slate-300 truncate max-w-[150px]">"{user.status_text}"</span>
          )}
        </div>
      </div>

      <form onSubmit={handleUpdateStatus} className="space-y-3">
        {/* Presets Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {presets.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedPreset(p)}
              className={`p-2 rounded-xl text-xs font-semibold border transition-all text-center truncate ${
                selectedPreset === p
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Custom Status Text & Expiration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <input
              type="text"
              placeholder="Custom status text (e.g. Coding in Lab 💻)..."
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <select
              value={expireHours}
              onChange={e => setExpireHours(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={0}>Expires: Manually</option>
              <option value={1}>Expires in 1 Hour</option>
              <option value={4}>Expires in 4 Hours</option>
              <option value={24}>Expires Today</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-[0.99]"
        >
          Update My Status
        </button>
      </form>
    </div>
  );
};

