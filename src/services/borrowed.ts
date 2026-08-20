import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { BorrowedItem } from '../types';

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function ensureValidDateString(dateInput?: string | null): string {
  if (!dateInput) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  const parsed = new Date(dateInput);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  // Fallback: 7 days from now
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 7);
  return fallback.toISOString().split('T')[0];
}

export async function fetchBorrowedItemsFromSupabase(): Promise<BorrowedItem[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let data: any[] | null = null;
    const { data: primaryData, error: primaryErr } = await supabase
      .from('borrowed_items')
      .select('*, owner_profile:owner_id(*), borrower_profile:borrower_id(*)')
      .order('created_at', { ascending: false });

    if (primaryErr || !primaryData) {
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('borrowed_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (fallbackErr) {
        console.warn('Supabase fetchBorrowedItems error:', fallbackErr.message);
        return null;
      }
      data = fallbackData;
    } else {
      data = primaryData;
    }

    return (data || []).map((b: any) => ({
      id: b.id,
      owner_id: b.owner_id,
      borrower_id: b.borrower_id,
      item_name: b.item_name,
      description: b.description || b.item_name,
      borrowed_date: b.borrowed_date || b.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      expected_return_date: b.due_date || b.expected_return_date || new Date().toISOString().split('T')[0],
      returned_at: b.returned_date || b.returned_at || null,
      status: (b.status === 'returned' ? 'returned' : 'borrowed') as 'borrowed' | 'returned',
      created_at: b.created_at,
      owner_profile: b.owner_profile,
      borrower_profile: b.borrower_profile
    }));
  } catch (err) {
    console.warn('Failed to fetch borrowed items:', err);
    return null;
  }
}

export async function addBorrowedItemToSupabase(item: {
  owner_id: string;
  borrower_id: string;
  item_name: string;
  description?: string;
  borrowed_date?: string;
  expected_return_date: string;
  group_id?: string;
}): Promise<BorrowedItem | null> {
  if (!isSupabaseConfigured || !supabase || !item.owner_id || !item.borrower_id) return null;

  try {
    const validDueDate = ensureValidDateString(item.expected_return_date);
    const validBorrowedDate = ensureValidDateString(item.borrowed_date || new Date().toISOString().split('T')[0]);

    const payload: any = {
      owner_id: item.owner_id,
      borrower_id: item.borrower_id,
      item_name: item.item_name,
      description: item.description || item.item_name,
      borrowed_date: validBorrowedDate,
      due_date: validDueDate,
      status: 'borrowed'
    };

    if (item.group_id && isValidUUID(item.group_id)) {
      payload.group_id = item.group_id;
    }

    const { data, error } = await supabase
      .from('borrowed_items')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.info('Supabase borrowed items sync note (RLS/policy):', error.message);
      return null;
    }

    return {
      id: data.id,
      owner_id: data.owner_id,
      borrower_id: data.borrower_id,
      item_name: data.item_name,
      description: data.description,
      borrowed_date: data.borrowed_date,
      expected_return_date: data.due_date,
      returned_at: data.returned_date,
      status: data.status,
      created_at: data.created_at
    };
  } catch (err) {
    console.error('Failed to add borrowed item:', err);
    return null;
  }
}

export async function markItemReturnedInSupabase(itemId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !itemId) return false;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('borrowed_items')
      .update({
        status: 'returned',
        returned_date: today,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId);

    if (error) {
      console.error('Error marking item returned:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to mark item returned:', err);
    return false;
  }
}

