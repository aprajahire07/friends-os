import React from 'react';
import { 
  MessageSquare, 
  Camera, 
  Wallet, 
  CalendarDays, 
  GraduationCap, 
  Cake, 
  ChevronRight, 
  Sparkles,
  Images,
  ArrowUpRight,
  FileText,
  Zap
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { NavigationTab } from '../../types';
import { resolveCollegeId, getAcademicSlotsForDate } from '../../lib/timetables';

interface MainDashboardProps {
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSendSnap: () => void;
  onOpenAddMoney: () => void;
  onOpenCreatePlan: () => void;
  onOpenAddMemory?: () => void;
  onOpenAddBorrowed?: () => void;
  onOpenAddNote?: () => void;
  onOpenInstallPWA?: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  onSelectTab,
  onOpenSendSnap,
  onOpenAddMoney,
  onOpenCreatePlan,
  onOpenAddMemory,
  onOpenAddNote,
}) => {
  const store = useAppStore();
  const user = store.currentUser;

  // Time-based greeting
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';

  // Real calculations for "What matters RIGHT NOW"
  const unreadMessagesCount = user ? store.getUnreadMessageCount() : 0;
  const unreadSnapsCount = store.snaps.filter(
    s => s.recipient_id === user?.id && s.status !== 'opened' && s.status !== 'expired'
  ).length;

  // Outstanding Money summary
  const myLentPending = (store.loans || [])
    .filter(l => l && l.lender_id === user?.id && l.status === 'pending')
    .reduce((acc, l) => acc + (l.amount || 0), 0);
  const myOwedPending = (store.loans || [])
    .filter(l => l && l.borrower_id === user?.id && l.status === 'pending')
    .reduce((acc, l) => acc + (l.amount || 0), 0);

  // Top pending loan
  const topLoan = (store.loans || []).find(
    l => l && (l.lender_id === user?.id || l.borrower_id === user?.id) && l.status === 'pending'
  );

  let loanSummaryText = 'No pending payments';
  if (topLoan) {
    if (topLoan.lender_id === user?.id) {
      const bProfile = (store.profiles || []).find(p => p && p.id === topLoan.borrower_id);
      const bName = bProfile?.full_name?.split(' ')[0] || bProfile?.username || 'Friend';
      loanSummaryText = `${bName} owes you ₹${topLoan.amount || 0}`;
    } else {
      const lProfile = (store.profiles || []).find(p => p && p.id === topLoan.lender_id);
      const lName = lProfile?.full_name?.split(' ')[0] || lProfile?.username || 'Friend';
      loanSummaryText = `You owe ${lName} ₹${topLoan.amount || 0}`;
    }
  }

  // Upcoming birthday
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;

  const upcomingBday = (store.profiles || []).map(p => {
    if (!p || !p.birthday) return null;
    const parts = p.birthday.split('-');
    if (parts.length < 3) return null;
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (isNaN(m) || isNaN(d)) return null;

    const firstName = p.full_name?.split(' ')[0] || p.username || 'Friend';

    if (m === todayMonth && d === todayDay) {
      return `${firstName}'s birthday today! 🎂`;
    } else if (m === todayMonth && d === todayDay + 1) {
      return `${firstName}'s birthday tomorrow 🎁`;
    } else if (m === todayMonth && d > todayDay && d <= todayDay + 10) {
      return `${firstName}'s birthday in ${d - todayDay} days 🎂`;
    }
    return null;
  }).find(Boolean);

  // Next class today
  const todayStr = today.toISOString().split('T')[0];
  const collegeId = resolveCollegeId(user?.college || '');
  const todaySlots = getAcademicSlotsForDate(collegeId, todayStr) || [];
  const nextClass = todaySlots.length > 0 ? todaySlots[0] : null;

  // Recent activity list
  const recentPlans = (store.plans || []).slice(0, 2);
  const recentMemories = (store.memories || []).slice(0, 2);

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24 md:pb-12">
      {/* Friendly Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            {greeting}, {user?.full_name?.split(' ')[0] || 'Friend'} 👋
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Welcome to your Friend OS hub. All your crew apps, tools, and actions in one place.
          </p>
        </div>

        {/* AI Quick Prompt Pill */}
        <button
          onClick={() => onSelectTab('ai')}
          className="self-start sm:self-auto px-3.5 py-2 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900/60 border border-indigo-500/40 hover:border-indigo-400 text-slate-200 flex items-center gap-2 text-xs font-bold transition-all shadow-lg shadow-indigo-950/60 active:scale-95 group"
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-400 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="bg-gradient-to-r from-cyan-300 via-indigo-200 to-indigo-300 bg-clip-text text-transparent">
            Ask Gemini AI
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* RIGHT NOW HIGHLIGHTS BOX */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Right Now</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>

        <div className="space-y-2.5">
          {/* Messages (Shown ONLY when there are genuine unread messages) */}
          {unreadMessagesCount > 0 && (
            <div
              onClick={() => {
                appStore.markAllMessagesAsRead();
                onSelectTab('chat');
              }}
              className="p-3 bg-slate-950 border border-indigo-900/60 hover:border-indigo-600/80 rounded-2xl flex items-center justify-between cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white">
                  {unreadMessagesCount === 1
                    ? '1 new message in Group Chat'
                    : `${unreadMessagesCount} new messages in Group Chat`}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
            </div>
          )}

          {/* Snaps */}
          <div
            onClick={() => onSelectTab('snaps')}
            className="p-3 bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">
                {unreadSnapsCount > 0 ? `📸 ${unreadSnapsCount} new snap waiting` : 'Check crew streaks & snaps'}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>

          {/* Money */}
          <div
            onClick={() => onSelectTab('expenses')}
            className="p-3 bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">
                💰 {loanSummaryText}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>

          {/* Birthday */}
          {upcomingBday && (
            <div
              onClick={() => onSelectTab('me')}
              className="p-3 bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
                  <Cake className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white">
                  {upcomingBday}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </div>
          )}

          {/* Next Class */}
          <div
            onClick={() => onSelectTab('college')}
            className="p-3 bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">
                🏫 {nextClass ? `Next class: ${nextClass.subject_name} at ${nextClass.start_time}` : 'No remaining classes today'}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS ROW */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Quick Actions</span>
          </h3>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {/* Quick Snap */}
          <button
            type="button"
            onClick={onOpenSendSnap}
            className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-1.5 text-slate-100 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Snap</span>
          </button>

          {/* Quick Money / Split */}
          <button
            type="button"
            onClick={onOpenAddMoney}
            className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-1.5 text-slate-100 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Money</span>
          </button>

          {/* Quick Plan */}
          <button
            type="button"
            onClick={onOpenCreatePlan}
            className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-1.5 text-slate-100 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Plan</span>
          </button>

          {/* Quick Memory */}
          <button
            type="button"
            onClick={() => onSelectTab('memories')}
            className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-pink-500/50 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-1.5 text-slate-100 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 group-hover:scale-110 transition-transform flex items-center justify-center">
              <Images className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Memories</span>
          </button>

          {/* Quick Note */}
          <button
            type="button"
            onClick={() => onSelectTab('notes')}
            className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-1.5 text-slate-100 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Notes</span>
          </button>

          {/* Quick AI */}
          <button
            type="button"
            onClick={() => onSelectTab('ai')}
            className="p-3.5 rounded-2xl bg-gradient-to-b from-indigo-950/70 to-slate-900 border border-indigo-500/40 hover:border-indigo-400 flex flex-col items-center justify-center gap-1.5 text-slate-100 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 text-white group-hover:scale-110 transition-transform flex items-center justify-center shadow-md shadow-indigo-600/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              Gemini AI
            </span>
          </button>
        </div>
      </div>

      {/* WHAT'S HAPPENING? RECENT ACTIVITY */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            What's Happening?
          </h3>
          <span className="text-[11px] text-indigo-400 font-semibold">Crew Activity</span>
        </div>

        <div className="space-y-3">
          {recentPlans.map(plan => (
            <div
              key={plan.id}
              onClick={() => onSelectTab('plans')}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{plan.title}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    📍 {plan.location || 'Campus'} • {(plan.participants || []).length} friends interested
                  </p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500" />
            </div>
          ))}

          {recentMemories.map(mem => (
            <div
              key={mem.id}
              onClick={() => onSelectTab('memories')}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
                  <Images className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{mem.title}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    📸 Memory captured in {mem.location || 'College'}
                  </p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

