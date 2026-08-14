import React, { useState } from 'react';
import { 
  Home, 
  MessageSquare, 
  Camera, 
  GraduationCap, 
  User, 
  Menu, 
  X,
  Users,
  Wallet,
  CalendarDays,
  Images,
  Backpack,
  Cake,
  BarChart3,
  Bell,
  Database
} from 'lucide-react';
import { NavigationTab } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface BottomNavProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  unreadMessagesCount: number;
  unreadSnapsCount: number;
  unreadNotifsCount: number;
  onOpenSupabaseConfig: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  unreadMessagesCount,
  unreadSnapsCount,
  unreadNotifsCount,
  onOpenSupabaseConfig,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const mainTabs = [
    { id: 'home' as NavigationTab, label: 'Home', icon: Home },
    { id: 'discussions' as NavigationTab, label: 'Chat', icon: MessageSquare, badge: unreadMessagesCount },
    { id: 'snaps' as NavigationTab, label: 'Snap', icon: Camera, badge: unreadSnapsCount },
    { id: 'college' as NavigationTab, label: 'College', icon: GraduationCap },
    { id: 'profile' as NavigationTab, label: 'Profile', icon: User },
  ];

  const extraTabs = [
    { id: 'friends' as NavigationTab, label: 'Friends Directory', icon: Users },
    { id: 'expenses' as NavigationTab, label: 'Group Expenses & Loans', icon: Wallet },
    { id: 'plans' as NavigationTab, label: 'Plans & Polls', icon: CalendarDays },
    { id: 'memories' as NavigationTab, label: 'Memory Gallery', icon: Images },
    { id: 'borrowed' as NavigationTab, label: 'Borrowed Tracker', icon: Backpack },
    { id: 'dates' as NavigationTab, label: 'Important Dates & Birthdays', icon: Cake },
    { id: 'attendance' as NavigationTab, label: 'Attendance Center', icon: BarChart3 },
    { id: 'notifications' as NavigationTab, label: 'Notifications', icon: Bell, badge: unreadNotifsCount },
  ];

  const handleExtraTabClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    setShowMenu(false);
  };

  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 px-2 py-2 flex items-center justify-around text-slate-400 shadow-2xl">
        {mainTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
                isActive ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-indigo-400' : ''}`} />
              <span className="text-[10px] mt-0.5">{tab.label}</span>

              {Boolean(tab.badge && tab.badge > 0) && (
                <span className="absolute -top-0.5 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* More Menu Toggle */}
        <button
          onClick={() => setShowMenu(prev => !prev)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            showMenu ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">More</span>
        </button>
      </nav>

      {/* Expanded Menu Modal for Mobile */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">
                    F
                  </div>
                  <h3 className="font-bold text-base text-white">FRIEND OS Menu</h3>
                </div>
                <button
                  onClick={() => setShowMenu(false)}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                {extraTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = currentTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleExtraTabClick(tab.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl text-xs font-semibold border transition-all text-left ${
                        isActive
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onOpenSupabaseConfig();
                }}
                className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-4 py-2.5 rounded-xl"
              >
                <Database className="w-4 h-4" />
                <span>Backend & Database SQL</span>
              </button>

              <p className="text-[10px] text-slate-500">FRIEND OS v2.6</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
