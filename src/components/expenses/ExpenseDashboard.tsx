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
  Tag, 
  Info,
  DollarSign,
  Users,
  Edit3,
  Trash2,
  Clock,
  Check,
  Split,
  HandCoins
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { Profile, PersonalLoan, GroupExpense } from '../../types';
import { AddMoneyConversationalModal } from './AddMoneyConversationalModal';
import { AddGroupExpenseModal } from './AddGroupExpenseModal';
import { TransactionDetailModal } from './TransactionDetailModal';
import { EditGroupExpenseModal } from './EditGroupExpenseModal';
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

  // 2 Standard Tabs: 'active' | 'history'
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  
  // Modals state
  const [showAddConversationalModal, setShowAddConversationalModal] = useState(
    Boolean(preselectedFriendForMoney)
  );
  const [showAddGroupExpenseModal, setShowAddGroupExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<GroupExpense | null>(null);

  // Selected Transaction for Detail Modal
  const [selectedLoan, setSelectedLoan] = useState<PersonalLoan | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<GroupExpense | null>(null);

  // Filters State for Active & History
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'you_owe' | 'others_owe'>('all');
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
  const netBalance = Math.round((othersOweYou - youOwe) * 100) / 100;

  // Actions
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

  const handleDeleteExpense = async (expenseId: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      await appStore.deleteExpense(expenseId);
      showToast('Deleted', `Removed "${title}" from shared money transactions.`, 'info');
    }
  };

  // Active Loans (1-on-1) relevant to current user
  const activeLoans = useMemo(() => {
    return loans.filter(l => 
      (l.lender_id === currentUser.id || l.borrower_id === currentUser.id) &&
      (l.status === 'pending' || l.status === 'payment_claimed')
    );
  }, [loans, currentUser.id]);

  // Active Expenses (Group Splits) relevant to current user
  const activeExpenses = useMemo(() => {
    return expenses.filter(e => {
      const isPayer = e.paid_by === currentUser.id;
      const isParticipant = e.participants.some(p => p.user_id === currentUser.id);
      const hasUnsettledShares = e.participants.some(p => p.status !== 'settled');
      return (isPayer || isParticipant) && hasUnsettledShares;
    });
  }, [expenses, currentUser.id]);

  // Combined Active Transactions filtered by search & activeFilter
  const filteredActiveTransactions = useMemo(() => {
    // 1. Process active loans
    const processedLoans = activeLoans.map(loan => {
      const isLender = loan.lender_id === currentUser.id;
      const otherProfile = appStore.profiles.find(
        p => p.id === (isLender ? loan.borrower_id : loan.lender_id)
      );
      return {
        type: 'loan' as const,
        id: loan.id,
        rawLoan: loan,
        title: loan.reason || 'Personal loan',
        amount: loan.amount,
        category: loan.category || 'Other',
        created_at: loan.created_at,
        isGave: isLender, // true = others owe you, false = you owe
        otherPersonId: isLender ? loan.borrower_id : loan.lender_id,
        otherPersonName: otherProfile?.full_name || 'Friend',
      };
    });

    // 2. Process active expenses
    const processedExpenses = activeExpenses.map(exp => {
      const isPayer = exp.paid_by === currentUser.id;
      const payerProfile = appStore.profiles.find(p => p.id === exp.paid_by);
      const myPart = exp.participants.find(p => p.user_id === currentUser.id);
      return {
        type: 'expense' as const,
        id: exp.id,
        rawExpense: exp,
        title: exp.title || 'Shared bill',
        amount: exp.total_amount,
        category: exp.category || 'Other',
        created_at: exp.created_at,
        isGave: isPayer, // true = you paid & others owe you, false = you owe payer
        otherPersonId: exp.paid_by,
        otherPersonName: isPayer ? 'Group Split' : (payerProfile?.full_name || 'Friend'),
      };
    });

    const combined = [...processedExpenses, ...processedLoans].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return combined.filter(item => {
      // Active direction filter
      if (activeFilter === 'you_owe' && item.isGave) return false;
      if (activeFilter === 'others_owe' && !item.isGave) return false;

      // Friend filter
      if (selectedPerson !== 'all') {
        if (item.type === 'loan') {
          if (item.otherPersonId !== selectedPerson) return false;
        } else {
          const exp = item.rawExpense;
          const involvesFriend = exp.paid_by === selectedPerson || exp.participants.some(p => p.user_id === selectedPerson);
          if (!involvesFriend) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesPerson = item.otherPersonName.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesPerson && !matchesCat) return false;
      }

      return true;
    });
  }, [activeLoans, activeExpenses, currentUser.id, activeFilter, selectedPerson, searchQuery]);

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
      const myPart = exp.participants.find(p => p.user_id === currentUser.id);
      const dateObj = new Date(exp.created_at);
      const monthStr = String(dateObj.getMonth() + 1);
      const yearStr = String(dateObj.getFullYear());

      const allSettled = exp.participants.length > 0 && exp.participants.every(p => p.status === 'settled');

      return {
        type: 'expense' as const,
        id: exp.id,
        rawExpense: exp,
        title: exp.title,
        amount: exp.total_amount,
        category: exp.category,
        created_at: exp.created_at,
        paid_at: allSettled ? exp.created_at : undefined,
        status: allSettled ? ('paid' as const) : ('pending' as const),
        isGave: isPayer,
        myShareAmount: myPart?.share_amount || 0,
        otherPersonId: exp.paid_by,
        otherPersonName: isPayer ? 'Group Split' : (payerProfile?.full_name || 'Friend'),
        otherPersonAvatar: isPayer ? undefined : payerProfile?.avatar_url,
        month: monthStr,
        year: yearStr,
        allSettled
      };
    });

    const combined = [...processedLoans, ...processedExpenses].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return combined.filter(item => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesPerson = item.otherPersonName.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesPerson && !matchesCat) {
          return false;
        }
      }

      // Person Filter
      if (selectedPerson !== 'all') {
        if (item.type === 'loan') {
          if (item.otherPersonId !== selectedPerson) return false;
        } else {
          const exp = item.rawExpense;
          const involvesFriend = exp.paid_by === selectedPerson || exp.participants.some(p => p.user_id === selectedPerson);
          if (!involvesFriend) return false;
        }
      }

      // Month & Year Filter
      if (selectedMonth !== 'all' && item.month !== selectedMonth) return false;
      if (selectedYear !== 'all' && item.year !== selectedYear) return false;

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

  // Render shared split transaction card
  const renderSplitCard = (exp: GroupExpense) => {
    const paidByMe = exp.paid_by === currentUser.id;
    const payer = appStore.profiles.find(p => p.id === exp.paid_by);
    const payerName = payer?.full_name.split(' ')[0] || 'Friend';
    const myPart = exp.participants.find(p => p.user_id === currentUser.id);
    const isSettled = exp.participants.every(p => p.status === 'settled');

    return (
      <div
        key={exp.id}
        className={`p-4 rounded-2xl bg-slate-900 border transition-all shadow-md space-y-3.5 ${
          isSettled 
            ? 'border-slate-800 opacity-90' 
            : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div 
            onClick={() => setSelectedExpense(exp)}
            className="cursor-pointer flex-1"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">🍕</span>
              <h4 className="text-xs font-bold text-white hover:text-amber-400 transition-colors">
                {exp.title}
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                {exp.category}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/60">
                Group Split
              </span>
              {isSettled ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Fully Settled
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800 text-amber-400 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Active
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-1">
              Total: <strong className="text-white">₹{exp.total_amount}</strong> • Paid by{' '}
              <strong className={paidByMe ? 'text-amber-400' : 'text-slate-300'}>
                {paidByMe ? 'You' : payerName}
              </strong> • {formatDateDisplay(exp.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-black text-amber-400">
              ₹{exp.total_amount}
            </span>

            {paidByMe && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingExpense(exp)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
                  title="Edit Split"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteExpense(exp.id, exp.title)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-xs transition-colors"
                  title="Delete Split"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={() => setSelectedExpense(exp)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              title="View Details"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Participant Perspective Summary */}
        {!paidByMe && myPart && (
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 flex items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-300 font-medium">Your Share:</span>{' '}
              <strong className="text-white">₹{myPart.share_amount}</strong>
              <span className="text-slate-400 text-[11px] ml-2">
                (You owe {payerName} ₹{myPart.share_amount})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {myPart.status === 'settled' ? (
                <span className="text-emerald-400 font-bold text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                </span>
              ) : myPart.status === 'payment_claimed' ? (
                <span className="text-amber-300 font-medium text-xs px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 animate-pulse" /> Awaiting {payerName}'s confirmation
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  {payer && (
                    <button
                      onClick={() => onOpenPaymentQR(payer)}
                      className="p-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-400 border border-indigo-800 text-xs font-bold"
                      title="Pay via UPI QR"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleClaimExpenseShare(exp.id, payerName)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all active:scale-95 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>I've Paid ₹{myPart.share_amount}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Participants Breakdown */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3 h-3 text-indigo-400" />
            <span>Participants ({exp.participants.length})</span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {exp.participants.map(part => {
              const pProfile = appStore.profiles.find(p => p.id === part.user_id);
              const pName = pProfile?.full_name.split(' ')[0] || 'Friend';
              const isPartSettled = part.status === 'settled';
              const isPartClaimed = part.status === 'payment_claimed';
              const isMe = part.user_id === currentUser.id;

              return (
                <div
                  key={part.user_id}
                  className="text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={pProfile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover shrink-0"
                    />
                    <span className="text-slate-300 font-medium truncate">
                      {isMe ? 'You' : pName}: <strong className="text-white">₹{part.share_amount}</strong>
                    </span>
                  </div>

                  <div className="shrink-0">
                    {isPartSettled ? (
                      <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-0.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
                        <Check className="w-3 h-3" /> Paid
                      </span>
                    ) : isPartClaimed ? (
                      paidByMe ? (
                        <div className="flex items-center gap-1">
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
                      ) : (
                        <span className="text-amber-400 font-medium text-[10px] px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                          Claimed
                        </span>
                      )
                    ) : paidByMe ? (
                      <button
                        onClick={() => handleConfirmExpenseShare(exp.id, part.user_id, pName)}
                        className="px-2 py-0.5 rounded bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-[10px]"
                      >
                        Mark Paid
                      </button>
                    ) : (
                      <span className="text-slate-400 font-medium text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render 1-on-1 personal debt transaction card
  const renderLoanCard = (loan: PersonalLoan) => {
    const isLender = loan.lender_id === currentUser.id;
    const otherProfile = appStore.profiles.find(
      p => p.id === (isLender ? loan.borrower_id : loan.lender_id)
    );
    const otherName = otherProfile?.full_name.split(' ')[0] || 'Friend';
    const otherFullName = otherProfile?.full_name || 'Friend';
    const isClaimed = loan.status === 'payment_claimed';
    const isPaid = loan.status === 'paid';

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
            <img
              src={otherProfile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
              alt={otherFullName}
              className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-black text-white">{otherFullName}</span>
                <span className="text-sm font-black text-emerald-400">₹{loan.amount}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
                  {loan.category || 'Other'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/60">
                  1-on-1
                </span>
                {isPaid ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Paid
                  </span>
                ) : isClaimed ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> ⏳ Claimed
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-800 text-rose-300 font-bold flex items-center gap-1">
                    🔴 Unpaid
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-300 mt-1">
                {isLender ? (
                  <span className="text-emerald-300">You paid for {otherName}</span>
                ) : (
                  <span className="text-amber-300">{otherName} paid for you</span>
                )}
                <span className="text-slate-400 font-normal"> • Reason: <strong className="text-slate-200">{loan.reason || 'Expense'}</strong> • {formatDateDisplay(loan.created_at)}</span>
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

        {/* Action Controls */}
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
                <span>Mark Paid</span>
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
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24 md:pb-12">
      {/* Top Header with Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <span>Money & Expenses 💰</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real shared group splits, personal debts, and payment tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddConversationalModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Record Money / Split</span>
          </button>
        </div>
      </div>

      {/* Main Balance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-100 shadow-xl">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
            <span>You Owe</span>
          </p>
          <p className="text-xl sm:text-2xl font-black text-rose-400">₹{youOwe}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-100 shadow-xl">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            <span>Others Owe You</span>
          </p>
          <p className="text-xl sm:text-2xl font-black text-emerald-400">₹{othersOweYou}</p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-100 shadow-xl">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5 text-indigo-400" />
            <span>Net Position</span>
          </p>
          <p className={`text-xl sm:text-2xl font-black ${netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netBalance >= 0 ? `+₹${netBalance}` : `-₹${Math.abs(netBalance)}`}
          </p>
        </div>
      </div>

      {/* Navigation Tabs (Active | History) */}
      <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'active'
              ? 'bg-slate-800 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span>Active Transactions ({activeLoans.length + activeExpenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History ({loans.length + expenses.length})</span>
        </button>
      </div>

      {/* ==================== ACTIVE VIEW ==================== */}
      {activeTab === 'active' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Quick Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900/80 border border-slate-800 rounded-2xl">
            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Active ({activeLoans.length + activeExpenses.length})
              </button>
              <button
                onClick={() => setActiveFilter('others_owe')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  activeFilter === 'others_owe'
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Others Owe You
              </button>
              <button
                onClick={() => setActiveFilter('you_owe')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  activeFilter === 'you_owe'
                    ? 'bg-rose-950/80 text-rose-400 border border-rose-800'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                You Owe
              </button>
            </div>

            {/* Friend Filter */}
            <div className="flex items-center gap-2">
              <select
                value={selectedPerson}
                onChange={e => setSelectedPerson(e.target.value)}
                className="p-1.5 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Friends</option>
                {appStore.profiles
                  .filter(p => p.id !== currentUser.id)
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search active transactions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Combined Active List */}
          {filteredActiveTransactions.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 text-xs space-y-2">
              <p className="text-sm font-bold text-white">All settled up! 🚀</p>
              <p className="text-slate-400">No active pending debts or split bills matching your filter.</p>
              <button
                onClick={() => setShowAddConversationalModal(true)}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Record New Money</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActiveTransactions.map(item => {
                if (item.type === 'expense') {
                  return renderSplitCard(item.rawExpense);
                } else {
                  return renderLoanCard(item.rawLoan);
                }
              })}
            </div>
          )}
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
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title, friend name, category..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Filter Selects Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Person Filter */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Friend</label>
                <select
                  value={selectedPerson}
                  onChange={e => setSelectedPerson(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Friends</option>
                  {appStore.profiles
                    .filter(p => p.id !== currentUser.id)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                </select>
              </div>

              {/* Month Filter */}
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Month</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Months</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={String(m)}>
                      {new Date(2025, m - 1).toLocaleString('default', { month: 'short' })}
                    </option>
                  ))}
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
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800">
                              {item.type === 'expense' ? 'Group Split' : '1-on-1'}
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

      {/* Edit Group Split Modal */}
      <EditGroupExpenseModal
        isOpen={Boolean(editingExpense)}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
      />

      {/* Add Money / Split Modal */}
      <AddMoneyConversationalModal
        isOpen={showAddConversationalModal}
        onClose={() => setShowAddConversationalModal(false)}
        preselectedFriend={preselectedFriendForMoney}
      />

      {/* Add Split Bill Modal */}
      <AddGroupExpenseModal
        isOpen={showAddGroupExpenseModal}
        onClose={() => setShowAddGroupExpenseModal(false)}
      />
    </div>
  );
};
