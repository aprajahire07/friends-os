import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { appStore } from '../lib/store';
import { Profile } from '../types';

export function subscribeToAllRealtimeTables(
  onNotificationReceived?: (notif: any) => void
) {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('friend-os-universal-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      () => {
        appStore.syncMessages();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      (payload) => {
        if (payload.new) {
          appStore.handleRemoteProfileUpdate(payload.new as Profile);
        } else {
          appStore.syncProfiles();
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'loans' },
      () => {
        appStore.syncExpensesAndLoans();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expenses' },
      () => {
        appStore.syncExpensesAndLoans();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expense_participants' },
      () => {
        appStore.syncExpensesAndLoans();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'plans' },
      () => {
        appStore.syncPlans();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'plan_participants' },
      () => {
        appStore.syncPlans();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'polls' },
      () => {
        appStore.syncPlans();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'poll_votes' },
      () => {
        appStore.syncPlans();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'memories' },
      () => {
        appStore.syncMemories();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'memory_media' },
      () => {
        appStore.syncMemories();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'borrowed_items' },
      () => {
        appStore.syncBorrowedItems();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendance' },
      () => {
        appStore.syncAttendanceAndReports();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'class_reports' },
      () => {
        appStore.syncAttendanceAndReports();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'snaps' },
      () => {
        appStore.syncSnaps();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_settings' },
      () => {
        appStore.syncAppSettings();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      (payload) => {
        const notif = payload.new as any;
        if (notif && notif.user_id === appStore.currentUser.id) {
          appStore.syncNotifications();
          if (onNotificationReceived && payload.eventType === 'INSERT') {
            onNotificationReceived(notif);
          }
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('⚡ FRIEND OS Realtime Connected to all Supabase tables');
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
