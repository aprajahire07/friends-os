import React from 'react';
import { X, Camera, Wallet, CalendarDays, Images, Backpack, FileText } from 'lucide-react';

interface CreateActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSendSnap: () => void;
  onOpenAddMoney: () => void;
  onOpenCreatePlan: () => void;
  onOpenAddMemory: () => void;
  onOpenAddBorrowed: () => void;
  onOpenAddNote?: () => void;
}

export const CreateActionSheet: React.FC<CreateActionSheetProps> = ({
  isOpen,
  onClose,
  onOpenSendSnap,
  onOpenAddMoney,
  onOpenCreatePlan,
  onOpenAddMemory,
  onOpenAddBorrowed,
  onOpenAddNote,
}) => {
  if (!isOpen) return null;

  const actions = [
    {
      title: 'Send a Snap',
      subtitle: 'Share a quick college photo with view timer',
      icon: Camera,
      color: 'from-amber-500 to-orange-500 text-slate-950',
      action: onOpenSendSnap,
    },
    {
      title: 'Add Money / Expense',
      subtitle: 'Split food, auto fares, or track who owes whom',
      icon: Wallet,
      color: 'from-emerald-500 to-teal-600 text-white',
      action: onOpenAddMoney,
    },
    {
      title: 'Make a Plan',
      subtitle: 'Plan a movie, cafe trip or college outing',
      icon: CalendarDays,
      color: 'from-indigo-600 to-violet-600 text-white',
      action: onOpenCreatePlan,
    },
    {
      title: 'Add Memory',
      subtitle: 'Upload photo from trips or campus moments',
      icon: Images,
      color: 'from-pink-500 to-rose-600 text-white',
      action: onOpenAddMemory,
    },
    {
      title: 'Add Note / PDF Doc',
      subtitle: 'Upload shared multi-photo lecture notes or PDF files',
      icon: FileText,
      color: 'from-amber-500 to-amber-600 text-slate-950',
      action: onOpenAddNote || (() => {}),
    },
    {
      title: 'Add Borrowed Item',
      subtitle: 'Track borrowed calculators, books or gadgets',
      icon: Backpack,
      color: 'from-cyan-500 to-blue-600 text-slate-950',
      action: onOpenAddBorrowed,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-extrabold text-white">What do you want to do? 👋</h3>
            <p className="text-xs text-slate-400 mt-0.5">Quick actions for your friend group</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {actions.map((act, index) => {
            const Icon = act.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  onClose();
                  act.action();
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/50 flex items-center gap-3.5 transition-all text-left group active:scale-[0.99]"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${act.color} flex items-center justify-center shrink-0 shadow-md`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {act.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{act.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
