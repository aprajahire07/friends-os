/**
 * Push Notifications Service — Disabled / No-op
 */

export type PushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface SendPushPayload {
  recipientUserIds?: string[];
  all?: boolean;
  title: string;
  body: string;
  section?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, any>;
}

export interface SendPushResult {
  success: boolean;
  delivered?: number;
  message?: string;
}

export function isPushNotificationSupported(): boolean {
  return false;
}

export function getPushPermissionState(): PushPermissionStatus {
  return 'default';
}

export async function getExistingPushSubscription(): Promise<any> {
  return null;
}

export async function subscribeUserToPush(_userId: string): Promise<{ success: boolean; status: PushPermissionStatus }> {
  return { success: true, status: 'default' };
}

export async function syncExistingPushSubscription(_userId: string): Promise<boolean> {
  return false;
}

export async function unsubscribeUserFromPush(_userId: string): Promise<{ success: boolean }> {
  return { success: true };
}

export async function showLocalTestNotification(): Promise<boolean> {
  return false;
}

export async function sendPushNotification(_payload: SendPushPayload): Promise<SendPushResult> {
  return { success: true, delivered: 0, message: 'Push notifications disabled' };
}

export async function queueServerNotificationEvents(_params: any): Promise<{ success: boolean; queued: number }> {
  return { success: true, queued: 0 };
}

export async function dispatchMoneyPushNotification(_params: any) {
  return Promise.resolve();
}

export async function dispatchBorrowedPushNotification(_params: any) {
  return Promise.resolve();
}

export async function dispatchSnapPushNotification(_params: any) {
  return Promise.resolve();
}

export async function dispatchPlanPushNotification(_params: any) {
  return Promise.resolve();
}

export async function dispatchNotePushNotification(_params: any) {
  return Promise.resolve();
}

export async function dispatchMemoryPushNotification(_params: any) {
  return Promise.resolve();
}

export async function dispatchChatPushNotification(_params: any) {
  return Promise.resolve();
}

export async function fetchPushSubscriptionsCount(): Promise<number> {
  return 0;
}
