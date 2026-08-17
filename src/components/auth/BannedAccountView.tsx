import React from 'react';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import { appStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import { FRIEND_OS_ADMIN_EMAIL } from '../../services/appSettings';

interface BannedAccountViewProps {
  userEmail?: string;
  userName?: string;
}

export const BannedAccountView: React.FC<BannedAccountViewProps> = ({
  userEmail,
  userName
}) => {
  const { showToast } = useToast();

  const handleLogout = () => {
    appStore.logout();
    showToast('Logged Out', 'You have been safely signed out.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100 font-sans selection:bg-rose-500 selection:text-white">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Banned Icon */}
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 bg-rose-600/20 rounded-full blur-xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-3xl bg-rose-950/80 border-2 border-rose-600 flex items-center justify-center text-rose-400 shadow-xl">
            <ShieldAlert className="w-10 h-10 stroke-[2.5]" />
          </div>
        </div>

        {/* Header */}
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 text-[10px] font-black uppercase tracking-wider">
            Account Suspended
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Account Disabled
          </h2>
          <p className="text-sm font-semibold text-rose-300">
            {userName ? `${userName}'s account has been suspended.` : 'Your account has been disabled by the administrator.'}
          </p>
        </div>

        {/* Information Box */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2 text-slate-400">
          <p>
            You currently cannot send messages, create transactions, organize plans, or post memories on FRIEND OS.
          </p>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Admin Contact:</span>
            <a 
              href={`mailto:${FRIEND_OS_ADMIN_EMAIL}`}
              className="text-indigo-400 hover:text-indigo-300 font-mono font-bold flex items-center gap-1"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{FRIEND_OS_ADMIN_EMAIL}</span>
            </a>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 border border-slate-700"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
};
