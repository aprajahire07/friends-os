import React from 'react';
import { 
  Home, 
  Users, 
  Plus, 
  MessageSquare, 
  User, 
  Wallet, 
  CalendarDays, 
  Camera, 
  Images, 
  Backpack, 
  GraduationCap 
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCreateSheet: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCreateSheet,
}) => {
  useAppStore();
  const currentUser = appStore.currentUser;

  // Unread badges (only computed when logged in)
  const pendingLoansCount = currentUser ? appStore.loans.filter(
    l => (l.lender_id === currentUser.id || l.borrower_id === currentUser.id) && l.status === 'pending'
  ).length : 0;

  const unopenedSnapsCount = currentUser ? appStore.snaps.filter(
    s => s.recipient_id === currentUser.id && s.status !== 'opened' && s.status !== 'expired'
  ).length : 0;

  const unreadChatCount = currentUser ? appStore.getUnreadMessageCount() : 0;

  // Desktop Navigation Items
  const desktopNavItems = [
    { id: 'home', label: 'Home', icon: Home, badge: null },
    { id: 'friends', label: 'Friends', icon: Users, badge: null },
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: unreadChatCount > 0 ? (unreadChatCount > 99 ? '99+' : unreadChatCount) : null },
    { id: 'expenses', label: 'Money', icon: Wallet, badge: pendingLoansCount > 0 ? pendingLoansCount : null },
    { id: 'plans', label: 'Plans', icon: CalendarDays, badge: null },
    { id: 'snaps', label: 'Snaps', icon: Camera, badge: unopenedSnapsCount > 0 ? unopenedSnapsCount : null },
    { id: 'college', label: 'College & Attendance', icon: GraduationCap, badge: null },
    { id: 'memories', label: 'Memories', icon: Images, badge: null },
    { id: 'borrowed', label: 'Borrowed Items', icon: Backpack, badge: null },
    { id: 'me', label: 'Me', icon: User, badge: null },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 p-4 space-y-2 bg-slate-900 border-r border-slate-800/80 min-h-[calc(100vh-4rem)]">
        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          FRIEND OS
        </div>

        <button
          onClick={onOpenCreateSheet}
          className="w-full mb-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Action</span>
        </button>

        <div className="space-y-1">
          {desktopNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== null && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 shadow">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Mobile Bottom Navigation (5 Simple Tabs) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 px-3 py-2 flex items-center justify-around shadow-2xl">
        {/* 1. Home */}
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-all ${
            activeTab === 'home' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>

        {/* 2. Friends */}
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-all ${
            activeTab === 'friends' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span>Friends</span>
        </button>

        {/* 3. Center + Create Button */}
        <button
          onClick={onOpenCreateSheet}
          className="w-11 h-11 -mt-4 rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 active:scale-90 transition-transform ring-4 ring-slate-950"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>

        {/* 4. Chat */}
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-all relative ${
            activeTab === 'chat' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-indigo-500 text-white animate-pulse">
                {unreadChatCount > 99 ? '99+' : unreadChatCount}
              </span>
            )}
          </div>
          <span>Chat</span>
        </button>

        {/* 5. Me */}
        <button
          onClick={() => setActiveTab('me')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-all ${
            activeTab === 'me' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-5 h-5" />
          <span>Me</span>
        </button>
      </div>
    </>
  );
};
