import React from 'react';
import { 
  Home, 
  Users, 
  MessageSquare, 
  Camera, 
  Wallet, 
  CalendarDays, 
  Images, 
  Backpack, 
  Cake, 
  GraduationCap, 
  BarChart3, 
  Bell, 
  User,
  ShieldAlert,
  Database
} from 'lucide-react';
import { NavigationTab } from '../../types';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  unreadMessagesCount: number;
  unreadSnapsCount: number;
  unreadNotifsCount: number;
  onOpenSupabaseConfig: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  unreadMessagesCount,
  unreadSnapsCount,
  unreadNotifsCount,
  onOpenSupabaseConfig
}) => {
  const navItems = [
    { id: 'home' as NavigationTab, label: 'Home', icon: Home },
    { id: 'friends' as NavigationTab, label: 'Friends', icon: Users },
    { id: 'discussions' as NavigationTab, label: 'Discussions', icon: MessageSquare, badge: unreadMessagesCount },
    { id: 'snaps' as NavigationTab, label: 'Snaps', icon: Camera, badge: unreadSnapsCount },
    { id: 'expenses' as NavigationTab, label: 'Expenses', icon: Wallet },
    { id: 'plans' as NavigationTab, label: 'Plans', icon: CalendarDays },
    { id: 'memories' as NavigationTab, label: 'Memories', icon: Images },
    { id: 'borrowed' as NavigationTab, label: 'Borrowed', icon: Backpack },
    { id: 'dates' as NavigationTab, label: 'Dates & Birthdays', icon: Cake },
    { id: 'college' as NavigationTab, label: 'College & Schedule', icon: GraduationCap },
    { id: 'attendance' as NavigationTab, label: 'Attendance', icon: BarChart3 },
    { id: 'notifications' as NavigationTab, label: 'Notifications', icon: Bell, badge: unreadNotifsCount },
    { id: 'profile' as NavigationTab, label: 'Profile', icon: User },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-950 text-slate-200 h-screen sticky top-0 shrink-0">
      {/* Brand Logo & Title */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-violet-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-indigo-500/20">
            F
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wider bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent uppercase">
              FRIEND OS
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight">Private Crew OS v2.6</p>
          </div>
        </div>

        <button
          onClick={onOpenSupabaseConfig}
          title="Supabase Backend Config & SQL Exporter"
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors"
        >
          <Database className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}`} />
                <span>{item.label}</span>
              </div>

              {Boolean(item.badge && item.badge > 0) && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-500 text-white shadow-sm">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Admin Quick Action Footer */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={() => onSelectTab('admin')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            currentTab === 'admin'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>Group Admin Console</span>
        </button>
      </div>
    </aside>
  );
};
