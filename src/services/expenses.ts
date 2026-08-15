import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { GroupExpense, PersonalLoan, ExpenseParticipant } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id?: string | null): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

export async function fetchExpensesFromSupabase(): Promise<GroupExpense[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    // 1. Fetch expenses
    const { data: expRows, error: expErr } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (expErr) {
      console.warn('Supabase fetchExpenses error:', expErr.message);
      return null;
    }

    if (!expRows || expRows.length === 0) {
      return [];
    }

    // 2. Fetch all expense participants
    const expenseIds = expRows.map(e => e.id);
    const { data: partRows, error: partErr } = await supabase
      .from('expense_participants')
      .select('*')
      .in('expense_id', expenseIds);

    if (partErr) {
      console.warn('Supabase fetchExpenseParticipants error:', partErr.message);
    }

    const participantsByExpId: Record<string, ExpenseParticipant[]> = {};
    (partRows || []).forEach((p: any) => {
      if (!participantsByExpId[p.expense_id]) {
        participantsByExpId[p.expense_id] = [];
      }
      participantsByExpId[p.expense_id].push({
        user_id: p.user_id,
        share_amount: Number(p.share_amount || 0),
        status: (p.status === 'settled' || p.paid_status) ? 'settled' : (p.status === 'payment_claimed' ? 'payment_claimed' : 'pending'),
        claimed_at: p.claimed_at || null,
        settled_at: p.settled_at || null,
      });
    });

    return expRows.map((e: any) => ({
      id: e.id,
      group_id: e.group_id || 'main-group',
      paid_by: e.paid_by,
      title: e.title || 'Expense',
      total_amount: Number(e.amount || e.total_amount || 0),
      category: e.category || 'Other',
      participants: participantsByExpId[e.id] || [],
      created_at: e.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Failed to fetch expenses:', err);
    return null;
  }
}

export async function addExpenseToSupabase(expense: Partial<GroupExpense>): Promise<GroupExpense | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const validGroupId = isValidUUID(expense.group_id) ? expense.group_id : null;
    const totalAmount = Number(expense.total_amount || 0);

    if (!expense.paid_by || totalAmount <= 0) {
      console.error('Invalid expense payload:', expense);
      return null;
    }

    const { data: expData, error: expError } = await supabase
      .from('expenses')
      .insert([{
        group_id: validGroupId,
        paid_by: expense.paid_by,
        title: expense.title || 'Group Expense',
        amount: totalAmount,
        category: expense.category || 'Other'
      }])
      .select()
      .single();

    if (expError) {
      console.error('Error inserting expense into Supabase:', expError.message);
      return null;
    }

    let insertedParticipants: ExpenseParticipant[] = [];

    if (expense.participants && expense.participants.length > 0) {
      const pRows = expense.participants.map(p => ({
        expense_id: expData.id,
        user_id: p.user_id,
        share_amount: Number(p.share_amount || 0),
        status: p.status || (p.user_id === expense.paid_by ? 'settled' : 'pending'),
        paid_status: p.status === 'settled' || p.user_id === expense.paid_by,
        claimed_at: p.claimed_at || null,
        settled_at: (p.status === 'settled' || p.user_id === expense.paid_by) ? (p.settled_at || new Date().toISOString()) : null
      }));

      const { data: partData, error: pError } = await supabase
        .from('expense_participants')
        .insert(pRows)
        .select();

      if (pError) {
        console.error('Error inserting expense participants:', pError.message);
      } else if (partData) {
        insertedParticipants = partData.map((p: any) => ({
          user_id: p.user_id,
          share_amount: Number(p.share_amount || 0),
          status: p.status || (p.paid_status ? 'settled' : 'pending'),
          claimed_at: p.claimed_at || null,
          settled_at: p.settled_at || null
        }));
      }
    }

    if (insertedParticipants.length === 0 && expense.participants) {
      insertedParticipants = expense.participants;
    }

    return {
      id: expData.id,
      group_id: expData.group_id || 'main-group',
      paid_by: expData.paid_by,
      title: expData.title,
      total_amount: Number(expData.amount || totalAmount),
      category: expData.category || 'Other',
      participants: insertedParticipants,
      created_at: expData.created_at || new Date().toISOString(),
      payer_profile: expense.payer_profile
    };
  } catch (err) {
    console.error('Failed to add expense:', err);
    return null;
  }
}

