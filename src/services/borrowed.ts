import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { BorrowedItem } from '../types';

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
      borrowed_date: b.borrowed_date,
      expected_return_date: b.due_date || b.expected_return_date,
      returned_at: b.returned_date || b.returned_at,
      status: b.status,
      created_at: b.created_at,
      owner_profile: b.owner_profile,
      borrower_profile: b.borrower_profile
    }));
  } catch (err) {
    console.warn('Failed to fetch borrowed items:', err);
    return null;
  }
}

export async function addBorrowedItemToSupabase(item: Partial<BorrowedItem>): Promise<BorrowedItem | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('borrowed_items')
      .insert([{
        owner_id: item.owner_id,
        borrower_id: item.borrower_id,
        item_name: item.item_name,
        description: item.item_name,
        borrowed_date: item.borrowed_date || new Date().toISOString().split('T')[0],
        due_date: item.expected_return_date,
        status: 'borrowed'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error inserting borrowed item:', error.message);
      return null;
    }

    return {
      id: data.id,
      owner_id: data.owner_id,
      borrower_id: data.borrower_id,
      item_name: data.item_name,
      borrowed_date: data.borrowed_date,
      expected_return_date: data.due_date,
      returned_at: data.returned_date,
      status: data.status,
      created_at: data.created_at,
      owner_profile: item.owner_profile,
      borrower_profile: item.borrower_profile
    };
  } catch (err) {
    console.error('Failed to add borrowed item:', err);
    return null;
  }
}

export async function markItemReturnedInSupabase(itemId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('borrowed_items')
      .update({
        status: 'returned',
        returned_date: new Date().toISOString().split('T')[0]
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
