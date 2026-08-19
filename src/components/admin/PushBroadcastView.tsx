import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Send, 
  Users, 
  UserCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone, 
  ExternalLink,
  Layers,
  Info,
  Radio,
  FileText,
  DollarSign,
  Camera,
  Calendar,
  MessageCircle,
  Clock,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { 
  sendPushNotification, 
  fetchPushSubscriptionsCount,
  showLocalTestNotification,
  isPushNotificationSupported,
  getPushPermissionState
} from '../../services/pushNotifications';

interface PushBroadcastViewProps {
  onSelectTab?: (tab: string) => void;
}

export const PushBroadcastView: React.FC<PushBroadcastViewProps> = () => {
  useAppStore();
  const profiles = appStore.profiles;
  const currentUser = appStore.currentUser;

  const [targetType, setTargetType] = useState<'all' | 'selected'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [title, setTitle] = useState('Friend OS Announcement');
  const [message, setMessage] = useState('');
  const [section, setSection] = useState<'home' | 'expenses' | 'money' | 'borrowed' | 'chat' | 'snaps' | 'memories' | 'notes' | 'plans' | 'attendance' | 'admin'>('home');
  
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    details?: string;
  }>({ type: null, message: '' });

  const [totalSubscribed, setTotalSubscribed] = useState<number | null>(null);
  const [isRefreshingCount, setIsRefreshingCount] = useState(false);

  const loadSubscribedCount = async () => {
    setIsRefreshingCount(true);
    const count = await fetchPushSubscriptionsCount();
    setTotalSubscribed(count);
    setIsRefreshingCount(false);
  };

  useEffect(() => {
    loadSubscribedCount();
  }, []);

  const titlePresets = [
    '📢 Friend OS Announcement',
    '📚 New Notes Uploaded',
    '💰 Expense & Money Update',
    '📸 New Snap Shared',
    '📅 Outing & Plan Reminder',
    '🎓 College & Timetable Alert',
    '⚡ Important Group Update'
  ];

  const sectionsList = [
    { id: 'home', label: 'Home Dashboard', icon: Sparkles, color: 'text-indigo-400' },
    { id: 'notes', label: 'Study Notes & PDFs', icon: FileText, color: 'text-amber-400' },
    { id: 'expenses', label: 'Money & Expenses', icon: DollarSign, color: 'text-emerald-400' },
    { id: 'borrowed', label: 'Borrowed & Debts', icon: Layers, color: 'text-yellow-400' },
    { id: 'chat', label: 'Group Chat', icon: MessageCircle, color: 'text-cyan-400' },
    { id: 'snaps', label: 'Snaps & Camera', icon: Camera, color: 'text-rose-400' },
    { id: 'plans', label: 'Plans & Events', icon: Calendar, color: 'text-purple-400' },
    { id: 'attendance', label: 'Attendance & Timetable', icon: Clock, color: 'text-blue-400' },
  ];

  const handleToggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSelectAllUsers = () => {
    if (selectedUserIds.length === profiles.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(profiles.map(p => p.id));
    }
  };

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setSendStatus({
        type: 'error',
        message: 'Please enter both a notification title and message.'
      });
      return;
    }

    if (targetType === 'selected' && selectedUserIds.length === 0) {
      setSendStatus({
        type: 'error',
        message: 'Please select at least one recipient user.'
      });
      return;
    }

    setIsSending(true);
    setSendStatus({ type: null, message: '' });

    try {
      const result = await sendPushNotification({
        all: targetType === 'all',
        recipientUserIds: targetType === 'selected' ? selectedUserIds : undefined,
        title: title.trim(),
        body: message.trim(),
        section: section,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: {
          section: section,
          sentByAdmin: currentUser?.username || 'Admin',
          timestamp: Date.now()
        }
      });

      if (result.success) {
        setSendStatus({
          type: 'success',
          message: 'Web Push Broadcast Dispatched Successfully! 🚀',
          details: `Delivered to ${result.delivered ?? 0} device(s)${result.failed ? ` (${result.failed} failed)` : ''}${result.cleaned ? ` [Cleaned ${result.cleaned} stale subscriptions]` : ''}`
        });
        setMessage('');
        loadSubscribedCount();
      } else {
        setSendStatus({
          type: 'error',
          message: 'Failed to deliver push notification.',
          details: result.error || 'Check Supabase Edge Function `send-push` logs and secrets.'
        });
      }
    } catch (err: any) {
      setSendStatus({
        type: 'error',
        message: 'Push broadcast exception occurred.',
        details: err?.message || String(err)
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSelfTest = async () => {
    const sent = await showLocalTestNotification();
    if (sent) {
      setSendStatus({
        type: 'success',
        message: 'Device test notification displayed on your screen!',
        details: 'If you saw the system banner, your device service worker is configured perfectly.'
      });
    } else {
      setSendStatus({
        type: 'error',
        message: 'Could not display test notification on this device.',
        details: 'Make sure notification permissions are enabled in your browser settings or Profile -> Enable Notifications.'
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Info */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Bell className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <span>📢 Web Push Broadcast Center</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] uppercase tracking-wider font-extrabold">
                System Level Push
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Send REAL browser/PWA notifications that wake locked phone screens and display in system notification centers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSubscribedCount}
            disabled={isRefreshingCount}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCount ? 'animate-spin' : ''}`} />
            <span>Devices: <strong className="text-indigo-400">{totalSubscribed !== null ? totalSubscribed : '...'}</strong></span>
          </button>

          <button
            onClick={handleSelfTest}
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Test My Device</span>
          </button>
        </div>
      </div>

      {/* Main Broadcast Form & Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Controls (Left Column) */}
        <form onSubmit={handleSendPush} className="lg:col-span-7 space-y-5">
          {/* Target Audience */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>1. Target Audience</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  targetType === 'all'
                    ? 'bg-indigo-600/15 border-indigo-500/80 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full mt-0.5 flex items-center justify-center border ${
                  targetType === 'all' ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600'
                }`}>
                  {targetType === 'all' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="font-bold text-xs text-white">Everyone</div>
                  <div className="text-[11px] text-slate-400">All registered & subscribed group friends</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('selected')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  targetType === 'selected'
                    ? 'bg-indigo-600/15 border-indigo-500/80 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full mt-0.5 flex items-center justify-center border ${
                  targetType === 'selected' ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-600'
                }`}>
                  {targetType === 'selected' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="font-bold text-xs text-white">Specific Users</div>
                  <div className="text-[11px] text-slate-400">Pick individual friends ({selectedUserIds.length} chosen)</div>
                </div>
              </button>
            </div>

            {/* User Multi-select if 'selected' */}
            {targetType === 'selected' && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Select Recipients:</span>
                  <button
                    type="button"
                    onClick={handleSelectAllUsers}
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300"
                  >
                    {selectedUserIds.length === profiles.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {profiles.map((p) => {
                    const isSelected = selectedUserIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleToggleUser(p.id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-500/20 border border-indigo-500/40 text-white' : 'bg-slate-900 border border-slate-800/60 text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={p.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.username}`}
                            alt={p.full_name}
                            className="w-7 h-7 rounded-full border border-slate-700 object-cover"
                          />
                          <div>
                            <div className="font-bold text-xs leading-none">{p.full_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">@{p.username}</div>
                          </div>
                        </div>

                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-slate-700'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Title & Presets */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>2. Notification Title</span>
              <span className="text-[10px] font-normal text-slate-400">Presets below</span>
            </label>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Friend OS Announcement"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-bold focus:outline-none focus:border-indigo-500"
              required
            />

            {/* Presets Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {titlePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTitle(preset)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-semibold transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Message Body */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>3. Notification Message</span>
              <span className="text-[10px] font-mono text-slate-500">{message.length}/200 chars</span>
            </label>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the message that appears on phone lock screens..."
              rows={3}
              maxLength={200}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 resize-none"
              required
            />
          </div>

          {/* Target Section (Deep Link) */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider">
              4. Target Tab (Opens When Clicked)
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {sectionsList.map((sec) => {
                const isCurrent = section === sec.id;
                const IconComp = sec.icon;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setSection(sec.id as any)}
                    className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                      isCurrent
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <IconComp className={`w-4 h-4 ${sec.color}`} />
                    <span className="text-[11px] font-bold truncate max-w-full">{sec.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Message */}
          {sendStatus.type && (
            <div className={`p-4 rounded-xl flex items-start gap-3 border ${
              sendStatus.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/70 border-rose-800 text-rose-300'
            }`}>
              {sendStatus.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="space-y-0.5 text-xs">
                <div className="font-bold">{sendStatus.message}</div>
                {sendStatus.details && (
                  <div className="text-[11px] opacity-80">{sendStatus.details}</div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSending || !message.trim()}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white font-black text-sm tracking-wide shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Broadcasting to Phone System Gateways...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Push Notification to Phones 🚀</span>
              </>
            )}
          </button>
        </form>

        {/* Live Device System Notification Preview (Right Column) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 sticky top-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <span>Device System Preview</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-500">Android / iOS Tray</span>
            </div>

            {/* Mobile Notification Card Simulation */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-700/80 shadow-2xl space-y-3 relative overflow-hidden">
              {/* Top Bar of notification */}
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-indigo-600 flex items-center justify-center text-[9px] font-black text-white">
                    F
                  </div>
                  <span className="font-extrabold text-slate-200">Friend OS</span>
                  <span>•</span>
                  <span>just now</span>
                </div>

                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-indigo-300 font-mono">
                  {section.toUpperCase()}
                </span>
              </div>

              {/* Title & Body */}
              <div className="space-y-1">
                <div className="font-black text-xs text-white">
                  {title || 'Friend OS Announcement'}
                </div>
                <div className="text-xs text-slate-300 leading-relaxed break-words">
                  {message || 'Your notification message will appear here in the user\'s phone notification bar...'}
                </div>
              </div>

              {/* Action pill simulated */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-indigo-400 font-bold">
                <span className="flex items-center gap-1">
                  <span>Tap to open in {section}</span>
                </span>
                <span className="text-slate-500 font-mono">Vibrate: 2x</span>
              </div>
            </div>

            {/* Help & Architecture Explanations */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2 font-bold text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Security & Web Push Rules</span>
              </div>
              <ul className="space-y-1.5 text-[11px] list-disc list-inside text-slate-400">
                <li>Uses <strong>VAPID RFC 8292</strong> standard via Supabase Edge Function.</li>
                <li>Private VAPID key is safely kept on the server.</li>
                <li>Subscriptions of uninstalled/expired devices are cleaned automatically.</li>
                <li>Tapping the notification opens Friend OS and jumps right to the targeted tab.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
