import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ChatMessage, ChatCategory } from '../types';

export async function fetchMessagesFromSupabase(category?: ChatCategory): Promise<ChatMessage[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    let query = supabase
      .from('messages')
      .select('*, sender:sender_id(*)');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetchMessages error:', error.message);
      return null;
    }

    // Map rows to ChatMessage format
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
  if (!isSupabaseConfigured) return null;

  try {
    const payload = {
      group_id: msg.group_id,
      sender_id: msg.sender_id,
      category: msg.category || 'general',
      content: msg.content,
      media_url: msg.media_url,
      reply_to_id: msg.reply_to_id
    };

    const { data, error } = await supabase
      .from('messages')
      .insert([payload])
      .select('*, sender:sender_id(*)')
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
      sender: data.sender
    };
  } catch (err) {
    console.error('Failed to send message:', err);
    return null;
  }
}

export function subscribeToRealtimeMessages(onNewMessage: (msg: any) => void) {
  if (!isSupabaseConfigured) return () => {};

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
