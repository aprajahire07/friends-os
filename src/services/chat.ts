import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ChatMessage, ChatCategory } from '../types';

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function fetchMessagesFromSupabase(category?: ChatCategory): Promise<ChatMessage[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let data: any[] | null = null;
    let query = supabase
      .from('messages')
      .select('*, sender:sender_id(*)');

    if (category) {
      query = query.eq('category', category);
    }

    const { data: primaryData, error: primaryErr } = await query.order('created_at', { ascending: true });

    if (primaryErr || !primaryData) {
      let fallbackQuery = supabase.from('messages').select('*');
      if (category) {
        fallbackQuery = fallbackQuery.eq('category', category);
      }
      const { data: fallbackData, error: fallbackErr } = await fallbackQuery.order('created_at', { ascending: true });
      if (fallbackErr) {
        console.warn('Supabase fetchMessages error:', fallbackErr.message);
        return null;
      }
      data = fallbackData;
    } else {
      data = primaryData;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      group_id: row.group_id,
      sender_id: row.sender_id,
      category: row.category as ChatCategory,
      content: row.content,
      media_url: row.media_url,
      reply_to_id: row.reply_to_id,
      reactions: row.reactions || {},
      created_at: row.created_at,
      sender: row.sender
    }));
  } catch (err) {
    console.warn('Failed to fetch messages:', err);
    return null;
  }
}

export async function sendMessageToSupabase(msg: Partial<ChatMessage>): Promise<ChatMessage | null> {
  if (!isSupabaseConfigured || !supabase || !msg.sender_id) return null;

  try {
    const payload: any = {
      sender_id: msg.sender_id,
      category: msg.category || 'general',
      content: msg.content || '',
      media_url: msg.media_url || null,
    };

    if (isValidUUID(msg.group_id)) {
      payload.group_id = msg.group_id;
    }

    if (isValidUUID(msg.reply_to_id)) {
      payload.reply_to_id = msg.reply_to_id;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error sending message to Supabase:', error.message);
      return null;
    }

    return {
      id: data.id,
      group_id: data.group_id,
      sender_id: data.sender_id,
      category: data.category as ChatCategory,
      content: data.content,
      media_url: data.media_url,
      reply_to_id: data.reply_to_id,
      reactions: data.reactions || {},
      created_at: data.created_at,
      sender: msg.sender
    };
  } catch (err) {
    console.error('Failed to send message:', err);
    return null;
  }
}

export async function fetchMessageReadsFromSupabase(userId: string): Promise<Record<string, string> | null> {
  if (!isSupabaseConfigured || !supabase || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('message_reads')
      .select('category, last_read_at')
      .eq('user_id', userId);

    if (error) {
      console.warn('Could not fetch message_reads:', error.message);
      return null;
    }

    const map: Record<string, string> = {};
    (data || []).forEach(row => {
      if (row.category) {
        map[row.category] = row.last_read_at;
      }
    });

    return map;
  } catch (err) {
    console.warn('Failed to fetch message reads:', err);
    return null;
  }
}

export async function markCategoryAsReadInSupabase(userId: string, category: ChatCategory): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;

  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('message_reads')
      .upsert({
        user_id: userId,
        category: category,
        last_read_at: now
      }, { onConflict: 'user_id,category' });

    if (error) {
      console.warn('Error updating message read status in Supabase:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Failed to mark category as read in Supabase:', err);
    return false;
  }
}

export async function markAllCategoriesAsReadInSupabase(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;

  try {
    const now = new Date().toISOString();
    const categories: ChatCategory[] = ['general', 'money', 'college', 'plans', 'memories', 'random'];
    const rows = categories.map(category => ({
      user_id: userId,
      category,
      last_read_at: now
    }));

    const { error } = await supabase
      .from('message_reads')
      .upsert(rows, { onConflict: 'user_id,category' });

    if (error) {
      console.warn('Error marking all categories as read in Supabase:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Failed to mark all categories as read in Supabase:', err);
    return false;
  }
}

export function subscribeToRealtimeMessages(onNewMessage: (msg: any) => void) {
  if (!isSupabaseConfigured || !supabase) return () => {};

  const channel = supabase
    .channel('public:messages')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        onNewMessage(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

