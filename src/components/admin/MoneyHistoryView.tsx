import React, { useState } from 'react';
import { 
  Wallet, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Search, 
  User, 
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { Profile } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';

export const MoneyHistoryView: React.FC = () => {
  const { showToast } = useToast();
  useAppStore();

  const profiles = appStore.profiles;
  const loans = appStore.loans;
  const expenses = appStore.expenses;

  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredProfiles = profiles.filter(p =>
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute selected user money stats
  const getUserMoneyStats = (userId: string) => {
    // 1. Loans involving user
    const userLoans = loans.filter(l => l.lender_id === userId || l.borrower_id === userId);
    const activeLoans = userLoans.filter(l => l.status === 'pending' || l.status === 'payment_claimed');
    const completedLoans = userLoans.filter(l => l.status === 'paid');

    // 2. Expenses involving user
    const userExpenses = expenses.filter(e => 
      e.paid_by === userId || 
      (e.participants && e.participants.some(p => p.user_id === userId))
    );

    return {
      activeLoansCount: activeLoans.length,
      completedLoansCount: completedLoans.length,
      totalExpensesInvolved: userExpenses.length,
      activeLoans,
      completedLoans
    };
  };

  const handleConfirmClearHistory = async () => {
    if (!selectedUser) return;
    setIsProcessing(true);

    try {
      const result = await appStore.adminClearCompletedMoneyHistory(selectedUser.id);
      if (result.success) {
        showToast(
          'History Cleared 💰',
          `Cleared ${result.clearedLoansCount} completed records for ${selectedUser.full_name}. Active debts preserved!`,
          'success'
        );
      } else {
        showToast('Action Failed', result.message || 'Could not clear history.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to clear completed money history.', 'error');
    } finally {
      setIsProcessing(false);
      setShowClearConfirm(false);
    }
  };

  const activeStats = selectedUser ? getUserMoneyStats(selectedUser.id) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-black text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-indigo-400" />
          <span>Money History Management</span>
        </h3>
        <p className="text-xs text-slate-400">
          Clear completed transaction records for users while strictly preserving all active and unpaid obligations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left column: User Selector */}
        <div className="md:col-span-5 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search user..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 max-h-96 overflow-y-auto space-y-1">
            {filteredProfiles.map(p => {
              const isSelected = selectedUser?.id === p.id;
              const stats = getUserMoneyStats(p.id);

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedUser(p)}
                  className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={p.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.username}`}
                      alt={p.full_name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700 bg-slate-900 shrink-0"
                    />
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{p.full_name}</p>
                      <p className={`text-[10px] truncate ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                        @{p.username}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                    {stats.activeLoansCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                        {stats.activeLoansCount} active
                      </span>
                    )}
                    {stats.completedLoansCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        {stats.completedLoansCount} paid
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: Selected User Details & Clear Action */}
        <div className="md:col-span-7">
          {selectedUser && activeStats ? (
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-5">
              {/* Selected User Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <img
                  src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedUser.username}`}
                  alt={selectedUser.full_name}
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-700 bg-slate-900"
                />
                <div>
                  <h4 className="text-sm font-black text-white">{selectedUser.full_name}</h4>
                  <p className="text-xs text-slate-400 font-mono">{selectedUser.email}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Active Debts (Preserved)</span>
                  </div>
                  <p className="text-xl font-black text-white">{activeStats.activeLoansCount}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    Will NEVER be deleted by clear action
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Completed / Paid Records</span>
                  </div>
                  <p className="text-xl font-black text-white">{activeStats.completedLoansCount}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    Targeted for historical clean-up
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={activeStats.completedLoansCount === 0 || isProcessing}
                  className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 active:scale-98 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {activeStats.completedLoansCount > 0
                      ? `💰 Clear Money History (${activeStats.completedLoansCount} paid loans)`
                      : 'No Completed History to Clear'}
                  </span>
                </button>
              </div>

              {/* Safety notice */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Admin safety guarantee: Active unpaid loans and outstanding split balances are strictly kept intact.
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
              <User className="w-8 h-8 text-slate-600" />
              <p className="font-semibold text-slate-300">Select a user from the list</p>
              <p className="text-[11px] text-slate-500">
                Select any group member to inspect their completed vs active transactions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal: CLEAR MONEY HISTORY */}
      {showClearConfirm && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400">
                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Clear Money History for {selectedUser.full_name}?
                </h3>
                <p className="text-xs text-slate-400 font-mono">{selectedUser.email}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2 text-slate-300">
              <p>
                This will delete completed settled transactions from the database to tidy up history.
              </p>
              <p className="text-emerald-400 font-semibold text-[11px]">
                🛡️ All pending / unpaid loans ({activeStats?.activeLoansCount || 0}) will NOT be deleted.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmClearHistory}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isProcessing ? 'Clearing...' : 'CLEAR HISTORY'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
