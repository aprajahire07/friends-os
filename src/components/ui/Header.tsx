import React from 'react';
import { 
  Bell, 
  Search, 
  Database, 
  CheckCircle2, 
  AlertTriangle,
  Sun,
  Moon
} from 'lucide-react';
import { Profile, NavigationTab } from '../../types';
import { isSupabaseConfigured } from '../../lib/supabase';

interface HeaderProps {
  currentUser: Profile;
  onSelectTab: (tab: NavigationTab) => void;
  unreadNotifsCount: number;
  onOpenSearch: () => void;
  onOpenSupabaseConfig: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSelectTab,
  unreadNotifsCount,
  onOpenSearch,
  onOpenSupabaseConfig,
  isDarkMode,
  onToggleTheme,
}) => {
  // Determine greeting based on current local hour
  const hour = new Date().getHours();
  let timeGreeting = 'Good morning';
  if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
  if (hour >= 17) timeGreeting = 'Good evening';

  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
      {/* User Greeting */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onSelectTab('profile')}
          className="relative group focus:outline-none"
        >
          <img
            src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
            alt={currentUser.full_name}
            className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/50 group-hover:border-indigo-400 transition-colors"
          />
          <span className="absolute -bottom-0.5 -right-0.5 text-xs bg-slate-900 rounded-full p-0.5 shadow">
            {currentUser.status_emoji || '🟢'}
          </span>
        </button>

        <div>
          <h2 className="font-bold text-sm md:text-base text-slate-100 flex items-center gap-2">
            <span>{timeGreeting}, <span className="text-indigo-400">{currentUser.full_name.split(' ')[0]}</span></span>
          </h2>
          <p className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-xs">
            {currentUser.status_text || currentUser.current_location || 'Online in FRIEND OS'}
          </p>
        </div>
      </div>

      {/* Header Tools */}
      <div className="flex items-center gap-2">
        {/* Backend Status Pill */}
        <button
          onClick={onOpenSupabaseConfig}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
            isSupabaseConfigured
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/80'
              : 'bg-amber-950/60 border-amber-800/60 text-amber-300 hover:bg-amber-900/80'
          }`}
          title={isSupabaseConfigured ? 'Connected to live Supabase Backend' : 'Running on Local Engine (Click to setup Supabase)'}
        >
          <Database className="w-3.5 h-3.5" />
          {isSupabaseConfigured ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Live Supabase
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" /> Local Mode
            </span>
          )}
        </button>

        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          title="Global Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-slate-700 transition-colors"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
        </button>

        {/* Notifications Button */}
        <button
          onClick={() => onSelectTab('notifications')}
          className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {Boolean(unreadNotifsCount > 0) && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
              {unreadNotifsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
