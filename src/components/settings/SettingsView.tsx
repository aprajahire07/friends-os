import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Clock, 
  LogOut, 
  EyeOff, 
  Eye, 
  Check, 
  ChevronRight, 
  Lock, 
  Smartphone, 
  Sparkles,
  ArrowLeft,
  Info
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { AUTO_LOGOUT_OPTIONS } from '../../services/userSettings';
import { useToast } from '../ui/Toast';

interface SettingsViewProps {
  onBack?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const store = useAppStore();
  const { showToast } = useToast();
  const currentUser = store.currentUser;
  const userSettings = store.userSettings;

  const [isUpdating, setIsUpdating] = useState(false);

  // Settings values with defaults
  const autoLogoutSeconds = userSettings?.auto_logout_seconds ?? 0;
  const autoLogoutEnabled = userSettings?.auto_logout_enabled ?? (autoLogoutSeconds > 0);
  const logoutOnLeave = Boolean(userSettings?.logout_on_leave_enabled);
  const hideSensitive = Boolean(userSettings?.hide_sensitive_information);

  // Handler for Auto Logout selection
  const handleSelectAutoLogout = async (seconds: number) => {
    setIsUpdating(true);
    const isEnabled = seconds > 0;
    const res = await appStore.updateUserSettings({
      auto_logout_enabled: isEnabled,
      auto_logout_seconds: seconds,
    });
    setIsUpdating(false);

    if (res.success) {
      const option = AUTO_LOGOUT_OPTIONS.find(o => o.seconds === seconds);
      showToast(
        'Auto Logout Updated', 
        seconds === 0 ? 'Auto logout disabled.' : `Auto logout set to ${option?.label}.`, 
        'success'
      );
    } else {
      showToast('Update Failed', res.error || 'Could not save settings.', 'error');
    }
  };

  // Handler for Logout When Leaving toggle
  const handleToggleLogoutOnLeave = async () => {
    setIsUpdating(true);
    const nextState = !logoutOnLeave;
    const res = await appStore.updateUserSettings({
      logout_on_leave_enabled: nextState,
    });
    setIsUpdating(false);

    if (res.success) {
      showToast(
        nextState ? 'Logout When Leaving Enabled' : 'Logout When Leaving Disabled',
        nextState ? 'You will be signed out when leaving the app.' : 'Your session will stay active.',
        'success'
      );
    } else {
      showToast('Update Failed', res.error || 'Could not save settings.', 'error');
    }
  };

  // Handler for Hide Sensitive Information toggle
  const handleToggleHideSensitive = async () => {
    setIsUpdating(true);
    const nextState = !hideSensitive;
    const res = await appStore.updateUserSettings({
      hide_sensitive_information: nextState,
    });
    setIsUpdating(false);

    if (res.success) {
      showToast(
        nextState ? 'Privacy Mode Enabled 🔒' : 'Privacy Mode Disabled 👁️',
        nextState ? 'Sensitive chats and friend info are now hidden.' : 'Information is visible normally.',
        'success'
      );
    } else {
      showToast('Update Failed', res.error || 'Could not save settings.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24 md:pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              id="settings-back-btn"
              type="button"
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors border border-slate-800 active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Tools → Settings</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
              <span>Settings ⚙️</span>
            </h1>
          </div>
        </div>

        {/* User Account Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-semibold truncate max-w-[140px]">{currentUser?.full_name || 'Member'}</span>
        </div>
      </div>

      {/* SECTION: PRIVACY & SECURITY */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                <span>🔐 Privacy & Security</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage your session lifetimes, auto-lock timeouts, and on-screen privacy.
              </p>
            </div>
          </div>
        </div>

        {/* FEATURE 1: AUTO LOGOUT */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">🔐 Auto Logout</h3>
                  {autoLogoutEnabled && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Automatically sign out after you have been inactive for the selected time.
                </p>
              </div>
            </div>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
            {AUTO_LOGOUT_OPTIONS.slice(0, 5).map((opt) => {
              const isSelected = autoLogoutSeconds === opt.seconds;
              return (
                <button
                  key={opt.seconds}
                  id={`auto-logout-opt-${opt.seconds}`}
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleSelectAutoLogout(opt.seconds)}
                  className={`p-3 rounded-2xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-1.5 text-center active:scale-95 ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-950/60 ring-2 ring-indigo-400/40'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="text-xs">{opt.label}</span>
                  {isSelected ? (
                    <Check className="w-3.5 h-3.5 text-indigo-200 shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-slate-800/80" />

        {/* FEATURE 2: LOGOUT WHEN LEAVING */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <LogOut className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Logout When Leaving</h3>
                {logoutOnLeave && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    ON
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Protect your account when you leave Friend OS.
              </p>
            </div>
          </div>

          <button
            id="toggle-logout-on-leave-btn"
            type="button"
            disabled={isUpdating}
            onClick={handleToggleLogoutOnLeave}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              logoutOnLeave ? 'bg-indigo-600' : 'bg-slate-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                logoutOnLeave ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* FEATURE 3: HIDE SENSITIVE INFORMATION */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
              {hideSensitive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Hide Sensitive Information</h3>
                {hideSensitive && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    MASKED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Hide private information when privacy mode is enabled.
              </p>
            </div>
          </div>

          <button
            id="toggle-hide-sensitive-btn"
            type="button"
            disabled={isUpdating}
            onClick={handleToggleHideSensitive}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              hideSensitive ? 'bg-cyan-600' : 'bg-slate-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                hideSensitive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Note / Info Box */}
        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            Settings are securely synchronized to your Supabase profile and isolated per account.
          </span>
        </div>
      </div>
    </div>
  );
};
