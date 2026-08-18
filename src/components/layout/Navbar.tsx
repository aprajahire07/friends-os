import React, { useState } from 'react';
import { Users, ChevronDown, LogOut, User, Settings, Sparkles, ShieldCheck, Download, Smartphone } from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import { StatusPicker } from '../friends/StatusPicker';
import { isUserAdmin } from '../../services/appSettings';
import { usePWA } from '../../hooks/usePWA';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenOnboarding: () => void;
  onOpenInstallPWA?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  activeTab, 
  setActiveTab, 
  onOpenOnboarding,
  onOpenInstallPWA
}) => {
  const { showToast } = useToast();
  const { isStandalone, canInstall } = usePWA();
  useAppStore();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const currentUser = appStore.currentUser;

  if (!currentUser) return null;

  const isAdmin = isUserAdmin(currentUser);

  const handleLogout = () => {
    setShowUserDropdown(false);
    appStore.logout();
    showToast('Signed Out', 'You have been logged out securely.', 'info');
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* App Branding */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('home')}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
            <Sparkles className="w-4 h-4" />
          </div>

          <div>
            <h1 className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1">
              <span>Friend OS</span>
              <span className="text-xs">👋</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">
              {currentUser.college || 'College Friend Group'}
            </p>
          </div>
        </div>

        {/* Live Status Control in Navbar */}
        <div className="hidden sm:flex items-center gap-2">
          <StatusPicker />
        </div>

        {/* Right Action Items */}
        <div className="flex items-center gap-2">
          {/* Quick Install Button if eligible */}
          {!isStandalone && onOpenInstallPWA && (
            <button
              onClick={onOpenInstallPWA}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/80 border border-indigo-700/60 hover:bg-indigo-900 text-indigo-300 hover:text-white text-xs font-bold transition-all shadow-sm"
              title="Install Friend OS PWA"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Install App</span>
            </button>
          )}

          {/* User Profile & Account Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all text-xs text-white"
            >
              <img
                src={currentUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username || 'user'}`}
                alt={currentUser.full_name}
                className="w-6 h-6 rounded-full object-cover border border-indigo-500/50 bg-slate-800"
              />
              <span className="font-bold text-xs text-white hidden sm:inline">
                {currentUser.full_name?.split(' ')[0] || currentUser.username}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* User Account Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                  <p className="font-bold text-white text-xs truncate">{currentUser.full_name}</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">@{currentUser.username}</p>
                  <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    isAdmin ? 'bg-indigo-950 border border-indigo-800 text-indigo-400' : 'bg-slate-800 border border-slate-700 text-slate-300'
                  }`}>
                    {isAdmin ? '⚙️ Admin' : '👤 Member'}
                  </span>
                </div>

                <div className="space-y-0.5">
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        setActiveTab('admin');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-indigo-300 hover:bg-indigo-950/60 hover:text-white transition-colors text-left font-bold"
                    >
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      <span>⚙️ Admin Control Center</span>
                    </button>
                  )}

                  {!isStandalone && onOpenInstallPWA && (
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenInstallPWA();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-indigo-300 hover:bg-indigo-950/40 hover:text-white transition-colors text-left font-semibold"
                    >
                      <Smartphone className="w-4 h-4 text-indigo-400" />
                      <span>📱 Install Friend OS App</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setActiveTab('me');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                  >
                    <User className="w-4 h-4 text-indigo-400" />
                    <span>View Profile & QR</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenOnboarding();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Edit Profile Info</span>
                  </button>
                </div>

                <div className="mt-1 pt-1 border-t border-slate-800/80">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-950/40 transition-colors text-left font-semibold"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
