import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { GroupExpense, PersonalLoan } from '../types';

export async function fetchExpensesFromSupabase(): Promise<GroupExpense[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let data: any[] | null = null;
    const { data: primaryData, error: primaryErr } = await supabase
      .from('expenses')
      .select('*, expense_participants(*), payer_profile:paid_by(*)')
      .order('created_at', { ascending: false });

    if (primaryErr || !primaryData) {
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('expenses')
        .select('*, expense_participants(*)')
        .order('created_at', { ascending: false });

      if (fallbackErr) {
        console.warn('Supabase fetchExpenses error:', fallbackErr.message);
        return null;
      }
      data = fallbackData;
    } else {
      data = primaryData;
    }

    return (data || []).map((e: any) => ({
      id: e.id,
      group_id: e.group_id,
      paid_by: e.paid_by,
      title: e.title,
      total_amount: Number(e.amount || e.total_amount || 0),
      category: e.category || 'Other',
      participants: (e.expense_participants || []).map((p: any) => ({
        user_id: p.user_id,
        share_amount: Number(p.share_amount || 0),
        status: p.status || (p.paid_status ? 'settled' : 'pending')
      })),
      created_at: e.created_at,
      payer_profile: e.payer_profile
    }));
  } catch (err) {
    console.warn('Failed to fetch expenses:', err);
    return null;
  }
}

export async function addExpenseToSupabase(expense: Partial<GroupExpense>): Promise<GroupExpense | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data: expData, error: expError } = await supabase
      .from('expenses')
      .insert([{
        group_id: expense.group_id || 'main-group',
        paid_by: expense.paid_by,
        title: expense.title,
        amount: expense.total_amount,
        category: expense.category || 'other'
      }])
      .select()
      .single();

    if (expError) {
      console.error('Error inserting expense:', expError.message);
      return null;
    }

    if (expense.participants && expense.participants.length > 0) {
      const pRows = expense.participants.map(p => ({
        expense_id: expData.id,
        user_id: p.user_id,
        share_amount: p.share_amount,
        status: p.status || 'pending'
      }));

      await supabase.from('expense_participants').insert(pRows);
    }

    return {
      id: expData.id,
      group_id: expData.group_id,
      paid_by: expData.paid_by,
      title: expData.title,
      total_amount: Number(expData.amount),
      category: expData.category,
      participants: expense.participants || [],
      created_at: expData.created_at,
      payer_profile: expense.payer_profile
    };
  } catch (err) {
    console.error('Failed to add expense:', err);
    return null;
  }
}

export async function fetchLoansFromSupabase(): Promise<PersonalLoan[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let data: any[] | null = null;
    const { data: primaryData, error: primaryErr } = await supabase
      .from('loans')
      .select('*, lender_profile:lender_id(*), borrower_profile:borrower_id(*)')
      .order('created_at', { ascending: false });

    if (primaryErr || !primaryData) {
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false });

      if (fallbackErr) {
        console.warn('Supabase fetchLoans error:', fallbackErr.message);
        return null;
      }
      data = fallbackData;
    } else {
      data = primaryData;
    }

    return (data || []).map((l: any) => ({
      id: l.id,
      lender_id: l.lender_id,
      borrower_id: l.borrower_id,
      amount: Number(l.amount || 0),
      reason: l.reason,
      category: l.category,
      status: l.status,
      paid_at: l.paid_at,
      created_at: l.created_at,
      lender_profile: l.lender_profile,
      borrower_profile: l.borrower_profile
    }));
  } catch (err) {
    console.warn('Failed to fetch loans:', err);
    return null;
  }
}

export async function addLoanToSupabase(loan: Partial<PersonalLoan>): Promise<PersonalLoan | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('loans')
      .insert([{
        lender_id: loan.lender_id,
        borrower_id: loan.borrower_id,
        amount: loan.amount,
        reason: loan.reason,
        category: loan.category || 'other',
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error inserting loan:', error.message);
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
      paid_at: data.paid_at,
      created_at: data.created_at,
      lender_profile: loan.lender_profile,
      borrower_profile: loan.borrower_profile
    };
  } catch (err) {
    console.error('Failed to add loan:', err);
    return null;
  }
}

export async function claimLoanPaymentInSupabase(loanId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('loans')
      .update({
        status: 'payment_claimed'
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
        status: 'pending'
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
        status: 'payment_claimed'
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
        paid_status: true
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
        paid_status: false
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
