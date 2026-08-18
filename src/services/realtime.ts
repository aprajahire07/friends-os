import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { appStore } from '../lib/store';
import { mapProfileFromSupabase } from './profiles';
import { debounce } from '../lib/asyncUtils';

// Debounced sync callers to prevent rapid-fire network requests & re-renders
const debouncedSyncMessages = debounce(() => appStore.syncMessages(), 150);
const debouncedSyncMessageReads = debounce(() => appStore.syncMessageReads(), 150);
const debouncedSyncProfiles = debounce(() => appStore.syncProfiles(), 200);
const debouncedSyncExpensesAndLoans = debounce(() => appStore.syncExpensesAndLoans(), 150);
const debouncedSyncPlans = debounce(() => appStore.syncPlans(), 150);
const debouncedSyncMemories = debounce(() => appStore.syncMemories(), 200);
const debouncedSyncNotes = debounce(() => appStore.syncNotes(), 200);
const debouncedSyncBorrowed = debounce(() => appStore.syncBorrowedItems(), 150);
const debouncedSyncAttendance = debounce(() => appStore.syncAttendanceAndReports(), 200);
const debouncedSyncSnaps = debounce(() => appStore.syncSnaps(), 150);
const debouncedSyncAppSettings = debounce(() => appStore.syncAppSettings(), 300);
const debouncedSyncNotifications = debounce(() => appStore.syncNotifications(), 150);

let activeChannel: any = null;
let subscriptionCount = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let notificationCallback: ((notif: any) => void) | null = null;
let isOnlineListenerAttached = false;

function teardownActiveChannel() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (activeChannel && supabase) {
    try {
      supabase.removeChannel(activeChannel);
    } catch (e) {
      console.warn('Notice removing realtime channel:', e);
    }
    activeChannel = null;
  }
}

function initializeRealtimeChannel() {
  if (!isSupabaseConfigured || !supabase) return;

  // Ensure no existing channel conflict
  teardownActiveChannel();

  try {
    const channel = supabase
      .channel('friend-os-universal-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          debouncedSyncMessages();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        () => {
          debouncedSyncMessages();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reads' },
        () => {
          debouncedSyncMessageReads();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.new && (payload.new as any).id) {
            const mapped = mapProfileFromSupabase(payload.new);
            appStore.handleRemoteProfileUpdate(mapped);
          } else {
            debouncedSyncProfiles();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_groups' },
        () => {
          debouncedSyncProfiles();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        () => {
          debouncedSyncProfiles();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => {
          debouncedSyncProfiles();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loans' },
        () => {
          debouncedSyncExpensesAndLoans();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          debouncedSyncExpensesAndLoans();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_participants' },
        () => {
          debouncedSyncExpensesAndLoans();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_qr' },
        () => {
          debouncedSyncProfiles();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plans' },
        () => {
          debouncedSyncPlans();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plan_participants' },
        () => {
          debouncedSyncPlans();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => {
          debouncedSyncPlans();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_options' },
        () => {
          debouncedSyncPlans();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes' },
        () => {
          debouncedSyncPlans();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memories' },
        () => {
          debouncedSyncMemories();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memory_photos' },
        () => {
          debouncedSyncMemories();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memory_media' },
        () => {
          debouncedSyncMemories();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memory_tags' },
        () => {
          debouncedSyncMemories();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        () => {
          debouncedSyncNotes();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'note_files' },
        () => {
          debouncedSyncNotes();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'borrowed_items' },
        () => {
          debouncedSyncBorrowed();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          debouncedSyncAttendance();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_reports' },
        () => {
          debouncedSyncAttendance();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'snaps' },
        () => {
          debouncedSyncSnaps();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'snap_recipients' },
        () => {
          debouncedSyncSnaps();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        () => {
          debouncedSyncAppSettings();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          const notif = payload.new as any;
          const currentUserId = appStore.currentUser?.id;
          if (notif && (!currentUserId || notif.user_id === currentUserId)) {
            debouncedSyncNotifications();
            if (notificationCallback && payload.eventType === 'INSERT') {
              notificationCallback(notif);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('⚡ FRIEND OS Realtime Connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`Realtime channel status: ${status}. Scheduling recovery...`);
          if (!reconnectTimeout && subscriptionCount > 0) {
            reconnectTimeout = setTimeout(() => {
              reconnectTimeout = null;
              if (subscriptionCount > 0) {
                initializeRealtimeChannel();
              }
            }, 3000);
          }
        }
      });

    activeChannel = channel;
  } catch (err) {
    console.warn('Realtime channel initialization note:', err);
  }
}

/**
 * Universal Realtime Subscription manager.
 * Returns an unsubscription function. Handles ref-counting so only 1 channel exists.
 */
export function subscribeToAllRealtimeTables(
  onNotificationReceived?: (notif: any) => void
) {
  if (onNotificationReceived) {
    notificationCallback = onNotificationReceived;
  }

  subscriptionCount++;

  if (subscriptionCount === 1 || !activeChannel) {
    initializeRealtimeChannel();
  }

  // Attach online listener once to auto-recover when network returns
  if (!isOnlineListenerAttached && typeof window !== 'undefined') {
    isOnlineListenerAttached = true;
    window.addEventListener('online', () => {
      console.log('🌐 Network restored: Re-syncing and reconnecting realtime...');
      appStore.syncFromSupabase();
      if (subscriptionCount > 0) {
        initializeRealtimeChannel();
      }
    });
  }

  return () => {
    subscriptionCount = Math.max(0, subscriptionCount - 1);
    if (subscriptionCount === 0) {
      teardownActiveChannel();
      notificationCallback = null;
    }
  };
}
