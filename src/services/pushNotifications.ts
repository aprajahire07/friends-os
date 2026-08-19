import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Standard VAPID Public Key for client-side subscription creation
export const VAPID_PUBLIC_KEY = 
  (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || 
  'BIuU2K8p706ypy_bWNBdoaOlrNNle1SCmF6hl1sA_ulg9N4VnhqaNVGtwKGQXZI9lLZIwlPVI0JUS5BmGBLu_Kk';

export type PushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface PushSubscriptionRecord {
  id?: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SendPushPayload {
  recipientUserIds?: string[];
  all?: boolean;
  title: string;
  body: string;
  section?: 'home' | 'expenses' | 'money' | 'borrowed' | 'chat' | 'snaps' | 'memories' | 'notes' | 'plans' | 'attendance' | 'admin';
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, any>;
}

export interface SendPushResult {
  success: boolean;
  delivered?: number;
  failed?: number;
  cleaned?: number;
  error?: string;
}

/**
 * Convert standard base64url string to Uint8Array for PushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if Web Push Notifications and Service Workers are supported in the current browser/device
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current browser notification permission
 */
export function getPushPermissionState(): PushPermissionStatus {
  if (!isPushNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission as PushPermissionStatus;
}

/**
 * Get existing browser push subscription if any
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('Error fetching existing push subscription:', err);
    return null;
  }
}

/**
 * Enable/Subscribe device to Push Notifications & store credentials in Supabase
 */
export async function subscribeUserToPush(userId: string): Promise<{
  success: boolean;
  status: PushPermissionStatus;
  error?: string;
}> {
  if (!isPushNotificationSupported()) {
    return { success: false, status: 'unsupported', error: 'Web Push is not supported on this browser or device.' };
  }

  if (!userId) {
    return { success: false, status: 'default', error: 'User must be authenticated to enable push notifications.' };
  }

  try {
    // 1. Request user permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        status: permission as PushPermissionStatus,
        error: permission === 'denied' 
          ? 'Notification permission was denied in browser settings.' 
          : 'Notification permission was not granted.'
      };
    }

    // 2. Ensure Service Worker is ready
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    await navigator.serviceWorker.ready;

    // 3. Create or retrieve PushSubscription from browser
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    // 4. Extract cryptographic keys
    const rawKey = subscription.getKey ? subscription.getKey('p256dh') : null;
    const rawAuth = subscription.getKey ? subscription.getKey('auth') : null;

    if (!rawKey || !rawAuth) {
      return { success: false, status: 'granted', error: 'Unable to derive encryption keys from push subscription.' };
    }

    const p256dh = btoa(String.fromCharCode(...new Uint8Array(rawKey)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const auth = btoa(String.fromCharCode(...new Uint8Array(rawAuth)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const endpoint = subscription.endpoint;
    const userAgent = navigator.userAgent;

    // 5. Store/Upsert in Supabase push_subscriptions table
    if (isSupabaseConfigured && supabase) {
      const { error: dbError } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint: endpoint,
            p256dh: p256dh,
            auth: auth,
            user_agent: userAgent,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,endpoint' }
        );

      if (dbError) {
        console.warn('Could not persist push subscription to Supabase:', dbError.message);
        // Note: Table might need creation via migration if not yet created
      }
    }

    // Save active state to localStorage for instantaneous UI updates
    localStorage.setItem(`friend_os_push_enabled_${userId}`, 'true');

    return { success: true, status: 'granted' };
  } catch (err: any) {
    console.error('Push subscription failed:', err);
    return { success: false, status: getPushPermissionState(), error: err?.message || 'Failed to subscribe to push notifications.' };
  }
}

/**
 * Unsubscribe current device from push notifications
 */
export async function unsubscribeUserFromPush(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!isPushNotificationSupported()) return { success: true };

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Remove from Supabase
        if (isSupabaseConfigured && supabase && userId) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', endpoint);
        }
      }
    }

    localStorage.removeItem(`friend_os_push_enabled_${userId}`);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to unsubscribe from push:', err);
    return { success: false, error: err?.message || 'Failed to unsubscribe.' };
  }
}

/**
 * Test push notification directly on this device (client self-test)
 */
export async function showLocalTestNotification(): Promise<boolean> {
  if (!isPushNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const options: any = {
        body: 'System push notifications are active on this device! You will receive updates even when Friend OS is closed.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [150, 50, 150],
        tag: `friend-os-test-${Date.now()}`,
        data: {
          section: 'home',
          url: '/?tab=home'
        }
      };
      await reg.showNotification('Friend OS ⚡ System Test', options);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error showing local test notification:', err);
    return false;
  }
}

