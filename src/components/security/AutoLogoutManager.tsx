import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';

export const AutoLogoutManager: React.FC = () => {
  const store = useAppStore();
  const { showToast } = useToast();
  const currentUser = store.currentUser;
  const userSettings = store.userSettings;

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  const lastActivityRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<any>(null);
  const warningModalOpenRef = useRef<boolean>(false);

  // Keep warningModalOpenRef in sync
  useEffect(() => {
    warningModalOpenRef.current = showWarningModal;
  }, [showWarningModal]);

  // Reset inactivity timer on user activity
  const handleUserActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (warningModalOpenRef.current) {
      // If user moved or pressed key while warning was shown, dismiss warning if desired
      // but explicit button click is preferred
    }
  }, []);

  const resetInactivity = () => {
    lastActivityRef.current = Date.now();
    setShowWarningModal(false);
  };

  const handlePerformLogout = useCallback((reason: string = 'inactivity') => {
    setShowWarningModal(false);
    appStore.logout();
    if (reason === 'inactivity') {
      showToast('Session Expired', 'You were automatically logged out due to inactivity.', 'info');
    }
  }, [showToast]);

  // Inactivity tracking effect
  useEffect(() => {
    if (!currentUser || !userSettings?.auto_logout_enabled || !userSettings?.auto_logout_seconds || userSettings.auto_logout_seconds <= 0) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setShowWarningModal(false);
      return;
    }

    const timeoutSeconds = userSettings.auto_logout_seconds;
    // Show warning 10 seconds before logout (or 5s if timeout <= 15s)
    const warningLeadSeconds = timeoutSeconds <= 15 ? 5 : timeoutSeconds <= 30 ? 10 : 15;
    lastActivityRef.current = Date.now();

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'pointerdown'];
    let lastRecordedActivity = Date.now();

    const throttledActivity = () => {
      const now = Date.now();
      if (now - lastRecordedActivity > 1000) {
        lastRecordedActivity = now;
        handleUserActivity();
      }
    };

    activityEvents.forEach(evt => {
      window.addEventListener(evt, throttledActivity, { passive: true });
    });

    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastActivityRef.current) / 1000);
      const remaining = timeoutSeconds - elapsedSeconds;

      if (remaining <= 0) {
        // Time is up -> log out immediately
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        handlePerformLogout('inactivity');
      } else if (remaining <= warningLeadSeconds) {
        // Approaching timeout -> show countdown warning modal
        setSecondsRemaining(remaining);
        setShowWarningModal(true);
      } else {
        if (warningModalOpenRef.current) {
          setShowWarningModal(false);
        }
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, throttledActivity);
      });
    };
  }, [currentUser?.id, userSettings?.auto_logout_enabled, userSettings?.auto_logout_seconds, handleUserActivity, handlePerformLogout]);

  // Logout When Leaving effect
  useEffect(() => {
    if (!currentUser || !userSettings?.logout_on_leave_enabled) return;

    // Mark current active session in sessionStorage
    try {
      sessionStorage.setItem('friend_os_active_session', currentUser.id);
    } catch {
      // Ignore
    }

    const handlePageHide = () => {
      // When page unloads / user closes window, if logout on leave is enabled
      try {
        sessionStorage.removeItem('friend_os_active_session');
      } catch {
        // Ignore
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [currentUser?.id, userSettings?.logout_on_leave_enabled]);

  if (!showWarningModal || !currentUser) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        id="auto-logout-warning-modal"
        className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-6 text-white shadow-2xl shadow-amber-950/40 flex flex-col items-center text-center space-y-4 animate-scaleUp"
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <h3 className="text-lg font-black tracking-tight text-white">
            Inactivity Warning ⏱️
          </h3>
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
            You have been inactive. For your security, you will be automatically signed out in:
          </p>
        </div>

        {/* Countdown Badge */}
        <div className="py-2.5 px-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-black text-2xl tracking-wider">
          {secondsRemaining}s
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
          <button
            id="stay-logged-in-btn"
            type="button"
            onClick={resetInactivity}
            className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Stay Logged In</span>
          </button>
          
          <button
            id="logout-now-btn"
            type="button"
            onClick={() => handlePerformLogout('manual')}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700/80 active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
