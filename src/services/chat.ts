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
      recipient_id: row.recipient_id || (typeof row.category === 'string' && row.category.startsWith('dm_') ? row.category.replace('dm_', '') : null),
      category: (row.category as ChatCategory) || 'general',
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
    let effectiveSenderId = msg.sender_id;

    // Check if there is an active authenticated user in Supabase
    let authUserId: string | null = null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id && isValidUUID(authData.user.id)) {
        authUserId = authData.user.id;
      }
    } catch {
      // Auth check fallback
    }

    if (authUserId && !isValidUUID(effectiveSenderId)) {
      effectiveSenderId = authUserId;
    }

    const payload: any = {
      sender_id: effectiveSenderId,
      category: msg.category || (msg.recipient_id ? 'direct' : 'general'),
      content: msg.content || '',
      media_url: msg.media_url || null,
    };

    if (msg.recipient_id && isValidUUID(msg.recipient_id)) {
      payload.recipient_id = msg.recipient_id;
    }

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
      // If recipient_id column is not in DB schema yet, try without recipient_id column
      if (error.message?.includes('recipient_id') || error.code === '42703') {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.recipient_id;
        fallbackPayload.category = msg.recipient_id ? `dm_${msg.recipient_id}` : (msg.category || 'general');
        
        const { data: fbData, error: fbErr } = await supabase
          .from('messages')
          .insert([fallbackPayload])
          .select()
          .single();

        if (!fbErr && fbData) {
          return {
            id: fbData.id,
            group_id: fbData.group_id,
            sender_id: msg.sender_id,
            recipient_id: msg.recipient_id,
            category: msg.category || 'direct',
            content: fbData.content,
            media_url: fbData.media_url,
            reply_to_id: fbData.reply_to_id,
            reactions: fbData.reactions || {},
            created_at: fbData.created_at,
            sender: msg.sender
          };
        }
      }

      const isRlsError = 
        error.message?.includes('row-level security') || 
        error.message?.includes('policy') || 
        error.code === '42501' || 
        error.code === 'PGRST301';

      if (isRlsError) {
        if (authUserId && effectiveSenderId !== authUserId) {
          try {
            payload.sender_id = authUserId;
            const { data: retryData, error: retryErr } = await supabase
              .from('messages')
              .insert([payload])
              .select()
              .single();

            if (!retryErr && retryData) {
              return {
                id: retryData.id,
                group_id: retryData.group_id,
                sender_id: msg.sender_id || retryData.sender_id,
                recipient_id: msg.recipient_id,
                category: retryData.category as ChatCategory,
                content: retryData.content,
                media_url: retryData.media_url,
                reply_to_id: retryData.reply_to_id,
                reactions: retryData.reactions || {},
                created_at: retryData.created_at,
                sender: msg.sender
              };
            }
          } catch {
            // Ignore retry error
          }
        }
        console.info('Supabase messages insert note (RLS/session policy):', error.message);
        return null;
      }

      console.warn('Supabase message send notice:', error.message);
      return null;
    }

    return {
      id: data.id,
      group_id: data.group_id,
      sender_id: data.sender_id,
      recipient_id: data.recipient_id || msg.recipient_id,
      category: data.category as ChatCategory,
      content: data.content,
      media_url: data.media_url,
      reply_to_id: data.reply_to_id,
      reactions: data.reactions || {},
      created_at: data.created_at,
      sender: msg.sender
    };
  } catch (err: any) {
    console.info('Message send notice:', err?.message || err);
    return null;
  }
}

export async function clearMessagesFromSupabase(options: {
  isGroup?: boolean;
  userId?: string;
  friendId?: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    if (options.isGroup) {
      // Clear group messages
      await supabase
        .from('messages')
        .delete()
        .neq('category', 'direct')
        .not('category', 'like', 'dm_%');
      return true;
    } else if (options.userId && options.friendId) {
      // Clear DM messages between userId and friendId
      const uId = options.userId;
      const fId = options.friendId;
      
      await supabase
        .from('messages')
        .delete()
        .or(`and(sender_id.eq.${uId},recipient_id.eq.${fId}),and(sender_id.eq.${fId},recipient_id.eq.${uId}),category.eq.dm_${fId},category.eq.dm_${uId}`);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Supabase clear messages notice:', err);
    return false;
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
    const categories: ChatCategory[] = ['general', 'college', 'plans', 'memories', 'random'];
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