export async function updateExpenseInSupabase(
  expenseId: string,
  updates: {
    title?: string;
    category?: string;
    total_amount?: number;
    participants?: ExpenseParticipant[];
  }
): Promise<GroupExpense | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };
    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.category !== undefined) updatePayload.category = updates.category;
    if (updates.total_amount !== undefined) updatePayload.amount = updates.total_amount;

    const { data: expData, error: expErr } = await supabase
      .from('expenses')
      .update(updatePayload)
      .eq('id', expenseId)
      .select()
      .single();

    if (expErr) {
      console.error('Error updating expense:', expErr.message);
      return null;
    }

    let finalParticipants: ExpenseParticipant[] = updates.participants || [];

    if (updates.participants && updates.participants.length > 0) {
      // Clean delete existing participants and re-insert updated ones
      await supabase
        .from('expense_participants')
        .delete()
        .eq('expense_id', expenseId);

      const pRows = updates.participants.map(p => ({
        expense_id: expenseId,
        user_id: p.user_id,
        share_amount: Number(p.share_amount || 0),
        status: p.status || (p.user_id === expData.paid_by ? 'settled' : 'pending'),
        paid_status: p.status === 'settled' || p.user_id === expData.paid_by,
        claimed_at: p.claimed_at || null,
        settled_at: (p.status === 'settled' || p.user_id === expData.paid_by) ? (p.settled_at || new Date().toISOString()) : null
      }));

      const { data: partData, error: partErr } = await supabase
        .from('expense_participants')
        .insert(pRows)
        .select();

      if (partErr) {
        console.error('Error updating expense participants:', partErr.message);
      } else if (partData) {
        finalParticipants = partData.map((p: any) => ({
          user_id: p.user_id,
          share_amount: Number(p.share_amount || 0),
          status: p.status || (p.paid_status ? 'settled' : 'pending'),
          claimed_at: p.claimed_at || null,
          settled_at: p.settled_at || null
        }));
      }
    }

    return {
      id: expData.id,
      group_id: expData.group_id || 'main-group',
      paid_by: expData.paid_by,
      title: expData.title,
      total_amount: Number(expData.amount || updates.total_amount || 0),
      category: expData.category || 'Other',
      participants: finalParticipants,
      created_at: expData.created_at || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Failed to update expense in Supabase:', err);
    return null;
  }
}

export async function deleteExpenseFromSupabase(expenseId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      console.error('Error deleting expense:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to delete expense:', err);
    return false;
  }
}

