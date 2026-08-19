import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellRing, 
  BellOff, 
  Check, 
  AlertCircle, 
  RefreshCw,
  Smartphone
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

  const checkStatus = async () => {
    const status = getPushPermissionState();
    setPermissionStatus(status);
    
    // Automatically detect granted state in browser
    const locallyEnabled = localStorage.getItem(`friend_os_push_enabled_${userId}`) === 'true';
    if (status === 'granted') {
      setIsSubscribed(locallyEnabled || true);
    } else {
      setIsSubscribed(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [userId]);

  const handleToggle = async () => {
    if (!isPushNotificationSupported()) {
      showToast('Unsupported Browser', 'Web Push is not supported on this browser.', 'info');
      return;
    }

    if (permissionStatus === 'denied') {
      showToast('Notifications Blocked', 'Notifications are blocked in browser settings. Please allow notifications from your browser URL lock icon.', 'info');
      return;
    }

    setIsLoading(true);

    try {
      if (isSubscribed) {
        const res = await unsubscribeUserFromPush(userId);
        if (res.success) {
          setIsSubscribed(false);
          setPermissionStatus(getPushPermissionState());
          showToast('Notifications Disabled', 'Push notifications turned off for this device.', 'info');
        } else {
          showToast('Error', res.error || 'Failed to disable.', 'error');
        }
      } else {
        const res = await subscribeUserToPush(userId);
        if (res.success) {
          setIsSubscribed(true);
          setPermissionStatus('granted');
          showToast('Notifications Enabled ✓', 'Friend OS alerts are now active on your device.', 'success');
        } else {
          setPermissionStatus(res.status);
          if (res.status === 'denied') {
            showToast('Notifications Blocked', 'Notifications are blocked in browser settings.', 'info');
          } else {
            showToast('Notice', res.error || 'Could not enable push.', 'info');
          }
        }
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to update setting.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAlert = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await showLocalTestNotification();
    if (ok) {
      showToast('Test Alert Sent!', 'Check your phone notification tray.', 'success');
    }
  };

  const isUnsupported = !isPushNotificationSupported();
  const isBlocked = permissionStatus === 'denied';

  return (
    <div className="space-y-1.5">
      {/* Compact 1-Row Settings Item */}
      <div className="px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800/90 flex items-center justify-between gap-3 transition-colors hover:border-slate-700/80">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            isSubscribed 
              ? 'bg-emerald-500/10 text-emerald-400' 
              : isBlocked 
              ? 'bg-rose-500/10 text-rose-400' 
              : 'bg-slate-800 text-slate-400'
          }`}>
            {isSubscribed ? (
              <BellRing className="w-4 h-4" />
            ) : isBlocked ? (
              <BellOff className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span>Push Notifications</span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {isSubscribed 
                ? 'Device alerts active' 
                : isBlocked 
                ? 'Blocked in browser' 
                : isUnsupported 
                ? 'Unsupported on this device' 
                : 'Phone lock screen alerts'}
            </p>
          </div>
        </div>

        {/* Right-hand Compact Status / Action Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isUnsupported ? (
            <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-500 text-[11px] font-semibold">
              Unsupported
            </span>
          ) : isBlocked ? (
            <button
              onClick={() => showToast('Browser Blocked', 'Notifications are blocked in browser settings. Tap the padlock icon in your browser URL bar to allow.', 'info')}
              className="px-2.5 py-1 rounded-xl bg-rose-950/60 border border-rose-900 text-rose-300 text-[11px] font-bold flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              <span>Blocked</span>
            </button>
          ) : isSubscribed ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleTestAlert}
                title="Send quick test alert to this phone"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleToggle}
                disabled={isLoading}
                title="Click to disable"
                className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-[11px] font-bold flex items-center gap-1 transition-all"
              >
                <Check className="w-3 h-3" />
                <span>Enabled ✓</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleToggle}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm shadow-indigo-600/20 transition-all flex items-center gap-1"
            >
              {isLoading ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <span>Enable</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Short help text only if blocked in browser */}
      {isBlocked && (
        <p className="px-2 text-[10px] text-rose-400">
          Notifications are blocked in browser settings. Tap the lock icon in the address bar to unblock.
        </p>
      )}
    </div>
  );
};
