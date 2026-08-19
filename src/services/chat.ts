import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ChatMessage, ChatCategory } from '../types';
import { dispatchChatPushNotification } from './pushNotifications';

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Parses raw Supabase message row into clean ChatMessage
 * Transparently extracts recipient_id from column or <!--dm:ID--> tag
 */
export function mapMessageRow(row: any): ChatMessage {
  let content = row.content || '';
  let recipient_id = row.recipient_id || null;
  let category: ChatCategory = (row.category as ChatCategory) || 'general';

  // Check for embedded dm tag in content
  if (typeof content === 'string' && content.startsWith('<!--dm:') && content.includes('-->')) {
    const endIdx = content.indexOf('-->');
    recipient_id = content.substring(7, endIdx).trim();
    content = content.substring(endIdx + 3);
    category = 'direct';
  } else if (typeof row.category === 'string' && row.category.startsWith('dm_')) {
    recipient_id = row.category.replace('dm_', '');
    category = 'direct';
  } else if (recipient_id) {
    category = 'direct';
  }

  return {
    id: row.id,
    group_id: row.group_id,
    sender_id: row.sender_id,
    recipient_id: recipient_id,
    category: category,
    content: content,
    media_url: row.media_url,
    reply_to_id: row.reply_to_id,
    reactions: row.reactions || {},
    created_at: row.created_at,
    sender: row.sender
  };
}

export async function fetchMessagesFromSupabase(category?: ChatCategory): Promise<ChatMessage[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let data: any[] | null = null;
    let query = supabase
      .from('messages')
      .select('*, sender:sender_id(*)');

    const { data: primaryData, error: primaryErr } = await query.order('created_at', { ascending: true });

    if (primaryErr || !primaryData) {
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (fallbackErr) {
        console.warn('Supabase fetchMessages error:', fallbackErr.message);
        return null;
      }
      data = fallbackData;
    } else {
      data = primaryData;
    }

    return (data || []).map(mapMessageRow);
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

    // Format content with dm tag if private message to ensure 100% compatibility
    let formattedContent = msg.content || '';
    if (msg.recipient_id) {
      formattedContent = `<!--dm:${msg.recipient_id}-->${formattedContent}`;
    }

    // Use 'general' category in database row to pass any CHECK (category IN (...)) constraint
    const payloadWithRecipient: any = {
      sender_id: effectiveSenderId,
      category: 'general',
      content: formattedContent,
      media_url: msg.media_url || null,
    };

    if (msg.recipient_id && isValidUUID(msg.recipient_id)) {
      payloadWithRecipient.recipient_id = msg.recipient_id;
    }

    if (isValidUUID(msg.group_id)) {
      payloadWithRecipient.group_id = msg.group_id;
    }

    if (isValidUUID(msg.reply_to_id)) {
      payloadWithRecipient.reply_to_id = msg.reply_to_id;
    }

    // First attempt: insert with recipient_id column
    const { data: primaryData, error: primaryErr } = await supabase
      .from('messages')
      .insert([payloadWithRecipient])
      .select()
      .single();

    let resultMessage: ChatMessage | null = null;

    if (!primaryErr && primaryData) {
      resultMessage = {
        ...mapMessageRow(primaryData),
        sender: msg.sender,
        recipient: msg.recipient
      };
    } else {
      // Fallback attempt: If recipient_id column doesn't exist, insert without recipient_id column
      const fallbackPayload = { ...payloadWithRecipient };
      delete fallbackPayload.recipient_id;

      const { data: fbData, error: fbErr } = await supabase
        .from('messages')
        .insert([fallbackPayload])
        .select()
        .single();

      if (!fbErr && fbData) {
        resultMessage = {
          ...mapMessageRow(fbData),
          sender: msg.sender,
          recipient: msg.recipient
        };
      } else if (authUserId && effectiveSenderId !== authUserId) {
        // RLS Retry with authUserId if needed
        fallbackPayload.sender_id = authUserId;
        const { data: retryData, error: retryErr } = await supabase
          .from('messages')
          .insert([fallbackPayload])
          .select()
          .single();

        if (!retryErr && retryData) {
          resultMessage = {
            ...mapMessageRow(retryData),
            sender: msg.sender,
            recipient: msg.recipient
          };
        }
      }
    }

    // Trigger asynchronous Web Push (non-blocking)
    if (resultMessage) {
      try {
        const senderName = msg.sender?.full_name || 'A friend';
        if (msg.recipient_id) {
          // Direct message
          dispatchChatPushNotification({
            senderName,
            senderId: effectiveSenderId,
            recipientUserIds: [msg.recipient_id],
            content: msg.content || ''
          }).catch(() => {});
        } else {
          // Group message: notify other members
          supabase.from('profiles').select('id').then(({ data: allProfiles }) => {
            const recipientIds = (allProfiles || [])
              .map((p: any) => p.id)
              .filter((id: string) => id && id !== effectiveSenderId);
            if (recipientIds.length > 0) {
              dispatchChatPushNotification({
                senderName,
                senderId: effectiveSenderId,
                recipientUserIds: recipientIds,
                content: msg.content || ''
              }).catch(() => {});
            }
          });
        }
      } catch {
        // Non-blocking
      }
      return resultMessage;
    }

    console.warn('Supabase message send notice:', primaryErr?.message);
    return null;
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
  if (!isSupabaseConfigured || !supabase || !options.userId) return false;

  try {
    const myId = options.userId;

    if (options.isGroup) {
      // Delete user's own group messages
      await supabase
        .from('messages')
        .delete()
        .eq('sender_id', myId)
        .not('content', 'like', '<!--dm:%');
      return true;
    } else if (options.friendId) {
      // Delete user's direct messages sent to friend
      await supabase
        .from('messages')
        .delete()
        .eq('sender_id', myId)
        .or(`recipient_id.eq.${options.friendId},content.like.<!--dm:${options.friendId}-->%`);
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
    console.warn('fetchMessageReads error:', err);
    return null;
  }
}

export async function markCategoryAsReadInSupabase(userId: string, category: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;

  try {
    const { error } = await supabase
      .from('message_reads')
      .upsert(
        {
          user_id: userId,
          category,
          last_read_at: new Date().toISOString()
        },
        { onConflict: 'user_id, category' }
      );

    if (error) {
      console.warn('Could not update message_reads in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('markCategoryAsRead error:', err);
    return false;
  }
}

export async function markAllCategoriesAsReadInSupabase(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;

  try {
    const categories = ['general', 'college', 'plans', 'memories', 'random', 'direct'];
    const rows = categories.map(cat => ({
      user_id: userId,
      category: cat,
      last_read_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('message_reads')
      .upsert(rows, { onConflict: 'user_id, category' });

    if (error) {
      console.warn('markAllCategories error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('markAllCategories error:', err);
    return false;
  }
}
