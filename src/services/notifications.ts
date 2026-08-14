import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AppNotification } from '../types';

export async function fetchNotificationsFromSupabase(userId: string): Promise<AppNotification[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchNotifications error:', error.message);
      return null;
    }

    return (data || []).map((n: any) => ({
      id: n.id,
      user_id: n.user_id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.related_id,
      is_read: n.is_read,
      created_at: n.created_at
    }));
  } catch (err) {
    console.warn('Failed to fetch notifications:', err);
    return null;
  }
}

export async function addNotificationToSupabase(notif: Partial<AppNotification>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: notif.user_id,
        type: notif.type || 'college',
        title: notif.title,
        message: notif.message,
        related_id: notif.link,
        is_read: false
      }]);

    if (error) {
      console.error('Error adding notification:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to add notification:', err);
    return false;
  }
}

export async function markNotificationsReadInSupabase(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);

    if (error) {
      console.error('Error marking notifications read:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to mark notifications read:', err);
    return false;
  }
}
