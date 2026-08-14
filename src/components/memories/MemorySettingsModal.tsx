import React, { useState } from 'react';
import { X, Lock, Unlock, Key, ShieldCheck, AlertCircle } from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { isUserAdmin } from '../../services/appSettings';
import { useToast } from '../ui/Toast';

interface MemorySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemorySettingsModal: React.FC<MemorySettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;
  const isAdmin = isUserAdmin(currentUser);

  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [isChangingPasscode, setIsChangingPasscode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800 flex items-center justify-center mx-auto text-rose-400">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-white">Admin Access Only</h3>
          <p className="text-xs text-slate-400">
            Only the group administrator ({appStore.profiles.find(p => p.role === 'admin')?.full_name || 'Admin'}) can configure Memories lock and security settings.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleToggleLock = async () => {
    const nextState = !store.memoriesLocked;
    const success = await appStore.toggleMemoriesLock(nextState);
    if (success) {
      showToast(
        nextState ? '🔒 Memories Locked' : '🔓 Memories Unlocked',
        nextState 
          ? 'Memories are now locked for regular group members.'
          : 'Memories are now unlocked for all group members.',
        nextState ? 'info' : 'success'
      );
    } else {
      showToast('Action Failed', 'Could not update lock status.', 'error');
    }
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (newPasscode.length < 4) {
      setErrorMessage('Passcode must be at least 4 digits/characters.');
      return;
    }
    if (newPasscode !== confirmPasscode) {
      setErrorMessage('Passcodes do not match.');
      return;
    }

    setIsChangingPasscode(true);
    const success = await appStore.changeMemoriesPasscode(newPasscode);
    setIsChangingPasscode(false);

    if (success) {
      showToast('Passcode Updated 🔑', 'Memories passcode has been securely changed in Supabase.', 'success');
      setNewPasscode('');
      setConfirmPasscode('');
      onClose();
    } else {
      setErrorMessage('Failed to update passcode in Supabase.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Memories Admin Settings</h3>
              <p className="text-[10px] text-slate-400">Group Administrator Security Controls</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lock / Unlock Toggle Card */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                {store.memoriesLocked ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Memories are LOCKED
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Unlock className="w-3.5 h-3.5" /> Memories are UNLOCKED
                  </span>
                )}
              </p>
              <p className="text-[10px] text-slate-400">
                {store.memoriesLocked 
                  ? 'Members must enter passcode or wait for admin to view photos.'
                  : 'All group members can freely browse and upload memories.'}
              </p>
            </div>

            <button
              onClick={handleToggleLock}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow ${
                store.memoriesLocked
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              {store.memoriesLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Unlock Memories</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock Memories</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Change Passcode Section */}
        <form onSubmit={handleChangePasscode} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Key className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-bold text-white">Change Memories Passcode</h4>
          </div>

          <p className="text-[10px] text-slate-400">
            Initial default passcode is <code className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">0000</code>. Passcodes are hashed with SHA-256.
          </p>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1 font-semibold">New 4-Digit Passcode</label>
              <input
                type="password"
                maxLength={8}
                placeholder="Enter new passcode (e.g. 1234)"
                value={newPasscode}
                onChange={e => setNewPasscode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono tracking-widest"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Confirm New Passcode</label>
              <input
                type="password"
                maxLength={8}
                placeholder="Re-enter new passcode"
                value={confirmPasscode}
                onChange={e => setConfirmPasscode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono tracking-widest"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isChangingPasscode || !newPasscode}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{isChangingPasscode ? 'Updating...' : 'Update Passcode in Supabase'}</span>
          </button>
        </form>

        <div className="flex justify-end">
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
