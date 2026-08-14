import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SnapMessage } from '../types';

export async function fetchSnapsFromSupabase(userId: string): Promise<SnapMessage[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let data: any[] | null = null;
    const { data: primaryData, error: primaryErr } = await supabase
      .from('snaps')
      .select('*, sender_profile:sender_id(*)')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (primaryErr || !primaryData) {
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('snaps')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (fallbackErr) {
        console.warn('Supabase fetchSnaps error:', fallbackErr.message);
        return null;
      }
      data = fallbackData;
    } else {
      data = primaryData;
    }

    return (data || []).map((s: any) => ({
      id: s.id,
      sender_id: s.sender_id,
      recipient_id: s.receiver_id || s.recipient_id,
      image_url: s.status === 'expired' ? '' : (s.storage_path || s.image_url),
      caption: s.caption,
      sent_at: s.created_at || s.sent_at,
      delivered_at: s.delivered_at,
      opened_at: s.opened_at,
      expires_at: s.expires_at,
      status: s.status,
      sender_profile: s.sender_profile
    }));
  } catch (err) {
    console.warn('Failed to fetch snaps:', err);
    return null;
  }
}

export async function sendSnapToSupabase(senderId: string, recipientId: string, imageUrl: string, caption?: string): Promise<SnapMessage | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('snaps')
      .insert([{
        sender_id: senderId,
        receiver_id: recipientId,
        storage_path: imageUrl,
        caption: caption,
        status: 'sent'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error sending snap to Supabase:', error.message);
      return null;
    }

    return {
      id: data.id,
      sender_id: data.sender_id,
      recipient_id: data.receiver_id,
      image_url: data.storage_path,
      caption: data.caption,
      sent_at: data.created_at,
      status: data.status,
      sender_profile: null
    };
  } catch (err) {
    console.error('Failed to send snap:', err);
    return null;
  }
}

export async function openSnapInSupabase(snapId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('snaps')
      .update({
        status: 'opened',
        opened_at: new Date().toISOString()
      })
      .eq('id', snapId);

    if (error) {
      console.error('Error opening snap:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to open snap:', err);
    return false;
  }
}

export async function destroySnapInSupabase(snapId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('snaps')
      .update({
        storage_path: '',
        status: 'expired',
        expires_at: new Date().toISOString()
      })
      .eq('id', snapId);

    if (error) {
      console.error('Error destroying snap:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to destroy snap:', err);
    return false;
  }
}
