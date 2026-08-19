import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellRing, 
  BellOff, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone, 
  RefreshCw, 
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { 
  isPushNotificationSupported, 
  getPushPermissionState, 
  subscribeUserToPush, 
  unsubscribeUserFromPush, 
  showLocalTestNotification,
  PushPermissionStatus
} from '../../services/pushNotifications';
import { useToast } from '../ui/Toast';

interface PushNotificationSettingsProps {
  userId: string;
}

export const PushNotificationSettings: React.FC<PushNotificationSettingsProps> = ({ userId }) => {
  const { showToast } = useToast();
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const checkStatus = () => {
    const status = getPushPermissionState();
    setPermissionStatus(status);
    const locallyEnabled = localStorage.getItem(`friend_os_push_enabled_${userId}`) === 'true';
    setIsSubscribed(status === 'granted' && locallyEnabled);
  };

  useEffect(() => {
    checkStatus();
  }, [userId]);

  const handleTogglePush = async () => {
    if (!isPushNotificationSupported()) {
      showToast('Unsupported Browser', 'Web Push is not supported on this browser or iOS version.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      if (isSubscribed) {
        // Unsubscribe
        const res = await unsubscribeUserFromPush(userId);
        if (res.success) {
          setIsSubscribed(false);
          setPermissionStatus(getPushPermissionState());
          showToast('Push Notifications Disabled', 'You will no longer receive system push alerts on this device.', 'info');
        } else {
          showToast('Error', res.error || 'Failed to unsubscribe.', 'error');
        }
      } else {
        // Subscribe
        const res = await subscribeUserToPush(userId);
        if (res.success) {
          setIsSubscribed(true);
          setPermissionStatus('granted');
          showToast('Notifications Activated! 🔔', 'Friend OS will now send live updates, snaps & plans to your phone system tray.', 'success');
        } else {
          setPermissionStatus(res.status);
          if (res.status === 'denied') {
            showToast('Permission Blocked', 'Please tap the lock icon in your browser URL bar to allow notifications.', 'error');
          } else {
            showToast('Subscription Note', res.error || 'Could not register push token.', 'info');
          }
        }
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to update push settings.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    const ok = await showLocalTestNotification();
    if (ok) {
      showToast('Test Notification Sent!', 'Check your phone or browser notification tray.', 'success');
    } else {
      showToast('Notification Blocked', 'Please enable notifications first to test.', 'info');
    }
  };

  if (!isPushNotificationSupported()) {
    return (
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
        <BellOff className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-slate-300">System Notifications Not Supported</div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            This browser does not support background Web Push. If you are on iPhone/iOS, add Friend OS to your Home Screen (Share → Add to Home Screen) to enable push notifications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 shadow-xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
            isSubscribed 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : permissionStatus === 'denied'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
          }`}>
            {isSubscribed ? (
              <BellRing className="w-5 h-5 animate-pulse" />
            ) : permissionStatus === 'denied' ? (
              <BellOff className="w-5 h-5" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Phone Push Notifications
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                isSubscribed
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : permissionStatus === 'denied'
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                {isSubscribed ? 'Active & Subscribed' : permissionStatus === 'denied' ? 'Blocked' : 'Not Enabled'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Allow Friend OS to send important updates, messages, snaps, plans and money notifications to your phone.
            </p>
          </div>
        </div>

        {/* Action Toggle / Enable Button */}
        <button
          onClick={handleTogglePush}
          disabled={isLoading}
          className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-md ${
            isSubscribed
              ? 'bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700'
              : permissionStatus === 'denied'
              ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
          }`}
        >
          {isLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : isSubscribed ? (
            <span>Disable</span>
          ) : (
            <span>Enable Phone Notifications</span>
          )}
        </button>
      </div>

      {/* When Granted & Active: Test Notification & Info */}
      {isSubscribed && (
        <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Ready for incoming Snaps, Money & Plan alerts</span>
          </div>

          <button
            onClick={handleTestNotification}
            type="button"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold text-[11px] border border-indigo-500/40 transition-colors self-start sm:self-auto"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Send Test Alert to Device</span>
          </button>
        </div>
      )}

      {/* When Blocked in Browser */}
      {permissionStatus === 'denied' && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-900/80 text-rose-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-[11px]">
            <span className="font-bold">Notifications are blocked in your browser settings.</span>
            <p className="text-slate-300">
              To fix: Tap the <strong>Padlock / Site settings</strong> icon in your browser search bar and set <em>Notifications</em> to <strong>Allow</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
