import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Users, 
  UserCheck, 
  Check, 
  AlertCircle, 
  Radio, 
  RefreshCw,
  Smartphone,
  ShieldCheck,
  Bell
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { 
  sendPushNotification, 
  fetchPushSubscriptionsCount,
  fetchPushDiagnostics,
  showLocalTestNotification,
  subscribeUserToPush
} from '../../services/pushNotifications';
import { useToast } from '../ui/Toast';

interface PushBroadcastViewProps {
  onSelectTab?: (tab: string) => void;
}

export const PushBroadcastView: React.FC<PushBroadcastViewProps> = () => {
  useAppStore();
  const profiles = appStore.profiles;
  const currentUser = appStore.currentUser;
  const { showToast } = useToast();

  const [targetType, setTargetType] = useState<'all' | 'selected'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [title, setTitle] = useState('Friend OS Update');
  const [message, setMessage] = useState('');
  const [targetSection, setTargetSection] = useState<'home' | 'chat' | 'money' | 'borrowed' | 'snaps' | 'memories' | 'notes' | 'plans' | 'attendance'>('home');
  
  const [isSending, setIsSending] = useState(false);
  const [isTestingLocal, setIsTestingLocal] = useState(false);
  const [sendResult, setSendResult] = useState<{
    type: 'success' | 'error' | null;
    text: string;
    warning?: string;
  }>({ type: null, text: '' });

  const [totalSubscribed, setTotalSubscribed] = useState<number | null>(null);
  const [diagnostics, setDiagnostics] = useState<{
    supported: boolean;
    permission: string;
    hasServiceWorker: boolean;
    hasBrowserSubscription: boolean;
    totalServerDevices: number;
    userServerDevices: number;
  } | null>(null);

  const loadSubscribedCount = async () => {
    const count = await fetchPushSubscriptionsCount();
    setTotalSubscribed(count);
    if (currentUser?.id) {
      const diag = await fetchPushDiagnostics(currentUser.id);
      setDiagnostics(diag);
    }
  };

  useEffect(() => {
    loadSubscribedCount();
  }, [currentUser?.id]);

  const handleTestLocalPush = async () => {
    setIsTestingLocal(true);
    try {
      if (currentUser?.id) {
        await subscribeUserToPush(currentUser.id);
      }
      const ok = await showLocalTestNotification();
      if (ok) {
        showToast('Push Test Sent', 'Local system test notification triggered via Service Worker!', 'success');
      } else {
        showToast('Permission Needed', 'Please enable push notifications in your browser or Me tab first.', 'error');
      }
    } catch (e: any) {
      showToast('Push Test Error', e?.message || 'Failed to trigger test notification', 'error');
    } finally {
      setIsTestingLocal(false);
      loadSubscribedCount();
    }
  };

  const availableTargets = [
    { id: 'home' as const, label: 'Home' },
    { id: 'chat' as const, label: 'Chat' },
    { id: 'money' as const, label: 'Money' },
    { id: 'borrowed' as const, label: 'Borrowed' },
    { id: 'snaps' as const, label: 'Snaps' },
    { id: 'memories' as const, label: 'Memories' },
    { id: 'notes' as const, label: 'Notes' },
    { id: 'plans' as const, label: 'Plans' },
    { id: 'attendance' as const, label: 'Attendance' },
  ];

  const handleToggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSending) return; // Spam protection

    if (!title.trim() || !message.trim()) {
      setSendResult({
        type: 'error',
        text: 'Please enter both Title and Message.'
      });
      return;
    }

    if (targetType === 'selected' && selectedUserIds.length === 0) {
      setSendResult({
        type: 'error',
        text: 'Please select at least one friend.'
      });
      return;
    }

    setIsSending(true);
    setSendResult({ type: null, text: '' });

    try {
      const res = await sendPushNotification({
        all: targetType === 'all',
        recipientUserIds: targetType === 'selected' ? selectedUserIds : undefined,
        title: title.trim(),
        body: message.trim(),
        section: targetSection,
        data: {
          section: targetSection,
          sentBy: currentUser?.username || 'Admin',
          sentAt: new Date().toISOString()
        }
      });

      if (res.success) {
        const delivered = res.delivered ?? 0;
        const failed = res.failed ?? 0;
        
        let successText = `✓ Notification dispatched`;
        if (delivered > 0) {
          successText = `✓ Sent to ${delivered} active ${delivered === 1 ? 'device' : 'devices'}`;
        } else if (res.message) {
          successText = `✓ Dispatched (${res.message})`;
        } else {
          successText = `✓ Dispatched (0 devices currently registered. Turn on notifications in Me tab)`;
        }
        
        let warnText: string | undefined = undefined;
        if (failed > 0) {
          warnText = `⚠ ${failed} device endpoint${failed === 1 ? '' : 's'} unavailable or expired`;
        }

        setSendResult({
          type: 'success',
          text: successText,
          warning: warnText
        });
        setMessage('');
        loadSubscribedCount();
        showToast('Push Dispatched', successText, 'success');
      } else {
        setSendResult({
          type: 'error',
          text: res.error || 'Failed to send notification.'
        });
        showToast('Push Error', res.error || 'Failed to dispatch push notification.', 'error');
      }
    } catch (err: any) {
      setSendResult({
        type: 'error',
        text: err?.message || 'Failed to dispatch push notification.'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Send Notification</h3>
            <p className="text-[11px] text-slate-400">
              System Web Push to friends' lock screens
            </p>
          </div>
        </div>

        {totalSubscribed !== null && (
          <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
            {totalSubscribed} {totalSubscribed === 1 ? 'device' : 'devices'} active
          </span>
        )}
      </div>

      {/* Main Form */}
      <form onSubmit={handleSendNotification} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        {/* Send To Radios */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300">Send to:</label>
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-200">
              <input
                type="radio"
                name="targetType"
                checked={targetType === 'all'}
                onChange={() => setTargetType('all')}
                className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500"
              />
              <span>Everyone</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-200">
              <input
                type="radio"
                name="targetType"
                checked={targetType === 'selected'}
                onChange={() => setTargetType('selected')}
                className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500"
              />
              <span>Selected friends</span>
            </label>
          </div>
        </div>

        {/* Selected Friends Picker */}
        {targetType === 'selected' && (
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Select recipients ({selectedUserIds.length} chosen):</span>
              <button
                type="button"
                onClick={() => {
                  if (selectedUserIds.length === profiles.length) {
                    setSelectedUserIds([]);
                  } else {
                    setSelectedUserIds(profiles.map(p => p.id));
                  }
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold"
              >
                {selectedUserIds.length === profiles.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {profiles.map(friend => {
                const isSelected = selectedUserIds.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => handleToggleUser(friend.id)}
                    className={`w-full px-3 py-1.5 rounded-xl text-left text-xs flex items-center justify-between transition-colors ${
                      isSelected 
                        ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30' 
                        : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <span className="truncate">{friend.full_name} (@{friend.username})</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">Title:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Friend OS Update"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Write your push notification message..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

        {/* Open when tapped */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">Open when tapped:</label>
          <select
            value={targetSection}
            onChange={(e) => setTargetSection(e.target.value as any)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
          >
            {availableTargets.map(t => (
              <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Result Message */}
        {sendResult.type && (
          <div className={`p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3 ${
            sendResult.type === 'success' 
              ? 'bg-emerald-950/40 border border-emerald-800/80 text-emerald-300' 
              : 'bg-rose-950/40 border border-rose-800/80 text-rose-300'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              {sendResult.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="break-words font-medium">{sendResult.text}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {sendResult.warning && (
                <span className="text-[11px] text-amber-400 font-mono">
                  {sendResult.warning}
                </span>
              )}
              {sendResult.type === 'error' && (
                <button
                  type="button"
                  onClick={(e) => handleSendNotification(e)}
                  className="px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-[11px] font-bold border border-rose-700/50 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          type="submit"
          disabled={isSending}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
        >
          {isSending ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Send Notification</span>
            </>
          )}
        </button>
      </form>

      {/* Push Infrastructure & Device Diagnostics */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Push Gateway & Device Status</span>
          </div>
          <button
            type="button"
            onClick={loadSubscribedCount}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-slate-400 block mb-0.5">Permission</span>
            <span className={`font-bold ${
              diagnostics?.permission === 'granted' 
                ? 'text-emerald-400' 
                : diagnostics?.permission === 'denied' 
                ? 'text-rose-400' 
                : 'text-amber-400'
            }`}>
              {diagnostics?.permission ? diagnostics.permission.toUpperCase() : 'CHECKING...'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-slate-400 block mb-0.5">Service Worker</span>
            <span className={`font-bold ${diagnostics?.hasServiceWorker ? 'text-emerald-400' : 'text-amber-400'}`}>
              {diagnostics?.hasServiceWorker ? 'ACTIVE (/sw.js)' : 'INACTIVE'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-slate-400 block mb-0.5">This Browser Push Sub</span>
            <span className={`font-bold ${diagnostics?.hasBrowserSubscription ? 'text-emerald-400' : 'text-slate-400'}`}>
              {diagnostics?.hasBrowserSubscription ? 'REGISTERED' : 'NOT SUBSCRIBED'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-slate-400 block mb-0.5">Total Server Devices</span>
            <span className="font-bold text-indigo-400">
              {diagnostics?.totalServerDevices ?? (totalSubscribed || 0)} registered
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTestLocalPush}
          disabled={isTestingLocal}
          className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors flex items-center justify-center gap-2"
        >
          <Bell className="w-3.5 h-3.5 text-indigo-400" />
          <span>{isTestingLocal ? 'Testing Local Push...' : 'Test Web Push On This Device'}</span>
        </button>
      </div>
    </div>
  );
};
