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
  BookOpen
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { NavigationTab, Profile } from '../../types';
import { resolveCollegeId, getAcademicSlotsForDate } from '../../lib/timetables';

interface MainDashboardProps {
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSendSnap: () => void;
  onOpenAddMoney: () => void;
  onOpenCreatePlan: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  onSelectTab,
  onOpenSendSnap,
  onOpenAddMoney,
  onOpenCreatePlan,
}) => {
  const store = useAppStore();
  const user = store.currentUser;

  // Real calculations for "What matters RIGHT NOW"
  const unreadMessagesCount = user ? store.getUnreadMessageCount() : 0;
  const unreadSnapsCount = store.snaps.filter(
    s => s.recipient_id === user.id && s.status !== 'opened' && s.status !== 'expired'
  ).length;

  // Outstanding Money summary
  const myLentPending = store.loans
    .filter(l => l.lender_id === user.id && l.status === 'pending')
    .reduce((acc, l) => acc + l.amount, 0);
  const myOwedPending = store.loans
    .filter(l => l.borrower_id === user.id && l.status === 'pending')
    .reduce((acc, l) => acc + l.amount, 0);

  // Top pending loan
  const topLoan = store.loans.find(
    l => (l.lender_id === user.id || l.borrower_id === user.id) && l.status === 'pending'
  );

  let loanSummaryText = 'No pending payments';
  if (topLoan) {
    if (topLoan.lender_id === user.id) {
      const bProfile = store.profiles.find(p => p.id === topLoan.borrower_id);
      loanSummaryText = `${bProfile?.full_name.split(' ')[0]} owes you ₹${topLoan.amount}`;
    } else {
      const lProfile = store.profiles.find(p => p.id === topLoan.lender_id);
      loanSummaryText = `You owe ${lProfile?.full_name.split(' ')[0]} ₹${topLoan.amount}`;
    }
  }

  // Upcoming birthday
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;

  const upcomingBday = store.profiles.map(p => {
    if (!p.birthday) return null;
    const parts = p.birthday.split('-');
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);

    if (m === todayMonth && d === todayDay) {
      return `${p.full_name.split(' ')[0]}'s birthday today! 🎂`;
    } else if (m === todayMonth && d === todayDay + 1) {
      return `${p.full_name.split(' ')[0]}'s birthday tomorrow 🎁`;
    } else if (m === todayMonth && d > todayDay && d <= todayDay + 10) {
      return `${p.full_name.split(' ')[0]}'s birthday in ${d - todayDay} days 🎂`;
    }
    return null;
  }).find(Boolean);

  // Next class today
  const todayStr = today.toISOString().split('T')[0];
  const collegeId = resolveCollegeId(user.college);
  const todaySlots = getAcademicSlotsForDate(collegeId, todayStr);
  const nextClass = todaySlots.length > 0 ? todaySlots[0] : null;

  // Recent activity list
  const recentPlans = store.plans.slice(0, 2);
  const recentMemories = store.memories.slice(0, 2);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-12">
      {/* Friendly Greeting Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
          Good evening, {user.full_name.split(' ')[0]} 👋
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Here is what matters right now with your crew.
        </p>
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

          {/* Exam Papers Resource Hub */}
          <div
            onClick={() => onSelectTab('exam_papers')}
            className="p-3 bg-slate-950 border border-indigo-950/60 hover:border-indigo-600/80 rounded-2xl flex items-center justify-between cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                  📚 Exam Papers & Question Bank
                </span>
                <p className="text-[10px] text-slate-400">Previous semester papers & study resources</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS ROW */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Quick Actions
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={onOpenSendSnap}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-2 text-slate-100 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <span className="text-xs font-extrabold">📸 Snap</span>
          </button>

          <button
            onClick={() => onSelectTab('chat')}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-2 text-slate-100 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-extrabold">💬 Chat</span>
          </button>

          <button
            onClick={onOpenAddMoney}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-2 text-slate-100 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs font-extrabold">💰 Money</span>
          </button>

          <button
            onClick={onOpenCreatePlan}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-2 text-slate-100 transition-all active:scale-95 group shadow-lg"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="text-xs font-extrabold">📅 Plan</span>
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
                    📍 {plan.location} • {plan.participants.length} friends interested
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
