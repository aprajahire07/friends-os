import React, { useState, useMemo } from 'react';
import { 
  Wallet, 
  Plus, 
  CheckCircle2, 
  QrCode, 
  History, 
  Zap, 
  Filter, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  User, 
  Tag, 
  Info,
  DollarSign
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { Profile, PersonalLoan, GroupExpense } from '../../types';
import { AddMoneyConversationalModal } from './AddMoneyConversationalModal';
import { TransactionDetailModal } from './TransactionDetailModal';
import { useToast } from '../ui/Toast';

interface ExpenseDashboardProps {
  onOpenPaymentQR: (friend: Profile) => void;
  preselectedFriendForMoney?: Profile | null;
}

export const ExpenseDashboard: React.FC<ExpenseDashboardProps> = ({
  onOpenPaymentQR,
  preselectedFriendForMoney,
}) => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(
    Boolean(preselectedFriendForMoney)
  );

  // Selected Transaction for Detail Modal
  const [selectedLoan, setSelectedLoan] = useState<PersonalLoan | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<GroupExpense | null>(null);

  // Filters State for History
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFlow, setSelectedFlow] = useState<'all' | 'gave' | 'received'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'paid' | 'pending'>('all');

  const loans = store.loans;
  const expenses = store.expenses;

  // Active Pending Calculations
  const loanOthersOweYou = loans
    .filter(l => l.lender_id === currentUser.id && l.status !== 'paid')
    .reduce((sum, l) => sum + l.amount, 0);

  const loanYouOwe = loans
    .filter(l => l.borrower_id === currentUser.id && l.status !== 'paid')
    .reduce((sum, l) => sum + l.amount, 0);

  const groupOthersOweYou = expenses
    .filter(e => e.paid_by === currentUser.id)
    .reduce((sum, e) => {
      const pendingShares = e.participants
        .filter(p => p.user_id !== currentUser.id && p.status !== 'settled')
        .reduce((pSum, p) => pSum + p.share_amount, 0);
      return sum + pendingShares;
    }, 0);

  const groupYouOwe = expenses
    .filter(e => e.paid_by !== currentUser.id)
    .reduce((sum, e) => {
      const myShare = e.participants.find(p => p.user_id === currentUser.id && p.status !== 'settled');
      return sum + (myShare ? myShare.share_amount : 0);
    }, 0);

  const othersOweYou = Math.round((loanOthersOweYou + groupOthersOweYou) * 100) / 100;
  const youOwe = Math.round((loanYouOwe + groupYouOwe) * 100) / 100;

  const handleClaimLoanPayment = async (loanId: string, lenderName: string) => {
    await appStore.claimLoanPayment(loanId);
    showToast('Payment Claimed 💰', `Notified ${lenderName} to verify and confirm receipt!`, 'info');
  };

  const handleConfirmLoanPayment = async (loanId: string, borrowerName: string) => {
    await appStore.confirmLoanPayment(loanId);
    showToast('Payment Confirmed ✅', `Settled loan with ${borrowerName}! Moved to History.`, 'success');
  };

  const handleRejectLoanPayment = async (loanId: string, borrowerName: string) => {
    await appStore.rejectLoanPaymentClaim(loanId);
    showToast('Claim Rejected ❌', `Notified ${borrowerName} that payment was not received.`, 'error');
  };

  const handleClaimExpenseShare = async (expenseId: string, payerName: string) => {
    await appStore.claimExpenseShare(expenseId);
    showToast('Share Claimed 💰', `Notified ${payerName} to confirm your split share!`, 'info');
  };

  const handleConfirmExpenseShare = async (expenseId: string, userId: string, memberName: string) => {
    await appStore.confirmExpenseShare(expenseId, userId);
    showToast('Share Confirmed ✅', `Confirmed ${memberName}'s payment share.`, 'success');
  };

  const handleRejectExpenseShare = async (expenseId: string, userId: string, memberName: string) => {
    await appStore.rejectExpenseShareClaim(expenseId, userId);
    showToast('Share Rejected ❌', `Rejected payment claim for ${memberName}.`, 'error');
  };

  // Active Loans & Active Expenses
  const activeLoans = loans.filter(l => l.status === 'pending' || l.status === 'payment_claimed');
  const activeExpenses = expenses.filter(e => e.participants.some(p => p.status !== 'settled'));

  // Filtering for History View
  const filteredHistory = useMemo(() => {
    // 1. Process Loans
    const processedLoans = loans.map(loan => {
      const isLender = loan.lender_id === currentUser.id;
      const otherProfile = appStore.profiles.find(
        p => p.id === (isLender ? loan.borrower_id : loan.lender_id)
      );
      const dateObj = new Date(loan.created_at);
      const monthStr = String(dateObj.getMonth() + 1);
      const yearStr = String(dateObj.getFullYear());

      return {
        type: 'loan' as const,
        id: loan.id,
        rawLoan: loan,
        title: loan.reason || 'Personal Loan',
        amount: loan.amount,
        category: loan.category || 'Other',
        created_at: loan.created_at,
        paid_at: loan.paid_at,
        status: loan.status,
        isGave: isLender,
        otherPersonId: isLender ? loan.borrower_id : loan.lender_id,
        otherPersonName: otherProfile?.full_name || 'Friend',
        otherPersonAvatar: otherProfile?.avatar_url,
        month: monthStr,
        year: yearStr
      };
    });

    // 2. Process Expenses
    const processedExpenses = expenses.map(exp => {
      const isPayer = exp.paid_by === currentUser.id;
      const payerProfile = appStore.profiles.find(p => p.id === exp.paid_by);
      const myShare = exp.participants.find(p => p.user_id === currentUser.id);
      const allSettled = exp.participants.every(p => p.status === 'settled');
      const dateObj = new Date(exp.created_at);
      const monthStr = String(dateObj.getMonth() + 1);
      const yearStr = String(dateObj.getFullYear());

      return {
        type: 'expense' as const,
        id: exp.id,
        rawExpense: exp,
        title: exp.title,
        amount: exp.total_amount,
        myShareAmount: myShare?.share_amount || 0,
        category: exp.category || 'Food',
        created_at: exp.created_at,
        paid_at: exp.created_at,
        status: allSettled ? ('paid' as const) : ('pending' as const),
        isGave: isPayer,
        otherPersonId: exp.paid_by,
        otherPersonName: payerProfile?.full_name || 'Friend',
        otherPersonAvatar: payerProfile?.avatar_url,
        month: monthStr,
        year: yearStr,
        allSettled
      };
    });

    const combined = [...processedLoans, ...processedExpenses];

    return combined.filter(item => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchPerson = item.otherPersonName.toLowerCase().includes(q);
        const matchCategory = item.category.toLowerCase().includes(q);
        if (!matchTitle && !matchPerson && !matchCategory) return false;
      }

      // Person Filter
      if (selectedPerson !== 'all') {
        if (item.type === 'loan') {
          if (item.rawLoan.lender_id !== selectedPerson && item.rawLoan.borrower_id !== selectedPerson) {
            return false;
          }
        } else {
          const isParticipant = item.rawExpense.participants.some(p => p.user_id === selectedPerson);
          const isPayer = item.rawExpense.paid_by === selectedPerson;
          if (!isParticipant && !isPayer) return false;
        }
      }

      // Month Filter
      if (selectedMonth !== 'all' && item.month !== selectedMonth) {
        return false;
      }

      // Year Filter
      if (selectedYear !== 'all' && item.year !== selectedYear) {
        return false;
      }

      // Category Filter
      if (selectedCategory !== 'all') {
        if (item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // Flow Filter (Money I Gave vs Received)
      if (selectedFlow === 'gave' && !item.isGave) return false;
      if (selectedFlow === 'received' && item.isGave) return false;

      // Status Filter
      if (selectedStatus === 'paid' && item.status !== 'paid') return false;
      if (selectedStatus === 'pending' && item.status !== 'pending') return false;

      return true;
    });
  }, [loans, expenses, currentUser.id, searchQuery, selectedPerson, selectedMonth, selectedYear, selectedCategory, selectedFlow, selectedStatus]);

  // Summary Metrics for Filtered History
  const historySummary = useMemo(() => {
    let totalGiven = 0;
    let totalReceived = 0;
    let totalCompleted = 0;

    filteredHistory.forEach(item => {
      if (item.type === 'loan') {
        if (item.isGave) {
          totalGiven += item.amount;
        } else {
          totalReceived += item.amount;
        }
        if (item.status === 'paid') {
          totalCompleted += item.amount;
        }
      } else {
        if (item.isGave) {
          totalGiven += item.amount;
        } else {
          totalReceived += item.myShareAmount;
        }
        if (item.allSettled) {
          totalCompleted += item.amount;
        }
      }
    });

    return {
      totalGiven: Math.round(totalGiven * 100) / 100,
      totalReceived: Math.round(totalReceived * 100) / 100,
      totalCompleted: Math.round(totalCompleted * 100) / 100
    };
  }, [filteredHistory]);

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <span>Money & Expenses 💰</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Active balances, personal loans, group splits, and complete history.
          </p>
        </div>

        <button
          onClick={() => setShowAddMoneyModal(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Add Money</span>
        </button>
      </div>

      {/* Navigation Tabs: Active vs Complete History */}
      <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'active'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Active Debts ({activeLoans.length + activeExpenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Complete History ({loans.length + expenses.length})</span>
        </button>
      </div>

      {/* ==================== ACTIVE VIEW ==================== */}
      {activeTab === 'active' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Main Balance Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-xl">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
                <span>You Owe</span>
              </p>
              <p className="text-2xl font-black text-rose-400">₹{youOwe}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-xl">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                <span>Others Owe You</span>
              </p>
              <p className="text-2xl font-black text-emerald-400">₹{othersOweYou}</p>
            </div>
          </div>

          {/* Active List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Pending Transactions
            </h3>

            {activeLoans.length === 0 && activeExpenses.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 text-xs space-y-2">
                <p className="text-sm font-bold text-white">No active debts 🚀</p>
                <p className="text-slate-400">All loans and splits are fully settled. Check History for past records.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Active Personal Loans */}
                {activeLoans.map(loan => {
                  const isLender = loan.lender_id === currentUser.id;
                  const otherProfile = appStore.profiles.find(
                    p => p.id === (isLender ? loan.borrower_id : loan.lender_id)
                  );
                  const otherName = otherProfile?.full_name.split(' ')[0] || 'Friend';
                  const isClaimed = loan.status === 'payment_claimed';

                  return (
                    <div
                      key={loan.id}
                      className={`p-4 rounded-2xl bg-slate-900 border transition-all shadow-md space-y-3 ${
                        isClaimed
                          ? isLender
                            ? 'border-amber-500/70 bg-amber-950/20'
                            : 'border-indigo-500/50 bg-indigo-950/20'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div 
                          onClick={() => setSelectedLoan(loan)}
                          className="flex items-center gap-3 cursor-pointer flex-1"
                        >
                          <div className={`w-3 h-3 rounded-full shrink-0 ${isLender ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          <div>
                            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                              {isLender ? (
                                <span className="text-rose-400">🔴 {otherName} owes you ₹{loan.amount}</span>
                              ) : (
                                <span className="text-amber-400">🔴 You owe {otherName} ₹{loan.amount}</span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
                                {loan.category || 'Loan'}
                              </span>
                              {isClaimed && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                                  ⏳ Payment Claimed
                                </span>
                              )}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {loan.reason || 'Personal loan'} • {formatDateDisplay(loan.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!isLender && otherProfile && (
                            <button
                              onClick={() => onOpenPaymentQR(otherProfile)}
                              className="p-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-400 border border-indigo-800 text-xs font-bold transition-colors"
                              title="View Payment QR"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedLoan(loan)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                            title="View Details"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Action Controls & Confirmation Box */}
                      {isLender ? (
                        isClaimed ? (
                          <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-between gap-2">
                            <div className="text-[11px] text-amber-200">
                              <span className="font-bold">🔔 {otherName}</span> claims they sent ₹{loan.amount}.
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleConfirmLoanPayment(loan.id, otherName)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Confirm</span>
                              </button>
                              <button
                                onClick={() => handleRejectLoanPayment(loan.id, otherName)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => handleConfirmLoanPayment(loan.id, otherName)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Mark Paid (Direct)</span>
                            </button>
                          </div>
                        )
                      ) : (
                        isClaimed ? (
                          <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-[11px] text-indigo-200 flex items-center justify-between">
                            <span>⏳ You claimed this payment. Waiting for {otherName} to confirm receipt.</span>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 pt-1">
                            {otherProfile && (
                              <button
                                onClick={() => onOpenPaymentQR(otherProfile)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-xs font-bold flex items-center gap-1.5"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span>Pay via QR</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleClaimLoanPayment(loan.id, otherName)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow flex items-center gap-1 active:scale-95 transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>I've Paid ₹{loan.amount}</span>
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}

                {/* Active Group Expenses */}
                {activeExpenses.map(exp => {
                  const paidByMe = exp.paid_by === currentUser.id;
                  const payer = appStore.profiles.find(p => p.id === exp.paid_by);
                  const payerName = payer?.full_name.split(' ')[0] || 'Friend';

                  return (
                    <div
                      key={exp.id}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md"
                    >
                      <div 
                        onClick={() => setSelectedExpense(exp)}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-white flex items-center gap-2">
                            <span>🍕 {exp.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
                              {exp.category}
                            </span>
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Total ₹{exp.total_amount} • Paid by {paidByMe ? 'You' : payerName} • {formatDateDisplay(exp.created_at)}
                          </p>
                        </div>
                        <span className="text-sm font-black text-amber-400">
                          ₹{exp.total_amount}
                        </span>
                      </div>

                      {/* Participant Shares with Claim and Settle Controls */}
                      <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                        {exp.participants.map(part => {
                          const pProfile = appStore.profiles.find(p => p.id === part.user_id);
                          const pName = pProfile?.full_name.split(' ')[0] || 'Friend';
                          const isSettled = part.status === 'settled';
                          const isClaimed = part.status === 'payment_claimed';
                          const isMe = part.user_id === currentUser.id;

                          return (
                            <div
                              key={part.user_id}
                              className="text-[11px] p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <img
                                  src={pProfile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                                  alt=""
                                  className="w-5 h-5 rounded-full object-cover"
                                />
                                <span className="text-slate-300 font-medium">
                                  {isMe ? 'You' : pName}: <strong className="text-white">₹{part.share_amount}</strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {isSettled ? (
                                  <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-0.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
                                    <CheckCircle2 className="w-3 h-3" /> Paid
                                  </span>
                                ) : isClaimed ? (
                                  paidByMe ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-amber-400 font-bold text-[10px]">Claims Paid:</span>
                                      <button
                                        onClick={() => handleConfirmExpenseShare(exp.id, part.user_id, pName)}
                                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => handleRejectExpenseShare(exp.id, part.user_id, pName)}
                                        className="px-2 py-0.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[10px] border border-rose-800"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : isMe ? (
                                    <span className="text-amber-300 font-medium text-[10px] px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                                      ⏳ Awaiting {payerName}'s confirmation
                                    </span>
                                  ) : (
                                    <span className="text-amber-400 font-medium text-[10px]">Claimed</span>
                                  )
                                ) : isMe && !paidByMe ? (
                                  <div className="flex items-center gap-1.5">
                                    {payer && (
                                      <button
                                        onClick={() => onOpenPaymentQR(payer)}
                                        className="p-1 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-400 border border-indigo-800 text-[10px]"
                                        title="Pay via UPI QR"
                                      >
                                        <QrCode className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleClaimExpenseShare(exp.id, payerName)}
                                      className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition-all active:scale-95"
                                    >
                                      I've Paid My ₹{part.share_amount}
                                    </button>
                                  </div>
                                ) : (
                                  paidByMe && (
                                    <button
                                      onClick={() => handleConfirmExpenseShare(exp.id, part.user_id, pName)}
                                      className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition-colors"
                                    >
                                      Mark Settle
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== HISTORY VIEW ==================== */}
      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Stat Cards for History */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                <span>Total Lent/Gave</span>
              </p>
              <p className="text-lg font-black text-emerald-400">₹{historySummary.totalGiven}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3 text-rose-400" />
                <span>Total Borrowed</span>
              </p>
              <p className="text-lg font-black text-rose-400">₹{historySummary.totalReceived}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                <span>Completed Volume</span>
              </p>
              <p className="text-lg font-black text-indigo-400">₹{historySummary.totalCompleted}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800/80">
              <Filter className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white">Filter & Search History</span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search reason, person, title, category..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Dropdown Filters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {/* Person */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Friend</label>
                <select
                  value={selectedPerson}
                  onChange={e => setSelectedPerson(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Friends</option>
                  {appStore.profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} {p.id === currentUser.id && '(You)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Month</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Months</option>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Year</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Years</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Category</label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Categories</option>
                  <option value="Food">Food 🍔</option>
                  <option value="Auto">Auto 🛺</option>
                  <option value="Bus">Bus 🚌</option>
                  <option value="Metro">Metro 🚇</option>
                  <option value="Movie">Movie 🎬</option>
                  <option value="Cash">Cash 💵</option>
                  <option value="Other">Other 📦</option>
                </select>
              </div>

              {/* Direction Flow */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Money Flow</label>
                <select
                  value={selectedFlow}
                  onChange={e => setSelectedFlow(e.target.value as any)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Flows</option>
                  <option value="gave">Money I Gave (Lent)</option>
                  <option value="received">Money I Received (Borrowed)</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Status</label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value as any)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Completed / Paid</option>
                  <option value="pending">Active / Pending</option>
                </select>
              </div>
            </div>
          </div>

          {/* History List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Historical Records ({filteredHistory.length})
              </h3>
              {(searchQuery || selectedPerson !== 'all' || selectedCategory !== 'all' || selectedFlow !== 'all' || selectedStatus !== 'all' || selectedMonth !== 'all' || selectedYear !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedPerson('all');
                    setSelectedMonth('all');
                    setSelectedYear('all');
                    setSelectedCategory('all');
                    setSelectedFlow('all');
                    setSelectedStatus('all');
                  }}
                  className="text-[10px] text-indigo-400 hover:underline font-bold"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 text-xs">
                No matching transactions found with current filters.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredHistory.map(item => {
                  const isPaid = item.status === 'paid';

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => {
                        if (item.type === 'loan') setSelectedLoan(item.rawLoan);
                        else setSelectedExpense(item.rawExpense);
                      }}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow hover:border-slate-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${isPaid ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white">
                              {item.type === 'loan' ? (
                                isPaid ? (
                                  item.isGave ? (
                                    <span className="text-emerald-400">🟢 {item.otherPersonName} paid ₹{item.amount}</span>
                                  ) : (
                                    <span className="text-emerald-400">🟢 You paid {item.otherPersonName} ₹{item.amount}</span>
                                  )
                                ) : (
                                  item.isGave ? (
                                    <span className="text-rose-400">🔴 {item.otherPersonName} owes you ₹{item.amount}</span>
                                  ) : (
                                    <span className="text-amber-400">🔴 You owe {item.otherPersonName} ₹{item.amount}</span>
                                  )
                                )
                              ) : (
                                <span className="text-white">🍕 {item.title}</span>
                              )}
                            </h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              {item.category}
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span>Original: {formatDateDisplay(item.created_at)}</span>
                            {item.paid_at && isPaid && (
                              <span className="text-emerald-400 font-semibold">
                                • Paid: {formatDateDisplay(item.paid_at)}
                              </span>
                            )}
                            {item.type === 'expense' && (
                              <span>• Total: ₹{item.amount}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                          isPaid 
                            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' 
                            : 'bg-amber-950/60 border-amber-800 text-amber-400'
                        }`}>
                          {isPaid ? '✓ Completed' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      <TransactionDetailModal
        isOpen={Boolean(selectedLoan || selectedExpense)}
        onClose={() => {
          setSelectedLoan(null);
          setSelectedExpense(null);
        }}
        loan={selectedLoan}
        expense={selectedExpense}
        onOpenPaymentQR={onOpenPaymentQR}
      />

      <AddMoneyConversationalModal
        isOpen={showAddMoneyModal}
        onClose={() => setShowAddMoneyModal(false)}
        preselectedFriend={preselectedFriendForMoney}
      />
    </div>
  );
};
