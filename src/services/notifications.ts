import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AppNotification } from '../types';

function isValidUUID(str?: string): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

const VALID_NOTIFICATION_TYPES = new Set([
  'message',
  'mention',
  'snap',
  'snap_opened',
  'expense',
  'payment',
  'plan',
  'poll',
  'birthday',
  'borrowed',
  'attendance',
  'college'
]);

export async function fetchNotificationsFromSupabase(userId: string): Promise<AppNotification[] | null> {
  if (!isSupabaseConfigured || !supabase || !userId) return null;

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
  if (!isSupabaseConfigured || !supabase || !notif.user_id) return false;

  try {
    const safeType = notif.type && VALID_NOTIFICATION_TYPES.has(notif.type) ? notif.type : 'college';

    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: notif.user_id,
        type: safeType,
        title: notif.title || 'Notification',
        message: notif.message || '',
        related_id: isValidUUID(notif.link) ? notif.link : null,
        is_read: false
      }]);

    if (error) {
      // Safe non-blocking warning for RLS when sending notifications to peers
      console.warn('Notification delivery to remote table skipped (RLS):', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to add notification:', err);
    return false;
  }
}

export async function markNotificationsReadInSupabase(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);

    if (error) {
      console.warn('Error marking notifications read:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to mark notifications read:', err);
    return false;
  }
}
