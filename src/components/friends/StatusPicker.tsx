import React, { useState, useEffect, useRef } from 'react';
import { UserStatusPreset } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import { ChevronDown, Clock, Check, Sparkles, X, MapPin } from 'lucide-react';

interface StatusPickerProps {
  compact?: boolean;
  className?: string;
}

export const StatusPicker: React.FC<StatusPickerProps> = ({ compact = false, className = '' }) => {
  const { showToast } = useToast();
  useAppStore();
  const user = appStore.currentUser;

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const presets: { preset: UserStatusPreset; label: string; emoji: string }[] = [
    { preset: '🟢 Available', label: 'Available', emoji: '🟢' },
    { preset: '🟡 Busy', label: 'Busy', emoji: '🟡' },
    { preset: '🔴 Do Not Disturb', label: 'Do Not Disturb', emoji: '🔴' },
    { preset: '📚 Studying', label: 'Studying', emoji: '📚' },
    { preset: '😴 Sleeping', label: 'Sleeping', emoji: '😴' },
    { preset: '🏫 College', label: 'In College / Class', emoji: '🏫' },
    { preset: '🏠 Home', label: 'Home', emoji: '🏠' },
    { preset: '🎮 Gaming', label: 'Gaming', emoji: '🎮' },
    { preset: '✈️ Travelling', label: 'Travelling', emoji: '✈️' },
  ];

  const [selectedPreset, setSelectedPreset] = useState<UserStatusPreset>(user?.status_preset || '🟢 Available');
  const [customText, setCustomText] = useState(user?.status_text || '');
  const [expireHours, setExpireHours] = useState<number>(0);

  useEffect(() => {
    if (user) {
      setSelectedPreset(user.status_preset || '🟢 Available');
      setCustomText(user.status_text || '');
    }
  }, [user?.id, user?.status_preset, user?.status_text]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  const handleSaveStatus = (presetToSave: UserStatusPreset, textToSave?: string, hours?: number) => {
    appStore.updateUserStatus(presetToSave, textToSave, (hours && hours > 0) ? hours : undefined);
    showToast('Status Updated', `Live status set to ${presetToSave}${textToSave ? ` "${textToSave}"` : ''}`, 'success');
    setIsOpen(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveStatus(selectedPreset, customText.trim() || undefined, expireHours);
  };

  const displayPreset = user.status_preset || '🟢 Available';
  const hasCustomNote = user.status_text && user.status_text !== user.status_preset;

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Compact Trigger Button */}
      <button
        type="button"
        id="status-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 hover:border-indigo-500/60 transition-all text-xs text-white shadow-sm hover:shadow active:scale-98 group"
        title="Change your current live status"
      >
        <span className="flex items-center gap-1.5 font-bold">
          <span>{user.status_emoji || displayPreset.split(' ')[0] || '🟢'}</span>
          <span className="text-emerald-400 max-w-[140px] truncate sm:max-w-[200px]">
            {displayPreset.replace(/^[^\s]+\s*/, '') || 'Available'}
          </span>
        </span>

        {hasCustomNote && (
          <span className="text-slate-400 italic text-[11px] max-w-[120px] truncate hidden sm:inline">
            "{user.status_text}"
          </span>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform ${
            isOpen ? 'rotate-180 text-indigo-400' : ''
          }`}
        />
      </button>

      {/* Popover / Dropdown Menu */}
      {isOpen && (
        <div
          id="status-picker-popover"
          className="absolute left-0 mt-2 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl z-50 text-slate-100 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Set Your Status</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-3">
            {/* Presets List */}
            <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {presets.map(item => {
                const isSelected = selectedPreset === item.preset;
                return (
                  <button
                    key={item.preset}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(item.preset);
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl text-[11px] font-medium border transition-all text-center gap-0.5 ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">{item.emoji}</span>
                    <span className="truncate w-full text-[10px]">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Status Message */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Custom note (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. In library studying, in Lab 4..."
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                maxLength={80}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Expiration Duration */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Clear status after</span>
              </label>
              <select
                value={expireHours}
                onChange={e => setExpireHours(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={0}>Don't clear automatically</option>
                <option value={1}>1 hour</option>
                <option value={4}>4 hours</option>
                <option value={24}>Today / 24 hours</option>
              </select>
            </div>

            {/* Save Button */}
            <div className="pt-1 flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 active:scale-98 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Live Status</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
