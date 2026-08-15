import React from 'react';
import { X, Calendar, Tag, User, CheckCircle2, Clock, DollarSign, Users, QrCode } from 'lucide-react';
import { GroupExpense, PersonalLoan, Profile } from '../../types';
import { appStore } from '../../lib/store';

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

  if (loan) {
    const isLender = loan.lender_id === currentUser.id;
    const lender = loan.lender_profile || appStore.profiles.find(p => p.id === loan.lender_id);
    const borrower = loan.borrower_profile || appStore.profiles.find(p => p.id === loan.borrower_id);
    const isPaid = loan.status === 'paid';
    const isClaimed = loan.status === 'payment_claimed';

    const handleConfirmPayment = async () => {
      await appStore.confirmLoanPayment(loan.id);
      onClose();
    };

    const handleRejectClaim = async () => {
      await appStore.rejectLoanPaymentClaim(loan.id);
      onClose();
    };

    const handleClaimPayment = async () => {
      await appStore.claimLoanPayment(loan.id);
      onClose();
    };

    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <h3 className="text-base font-black text-white">Loan Transaction Details</h3>
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
                    ? 'Completed & Paid' 
                    : isClaimed 
                      ? 'Payment Claimed (Pending Confirmation)' 
                      : 'Active Pending Payment'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {isPaid 
                    ? `Settled on ${formatDate(loan.paid_at || loan.created_at)}` 
                    : isClaimed
                      ? `Borrower claimed payment on ${formatDate(loan.claimed_at)}`
                      : 'Awaiting settlement payment'}
                </p>
              </div>
            </div>
            <span className="text-lg font-black text-white">₹{loan.amount}</span>
          </div>

          {/* Detail Rows */}
          <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" /> Reason / Purpose
              </span>
              <span className="font-bold text-white">{loan.reason || 'General Loan'}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Category
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-300 font-semibold text-[11px]">
                {loan.category || 'Other'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" /> Paid By / Lender
              </span>
              <div className="flex items-center gap-2">
                <img
                  src={lender?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}
                  alt={lender?.full_name}
                  className="w-5 h-5 rounded-full object-cover border border-slate-700"
                />
                <span className="font-bold text-white">
                  {lender?.full_name} {loan.lender_id === currentUser.id && '(You)'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-rose-400" /> Borrower / Receiver
              </span>
              <div className="flex items-center gap-2">
                <img
                  src={borrower?.avatar_url || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100&q=80'}
                  alt={borrower?.full_name}
                  className="w-5 h-5 rounded-full object-cover border border-slate-700"
                />
                <span className="font-bold text-white">
                  {borrower?.full_name} {loan.borrower_id === currentUser.id && '(You)'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Date Created
              </span>
              <span className="text-slate-300 font-medium">{formatDate(loan.created_at)}</span>
            </div>

            {isClaimed && loan.claimed_at && (
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Claimed Date
                </span>
                <span className="text-amber-400 font-bold">{formatDate(loan.claimed_at)}</span>
              </div>
            )}

            {isPaid && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Settled / Paid Date
                </span>
                <span className="text-emerald-400 font-bold">{formatDate(loan.paid_at || loan.created_at)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {isLender && !isPaid && (
              isClaimed ? (
                <>
                  <button
                    onClick={handleRejectClaim}
                    className="px-3 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs rounded-xl"
                  >
                    Reject Claim
                  </button>
                  <button
                    onClick={handleConfirmPayment}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Received</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConfirmPayment}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark as Paid</span>
                </button>
              )
            )}

            {!isLender && !isPaid && (
              <>
                {!isClaimed && (
                  <button
                    onClick={handleClaimPayment}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>I've Paid ₹{loan.amount}</span>
                  </button>
                )}
                {lender && onOpenPaymentQR && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenPaymentQR(lender);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Pay via UPI QR</span>
                  </button>
                )}
              </>
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
    );
  }

  if (expense) {
    const paidByMe = expense.paid_by === currentUser.id;
    const payer = expense.payer_profile || appStore.profiles.find(p => p.id === expense.paid_by);
    const allSettled = expense.participants.every(p => p.status === 'settled');

    return (
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
                  {allSettled ? 'All Shares Settled' : 'Pending Member Shares'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {expense.title} • {expense.category}
                </p>
              </div>
            </div>
            <span className="text-lg font-black text-amber-400">₹{expense.total_amount}</span>
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
              <span className="text-slate-300 font-medium">{formatDate(expense.created_at)}</span>
            </div>
          </div>

          {/* Participants Breakdown Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Participant Breakdown ({expense.participants.length})</span>
            </h4>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {expense.participants.map(part => {
                const member = appStore.profiles.find(p => p.id === part.user_id);
                const memberName = member?.full_name.split(' ')[0] || 'Friend';
                const isSettled = part.status === 'settled';
                const isClaimed = part.status === 'payment_claimed';
                const isMe = part.user_id === currentUser.id;

                const handleConfirmShare = async () => {
                  await appStore.confirmExpenseShare(expense.id, part.user_id);
                };

                const handleRejectShare = async () => {
                  await appStore.rejectExpenseShareClaim(expense.id, part.user_id);
                };

                const handleClaimShare = async () => {
                  await appStore.claimExpenseShare(expense.id);
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

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
