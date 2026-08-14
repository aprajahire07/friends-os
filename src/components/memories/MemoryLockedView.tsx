import React, { useState } from 'react';
import { Lock, Key, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import { appStore } from '../../lib/store';
import { useToast } from '../ui/Toast';

interface MemoryLockedViewProps {
  onUnlockedSuccess?: () => void;
}

export const MemoryLockedView: React.FC<MemoryLockedViewProps> = ({
  onUnlockedSuccess
}) => {
  const { showToast } = useToast();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter the 4-digit passcode.');
      return;
    }

    setIsVerifying(true);
    setError('');

    const isMatch = await appStore.unlockMemoriesWithPasscode(passcode);
    setIsVerifying(false);

    if (isMatch) {
      showToast('Memories Unlocked 📸', 'Welcome! Enjoy viewing your group photos.', 'success');
      if (onUnlockedSuccess) onUnlockedSuccess();
    } else {
      setError('Incorrect passcode. Try again or contact group admin.');
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 animate-in fade-in zoom-in-95 duration-200 text-center space-y-6">
      {/* Animated Lock Icon */}
      <div className="relative w-20 h-20 mx-auto">
        <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-xl animate-pulse" />
        <div className="relative w-20 h-20 rounded-3xl bg-slate-900 border-2 border-rose-600/60 flex items-center justify-center text-rose-400 shadow-2xl">
          <Lock className="w-9 h-9 stroke-[2.5]" />
        </div>
      </div>

      {/* Text Headline */}
      <div className="space-y-2">
        <h2 className="text-xl font-black text-white">🔒 Memories are Locked</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          Ask the group admin to unlock this section or enter the 4-digit passcode to access photos and moments.
        </p>
      </div>

      {/* Unlock Form */}
      <form onSubmit={handleUnlock} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="space-y-2 text-left">
          <label className="block text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span>Enter Passcode</span>
          </label>

          <input
            type="password"
            maxLength={10}
            placeholder="•••• (Default: 0000)"
            value={passcode}
            onChange={e => {
              setPasscode(e.target.value);
              if (error) setError('');
            }}
            className="w-full text-center px-4 py-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl text-lg font-mono tracking-widest text-white placeholder-slate-600 focus:outline-none transition-colors"
            autoFocus
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 text-left">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isVerifying || !passcode}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-98"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isVerifying ? 'Verifying...' : 'Unlock Memories'}</span>
        </button>

        <div className="pt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
          <HelpCircle className="w-3 h-3" />
          <span>Initial default passcode is 0000</span>
        </div>
      </form>
    </div>
  );
};