/**
 * Dispatch Push Notification via Supabase Edge Function `send-push`
 * Or fallback to direct client-side broadcast if edge function is deploying
 */
export async function sendPushNotification(payload: SendPushPayload): Promise<SendPushResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    // 1. Obtain current authenticated user's session JWT
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      return { success: false, error: 'User is not authenticated' };
    }

    // 2. Invoke Supabase Edge Function `send-push`
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: {
        recipient_user_ids: payload.recipientUserIds || [],
        all: Boolean(payload.all),
        title: payload.title,
        body: payload.body,
        section: payload.section || 'home',
        icon: payload.icon || '/icons/icon-192.png',
        badge: payload.badge || '/icons/icon-192.png',
        image: payload.image,
        tag: payload.tag,
        data: payload.data || {}
      }
    });

    if (error) {
      console.warn('Supabase Edge Function send-push notice:', error.message);
      return {
        success: false,
        error: error.message || 'Edge Function execution error'
      };
    }

    return {
      success: true,
      delivered: data?.delivered || 0,
      failed: data?.failed || 0,
      cleaned: data?.cleaned || 0
    };
  } catch (err: any) {
    console.error('sendPushNotification error:', err);
    return {
      success: false,
      error: err?.message || 'Network error calling push gateway'
    };
  }
}

/**
 * In-memory deduplication cache to prevent duplicate push notifications for the same event
 */
const recentPushDedupeMap = new Map<string, number>();

/**
 * Dispatch Push Notification with deduplication guard
 */
export async function sendDeduplicatedPush(
  dedupeKey: string, 
  payload: SendPushPayload
): Promise<SendPushResult> {
  const now = Date.now();
  const lastSent = recentPushDedupeMap.get(dedupeKey);

  // If sent within last 4 seconds with same key, silently skip duplicate
  if (lastSent && (now - lastSent) < 4000) {
    return { success: true, delivered: 0 };
  }

  recentPushDedupeMap.set(dedupeKey, now);

  // Clean old keys
  if (recentPushDedupeMap.size > 200) {
    for (const [k, time] of recentPushDedupeMap.entries()) {
      if (now - time > 30000) {
        recentPushDedupeMap.delete(k);
      }
    }
  }

  return sendPushNotification(payload);
}

/**
 * 1. Money & Expense Push Notification
 */
export async function dispatchMoneyPushNotification(params: {
  senderName: string;
  senderId: string;
  recipientUserIds: string[];
  type?: 'split' | 'paid_for_you' | 'expense';
  itemTitle?: string;
}) {
  const recipients = params.recipientUserIds.filter(id => id && id !== params.senderId);
  if (recipients.length === 0) return;

  const dedupeKey = `money_${params.senderId}_${recipients.sort().join('_')}_${params.itemTitle || ''}_${Math.floor(Date.now() / 5000)}`;

  let body = `Money update from ${params.senderName}`;
  if (params.type === 'paid_for_you') {
    body = `${params.senderName} paid for you.`;
  } else if (params.type === 'split') {
    body = `New split expense from ${params.senderName}${params.itemTitle ? ` for "${params.itemTitle}"` : ''}.`;
  }

  return sendDeduplicatedPush(dedupeKey, {
    recipientUserIds: recipients,
    title: '💰 Friend OS',
    body: body,
    section: 'money',
    tag: `friend-os-money-${Date.now()}`,
    data: {
      section: 'money',
      senderName: params.senderName,
      type: params.type || 'money'
    }
  });
}

/**
 * 2. Borrowed Item / Money Push Notification
 */
export async function dispatchBorrowedPushNotification(params: {
  senderName: string;
  senderId: string;
  recipientUserId: string;
  itemName: string;
}) {
  if (!params.recipientUserId || params.recipientUserId === params.senderId) return;

  const dedupeKey = `borrowed_${params.senderId}_${params.recipientUserId}_${params.itemName}_${Math.floor(Date.now() / 5000)}`;

  return sendDeduplicatedPush(dedupeKey, {
    recipientUserIds: [params.recipientUserId],
    title: '💸 Friend OS',
    body: `Borrowed item/money update from ${params.senderName}: "${params.itemName}"`,
    section: 'borrowed',
    tag: `friend-os-borrowed-${Date.now()}`,
    data: {
      section: 'borrowed',
      senderName: params.senderName,
      itemName: params.itemName
    }
  });
}

/**
 * 3. Snap Message Push Notification
 */
