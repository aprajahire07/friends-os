import React, { useState } from 'react';
import { 
  Lock, 
  Unlock, 
  Key, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Check, 
  Eye, 
  EyeOff, 
  Sparkles,
  Info
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';

export const MemoriesSecurityView: React.FC = () => {
  const { showToast } = useToast();
  useAppStore();

  const isLocked = appStore.memoriesLocked;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Confirmation modals
  const [showDisableLockConfirm, setShowDisableLockConfirm] = useState(false);
  const [showChangePasswordConfirm, setShowChangePasswordConfirm] = useState(false);

  const handleToggleLock = async () => {
    if (isLocked) {
      // Prompt confirmation to disable lock
      setShowDisableLockConfirm(true);
    } else {
      // Instantly enable lock
      const success = await appStore.adminToggleMemoriesLock(true);
      if (success) {
        showToast(
          'Memories Locked 🔒',
          'Memories are now locked for members. They will need the security passcode to view photos.',
          'info'
        );
      } else {
        showToast('Action Failed', 'Failed to lock memories.', 'error');
      }
    }
  };

  const handleConfirmDisableLock = async () => {
    setShowDisableLockConfirm(false);
    const success = await appStore.adminToggleMemoriesLock(false);
    if (success) {
      showToast(
        'Memories Unlocked 🔓',
        'Memories lock has been disabled. All group members can now open Memories without a passcode.',
        'success'
      );
    } else {
      showToast('Action Failed', 'Failed to unlock memories.', 'error');
    }
  };

  const handleRequestChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    const clean = newPassword.trim();
    if (clean.length < 4) {
      setPasswordError('Passcode must be at least 4 characters/digits.');
      return;
    }
    if (clean !== confirmPassword.trim()) {
      setPasswordError('Passcodes do not match.');
      return;
    }

    setShowChangePasswordConfirm(true);
  };

  const handleConfirmChangePassword = async () => {
    setShowChangePasswordConfirm(false);
    setIsUpdatingPassword(true);
    setPasswordError('');

    try {
      const clean = newPassword.trim();
      const success = await appStore.adminChangeMemoriesPassword(clean);
      if (success) {
        showToast(
          'Passcode Updated 🔑',
          'Memories passcode has been securely changed and hashed in the database.',
          'success'
        );
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError('Failed to update passcode in database.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Error updating memories passcode.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-black text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          <span>Memories Security & Access Control</span>
        </h3>
        <p className="text-xs text-slate-400">
          Configure the privacy lock and access passcode for group memories and photo galleries.
        </p>
      </div>

      {/* Lock Status Card */}
      <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isLocked
                  ? 'bg-rose-950/80 border border-rose-800 text-rose-400'
                  : 'bg-emerald-950/80 border border-emerald-800 text-emerald-400'
              }`}
            >
              {isLocked ? (
                <Lock className="w-6 h-6 stroke-[2.5]" />
              ) : (
                <Unlock className="w-6 h-6 stroke-[2.5]" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white">
                  Current Status: {isLocked ? 'LOCKED' : 'UNLOCKED'}
                </h4>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    isLocked
                      ? 'bg-rose-950 border border-rose-800 text-rose-400'
                      : 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                  }`}
                >
                  {isLocked ? 'Passcode Required' : 'Open Access'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isLocked
                  ? 'Members must enter the admin passcode to open and view the Memories gallery.'
                  : 'All group members can freely open and browse Memories without entering a passcode.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleLock}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 self-start sm:self-center active:scale-95 ${
              isLocked
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
            }`}
          >
            {isLocked ? (
              <>
                <Unlock className="w-4 h-4" />
                <span>Disable Lock (Unlock for All)</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Enable Memories Lock</span>
              </>
            )}
          </button>
        </div>

        {/* Security Info Banner */}
        <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-900/50 flex items-start gap-2.5 text-xs text-indigo-300">
          <Info className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-white">
              🔒 True Server-Side Security:
            </p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              The passcode is stored as a cryptographic SHA-256 hash. When a normal user unlocks Memories, their session is authenticated in memory during the active session. The plain passcode is never transmitted to normal users or saved in localStorage.
            </p>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Set / Change Memories Passcode</h4>
            <p className="text-xs text-slate-400">
              Set a new 4-digit code (Initial default: <strong>0000</strong>).
            </p>
          </div>
        </div>

        <form onSubmit={handleRequestChangePassword} className="space-y-3 max-w-md">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">New Passcode</label>
            <div className="relative">
              <input
                type={showPasswordText ? 'text' : 'password'}
                placeholder="Enter new 4-digit passcode"
                maxLength={20}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 font-mono tracking-wider focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPasswordText(!showPasswordText)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">Confirm Passcode</label>
            <input
              type={showPasswordText ? 'text' : 'password'}
              placeholder="Re-enter new passcode"
              maxLength={20}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 font-mono tracking-wider focus:outline-none focus:border-indigo-500"
            />
          </div>

          {passwordError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{passwordError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!newPassword || !confirmPassword || isUpdatingPassword}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <Key className="w-4 h-4" />
            <span>Update Memories Passcode</span>
          </button>
        </form>
      </div>

      {/* Confirmation Modal: DISABLE LOCK */}
      {showDisableLockConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-950/80 border border-amber-800 text-amber-400">
                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Disable Memories Lock?
                </h3>
                <p className="text-xs text-slate-400">Make memories open to all members</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to disable the Memories lock? All group members will be able to view and upload memories immediately without entering a passcode.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowDisableLockConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmDisableLock}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition-all"
              >
                CONFIRM UNLOCK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: CHANGE PASSCODE */}
      {showChangePasswordConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-950/80 border border-indigo-800 text-indigo-400">
                <Key className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Confirm New Passcode
                </h3>
                <p className="text-xs text-slate-400">Memories Access Security</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to update the Memories passcode? Previous passcodes (including default 0000) will no longer work for regular users.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowChangePasswordConfirm(false)}
                disabled={isUpdatingPassword}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmChangePassword}
                disabled={isUpdatingPassword}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all"
              >
                {isUpdatingPassword ? 'Updating...' : 'CONFIRM CHANGE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
