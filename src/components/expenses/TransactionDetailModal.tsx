import React, { useState } from 'react';
import { X, Calendar, Tag, User, CheckCircle2, Clock, DollarSign, Users, QrCode, Trash2, Edit3 } from 'lucide-react';
import { GroupExpense, PersonalLoan, Profile } from '../../types';
import { appStore } from '../../lib/store';
import { EditGroupExpenseModal } from './EditGroupExpenseModal';
import { EditPersonalLoanModal } from './EditPersonalLoanModal';
import { useToast } from '../ui/Toast';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan?: PersonalLoan | null;
  expense?: GroupExpense | null;
  onOpenPaymentQR?: (friend: Profile) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  loan,
  expense,
  onOpenPaymentQR
}) => {
  const { showToast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditLoanOpen, setIsEditLoanOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || (!loan && !expense)) return null;

  const currentUser = appStore.currentUser;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const handleDeleteExpense = async () => {
    if (!expense) return;
    if (!window.confirm(`Are you sure you want to delete "${expense.title}"? This cannot be undone.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await appStore.deleteExpense(expense.id);
      showToast('Split Deleted', 'Expense has been removed.', 'success');
      onClose();
    } catch (err) {
      showToast('Delete Failed', 'Could not delete expense', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteLoan = async () => {
    if (!loan) return;
    if (!window.confirm(`Are you sure you want to delete this loan record? This cannot be undone.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await appStore.deletePersonalLoan(loan.id);
      showToast('Loan Deleted', 'Loan record has been removed.', 'success');
      onClose();
    } catch (err) {
      showToast('Delete Failed', 'Could not delete loan', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loan) {
    const freshLoan = appStore.loans.find(l => l.id === loan.id) || loan;
    const isLender = freshLoan.lender_id === currentUser.id;
    const lender = freshLoan.lender_profile || appStore.profiles.find(p => p.id === freshLoan.lender_id);
    const borrower = freshLoan.borrower_profile || appStore.profiles.find(p => p.id === freshLoan.borrower_id);
    const isPaid = freshLoan.status === 'paid';
    const isClaimed = freshLoan.status === 'payment_claimed';

    const handleConfirmPayment = async () => {
      await appStore.confirmLoanPayment(freshLoan.id);
      onClose();
    };

    const handleRejectClaim = async () => {
      await appStore.rejectLoanPaymentClaim(freshLoan.id);
      onClose();
    };

    const handleClaimPayment = async () => {
      await appStore.claimLoanPayment(freshLoan.id);
      onClose();
    };

    return (
      <>
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">💰</span>
                <h3 className="text-base font-black text-white">Loan Transaction Details</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {!isPaid && (
                  <button
                    type="button"
                    onClick={() => setIsEditLoanOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-semibold px-2.5"
                    title="Edit Transaction"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Status Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              isPaid 
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
                : isClaimed
                  ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-center gap-2.5">
                {isPaid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : isClaimed ? (
                  <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
                ) : (
                  <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-bold">
                    {isPaid 
                      ? '✅ Completed & Paid' 
                      : isClaimed 
                        ? '⏳ Payment Claimed (Awaiting Approval)' 
                        : '🔴 Unpaid (Pending)'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {isLender ? `You paid for ${borrower?.full_name || 'friend'}` : `${lender?.full_name || 'Friend'} paid for you`} • {freshLoan.reason}
                  </p>
                </div>
              </div>
              <span className="text-xl font-black text-white">₹{freshLoan.amount}</span>
            </div>

            {/* Details */}
            <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Lender (Gave money)</span>
                </span>
                <div className="flex items-center gap-2">
                  <img
                    src={lender?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                    alt={lender?.full_name}
                    className="w-5 h-5 rounded-full object-cover border border-slate-700"
                  />
                  <span className="font-bold text-white">
                    {lender?.full_name} {isLender && '(You)'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-rose-400" />
                  <span>Borrower (Owes money)</span>
                </span>
                <div className="flex items-center gap-2">
                  <img
                    src={borrower?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                    alt={borrower?.full_name}
                    className="w-5 h-5 rounded-full object-cover border border-slate-700"
                  />
                  <span className="font-bold text-white">
                    {borrower?.full_name} {freshLoan.borrower_id === currentUser.id && '(You)'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>Category</span>
                </span>
                <span className="font-medium text-slate-200">{freshLoan.category}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Created At</span>
                </span>
                <span className="font-medium text-slate-300">{formatDate(freshLoan.created_at)}</span>
              </div>

              {freshLoan.claimed_at && (
                <div className="flex items-center justify-between py-1 text-amber-300">
                  <span>Claimed At</span>
                  <span>{formatDate(freshLoan.claimed_at)}</span>
                </div>
              )}

              {freshLoan.paid_at && (
                <div className="flex items-center justify-between py-1 text-emerald-400">
                  <span>Paid / Settled At</span>
                  <span>{formatDate(freshLoan.paid_at)}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              {!isPaid && (
                <>
                  {isClaimed ? (
                    isLender ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleConfirmPayment}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm Paid</span>
                        </button>
                        <button
                          onClick={handleRejectClaim}
                          className="w-full py-2.5 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <X className="w-4 h-4" />
                          <span>Reject Claim</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-center">
                        <p className="text-xs font-bold text-amber-300">
                          Payment claimed! Waiting for {lender?.full_name.split(' ')[0]} to approve.
                        </p>
                      </div>
                    )
                  ) : (
                    freshLoan.borrower_id === currentUser.id ? (
                      <div className="space-y-2">
                        {lender && onOpenPaymentQR && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenPaymentQR(lender);
                            }}
                            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>Pay via UPI / QR</span>
                          </button>
                        )}
                        <button
                          onClick={handleClaimPayment}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>I have paid ₹{freshLoan.amount}</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleConfirmPayment}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark Paid Directly</span>
                      </button>
                    )
                  )}
                </>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleDeleteLoan}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg flex items-center gap-1 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Record</span>
                </button>

                <div className="flex items-center gap-2">
                  {!isPaid && (
                    <button
                      type="button"
                      onClick={() => setIsEditLoanOpen(true)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <EditPersonalLoanModal
          isOpen={isEditLoanOpen}
          onClose={() => setIsEditLoanOpen(false)}
          loan={freshLoan}
        />
      </>
    );
  }

  if (expense) {
    const paidByMe = expense.paid_by === currentUser.id;
    const payer = expense.payer_profile || appStore.profiles.find(p => p.id === expense.paid_by);
    const allSettled = expense.participants.every(p => p.status === 'settled');

    // Get current expense from store to keep fresh
    const freshExpense = appStore.expenses.find(e => e.id === expense.id) || expense;

    return (
      <>
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍕</span>
                <h3 className="text-base font-black text-white">Group Split Details</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              allSettled 
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
                : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
            }`}>
              <div className="flex items-center gap-2.5">
                {allSettled ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-bold">
                    {allSettled ? 'All Shares Settled' : 'Active Split'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {freshExpense.title} • {freshExpense.category}
                  </p>
                </div>
              </div>
              <span className="text-lg font-black text-amber-400">₹{freshExpense.total_amount}</span>
            </div>

            {/* Main Info */}
            <div className="space-y-2 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Payer</span>
                <div className="flex items-center gap-2">
                  <img
                    src={payer?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                    alt={payer?.full_name}
                    className="w-5 h-5 rounded-full object-cover border border-slate-700"
                  />
                  <span className="font-bold text-white">
                    {payer?.full_name} {paidByMe && '(You)'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Date</span>
                <span className="text-slate-300 font-medium">{formatDate(freshExpense.created_at)}</span>
              </div>
            </div>

            {/* Participants Breakdown Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Participant Breakdown ({freshExpense.participants.length})</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Sum: ₹{freshExpense.participants.reduce((s, p) => s + (p.share_amount || 0), 0)}
                </span>
              </h4>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {freshExpense.participants.map(part => {
                  const member = appStore.profiles.find(p => p.id === part.user_id);
                  const isSettled = part.status === 'settled';
                  const isClaimed = part.status === 'payment_claimed';
                  const isMe = part.user_id === currentUser.id;

                  const handleConfirmShare = async () => {
                    await appStore.confirmExpenseShare(freshExpense.id, part.user_id);
                  };

                  const handleRejectShare = async () => {
                    await appStore.rejectExpenseShareClaim(freshExpense.id, part.user_id);
                  };

                  const handleClaimShare = async () => {
                    await appStore.claimExpenseShare(freshExpense.id);
                  };

                  return (
                    <div
                      key={part.user_id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={member?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                          alt={member?.full_name}
                          className="w-7 h-7 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <p className="font-bold text-white">
                            {member?.full_name} {isMe && '(You)'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Share: ₹{part.share_amount}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSettled ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Paid
                          </span>
                        ) : isClaimed ? (
                          paidByMe ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={handleConfirmShare}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={handleRejectShare}
                                className="px-2 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-[10px]"
                              >
                                Reject
                              </button>
                            </div>
                          ) : isMe ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-300 font-medium text-[10px] flex items-center gap-1">
                              <Clock className="w-3 h-3 animate-pulse" /> Awaiting Confirm
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-400 font-bold text-[10px]">
                              Claimed
                            </span>
                          )
                        ) : isMe && !paidByMe ? (
                          <button
                            onClick={handleClaimShare}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow active:scale-95 transition-all"
                          >
                            I've Paid ₹{part.share_amount}
                          </button>
                        ) : paidByMe ? (
                          <button
                            onClick={handleConfirmShare}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition-colors"
                          >
                            Mark Settled
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-bold text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Split</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteExpense}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-xl flex items-center gap-1 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Split</span>
                </button>
              </div>

              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {isEditOpen && (
          <EditGroupExpenseModal
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            expense={freshExpense}
          />
        )}
      </>
    );
  }

  return null;
};