export async function dispatchSnapPushNotification(params: {
  senderName: string;
  senderId: string;
  recipientUserIds: string[];
  isEveryone?: boolean;
}) {
  const recipients = params.recipientUserIds.filter(id => id && id !== params.senderId);
  if (recipients.length === 0) return;

  const dedupeKey = `snap_${params.senderId}_${recipients.sort().join('_')}_${Math.floor(Date.now() / 5000)}`;

  return sendDeduplicatedPush(dedupeKey, {
    recipientUserIds: recipients,
    title: '📸 Friend OS',
    body: `You received a new Snap from ${params.senderName}`,
    section: 'snaps',
    tag: `friend-os-snaps-${Date.now()}`,
    data: {
      section: 'snaps',
      senderName: params.senderName,
      isEveryone: Boolean(params.isEveryone)
    }
  });
}

/**
 * 4. Plan & Outing Push Notification
 */
export async function dispatchPlanPushNotification(params: {
  senderName: string;
  senderId: string;
  recipientUserIds: string[];
  planTitle: string;
}) {
  const recipients = params.recipientUserIds.filter(id => id && id !== params.senderId);
  if (recipients.length === 0) return;

  const dedupeKey = `plan_${params.senderId}_${params.planTitle}_${Math.floor(Date.now() / 5000)}`;

  return sendDeduplicatedPush(dedupeKey, {
    recipientUserIds: recipients,
    title: '📅 Friend OS',
    body: `${params.senderName} created a new plan: "${params.planTitle}"`,
    section: 'plans',
    tag: `friend-os-plans-${Date.now()}`,
    data: {
      section: 'plans',
      senderName: params.senderName,
      planTitle: params.planTitle
    }
  });
}

/**
 * 5. Notes Uploaded Push Notification
 */
export async function dispatchNotePushNotification(params: {
  senderName: string;
  senderId: string;
  recipientUserIds: string[];
  noteCaption: string;
}) {
  const recipients = params.recipientUserIds.filter(id => id && id !== params.senderId);
  if (recipients.length === 0) return;

  const dedupeKey = `note_${params.senderId}_${params.noteCaption}_${Math.floor(Date.now() / 5000)}`;

  return sendDeduplicatedPush(dedupeKey, {
    recipientUserIds: recipients,
    title: '📚 Friend OS',
    body: `New Notes uploaded by ${params.senderName}: "${params.noteCaption}"`,
    section: 'notes',
    tag: `friend-os-notes-${Date.now()}`,
    data: {
      section: 'notes',
      senderName: params.senderName,
      caption: params.noteCaption
    }
  });
}

/**
 * 6. Shared Memory Push Notification
 */
export async function dispatchMemoryPushNotification(params: {
  senderName: string;
  senderId: string;
  recipientUserIds: string[];
  memoryTitle: string;
}) {
  const recipients = params.recipientUserIds.filter(id => id && id !== params.senderId);
  if (recipients.length === 0) return;

  const dedupeKey = `memory_${params.senderId}_${params.memoryTitle}_${Math.floor(Date.now() / 5000)}`;

  return sendDeduplicatedPush(dedupeKey, {
    recipientUserIds: recipients,
    title: '📸 Friend OS',
    body: `New Memory added by ${params.senderName}: "${params.memoryTitle}"`,
    section: 'memories',
    tag: `friend-os-memories-${Date.now()}`,
    data: {
      section: 'memories',
      senderName: params.senderName,
      title: params.memoryTitle
    }
  });
}

/**
 * 7. Group / Direct Chat Message Push Notification
 */
export async function dispatchChatPushNotification(params: {
  senderName: string;
  senderId: string;
  recipientUserIds: string[];
  content: string;
}) {
  const recipients = params.recipientUserIds.filter(id => id && id !== params.senderId);
  if (recipients.length === 0) return;

  const dedupeKey = `chat_${params.senderId}_${recipients.sort().join('_')}_${params.content.slice(0, 30)}_${Math.floor(Date.now() / 4000)}`;

  const snippet = params.content.length > 50 ? `${params.content.substring(0, 50)}...` : params.content;

  return sendDeduplicatedPush(dedupeKey, {
    recipientUserIds: recipients,
    title: '💬 Friend OS',
    body: `${params.senderName}: ${snippet}`,
    section: 'chat',
    tag: `friend-os-chat-${Date.now()}`,
    data: {
      section: 'chat',
      senderName: params.senderName
    }
  });
}

/**
 * Fetch total count of registered push devices (Admin audit)
 */
export async function fetchPushSubscriptionsCount(): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 0;

  try {
    const { count, error } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.warn('Error fetching push subscriptions count:', error.message);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.warn('fetchPushSubscriptionsCount exception:', err);
    return 0;
  }
}