export async function fetchLoansFromSupabase(): Promise<PersonalLoan[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data: loanRows, error: loanErr } = await supabase
      .from('loans')
      .select('*')
      .order('created_at', { ascending: false });

    if (loanErr) {
      console.warn('Supabase fetchLoans error:', loanErr.message);
      return null;
    }

    return (loanRows || []).map((l: any) => ({
      id: l.id,
      lender_id: l.lender_id,
      borrower_id: l.borrower_id,
      amount: Number(l.amount || 0),
      reason: l.reason || 'Personal loan',
      category: l.category || 'Other',
      status: l.status || 'pending',
      claimed_at: l.claimed_at || null,
      paid_at: l.paid_at || null,
      created_at: l.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Failed to fetch loans:', err);
    return null;
  }
}

export async function addLoanToSupabase(loan: Partial<PersonalLoan>): Promise<PersonalLoan | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    if (!loan.lender_id || !loan.borrower_id || !loan.amount) {
      console.error('Invalid loan payload:', loan);
      return null;
    }

    const { data, error } = await supabase
      .from('loans')
      .insert([{
        lender_id: loan.lender_id,
        borrower_id: loan.borrower_id,
        amount: Number(loan.amount),
        reason: loan.reason || 'Personal loan',
        category: loan.category || 'Other',
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error inserting loan into Supabase:', error.message);
      return null;
    }

    return {
      id: data.id,
      lender_id: data.lender_id,
      borrower_id: data.borrower_id,
      amount: Number(data.amount),
      reason: data.reason,
      category: data.category,
      status: data.status,
      claimed_at: data.claimed_at || null,
      paid_at: data.paid_at || null,
      created_at: data.created_at,
      lender_profile: loan.lender_profile,
      borrower_profile: loan.borrower_profile
    };
  } catch (err) {
    console.error('Failed to add loan:', err);
    return null;
  }
}

export async function updateLoanInSupabase(
  loanId: string,
  updates: {
    amount?: number;
    reason?: string;
    category?: string;
    borrower_id?: string;
    lender_id?: string;
    status?: 'pending' | 'payment_claimed' | 'paid';
  }
): Promise<PersonalLoan | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };
    if (updates.amount !== undefined) updatePayload.amount = Number(updates.amount);
    if (updates.reason !== undefined) updatePayload.reason = updates.reason;
    if (updates.category !== undefined) updatePayload.category = updates.category;
    if (updates.borrower_id !== undefined) updatePayload.borrower_id = updates.borrower_id;
    if (updates.lender_id !== undefined) updatePayload.lender_id = updates.lender_id;
    if (updates.status !== undefined) updatePayload.status = updates.status;

    const { data, error } = await supabase
      .from('loans')
      .update(updatePayload)
      .eq('id', loanId)
      .select()
      .single();

    if (error) {
      console.error('Error updating loan in Supabase:', error.message);
      return null;
    }

    return {
      id: data.id,
      lender_id: data.lender_id,
      borrower_id: data.borrower_id,
      amount: Number(data.amount),
      reason: data.reason,
      category: data.category,
      status: data.status,
      claimed_at: data.claimed_at || null,
      paid_at: data.paid_at || null,
      created_at: data.created_at
    };
  } catch (err) {
    console.error('Failed to update loan:', err);
    return null;
  }
}

export async function deleteLoanFromSupabase(loanId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('loans')
      .delete()
      .eq('id', loanId);

    if (error) {
      console.error('Error deleting loan:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to delete loan:', err);
    return false;
  }
}

export async function claimLoanPaymentInSupabase(loanId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('loans')
      .update({
        status: 'payment_claimed',
        claimed_at: new Date().toISOString()
      })
      .eq('id', loanId);

    if (error) {
      console.error('Error claiming loan payment:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to claim loan payment:', err);
    return false;
  }
}

export async function confirmLoanPaymentInSupabase(loanId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('loans')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', loanId);

    if (error) {
      console.error('Error confirming loan payment:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to confirm loan payment:', err);
    return false;
  }
}

export async function rejectLoanPaymentClaimInSupabase(loanId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('loans')
      .update({
        status: 'pending',
        claimed_at: null
      })
      .eq('id', loanId);

    if (error) {
      console.error('Error rejecting loan payment claim:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to reject loan payment claim:', err);
    return false;
  }
}

export async function settleLoanInSupabase(loanId: string): Promise<boolean> {
  return confirmLoanPaymentInSupabase(loanId);
}

export async function claimExpenseShareInSupabase(expenseId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('expense_participants')
      .update({
        status: 'payment_claimed',
        claimed_at: new Date().toISOString()
      })
      .eq('expense_id', expenseId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error claiming expense share:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to claim expense share:', err);
    return false;
  }
}

export async function settleExpenseShareInSupabase(expenseId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('expense_participants')
      .update({
        status: 'settled',
        paid_status: true,
        settled_at: new Date().toISOString()
      })
      .eq('expense_id', expenseId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error settling expense share:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to settle expense share:', err);
    return false;
  }
}

export async function rejectExpenseShareClaimInSupabase(expenseId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('expense_participants')
      .update({
        status: 'pending',
        paid_status: false,
        claimed_at: null
      })
      .eq('expense_id', expenseId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error rejecting expense share claim:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to reject expense share claim:', err);
    return false;
  }
}
