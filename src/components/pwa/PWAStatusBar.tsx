import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Smartphone, X, Download } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

interface PWAStatusBarProps {
  onOpenInstallModal: () => void;
}

export const PWAStatusBar: React.FC<PWAStatusBarProps> = ({ onOpenInstallModal }) => {
  const { isOnline, hasUpdate, isStandalone, canInstall, isIOS, isAndroid, applyUpdate } = usePWA();
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    return sessionStorage.getItem('pwa_install_banner_dismissed') === 'true';
  });

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    sessionStorage.setItem('pwa_install_banner_dismissed', 'true');
  };

  return (
    <>
      {/* 1. Offline Notice Banner */}
      {!isOnline && (
        <div className="bg-amber-950/90 border-b border-amber-800/80 text-amber-200 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 backdrop-blur-md shadow-md animate-in slide-in-from-top duration-200 z-50">
          <WifiOff className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
          <span>You are currently offline. Live data sync will resume as soon as connection is restored.</span>
        </div>
      )}

      {/* 2. New Version Update Prompt */}
      {hasUpdate && (
        <div className="bg-gradient-to-r from-indigo-900/95 via-purple-900/95 to-pink-900/95 border-b border-indigo-700/80 text-white px-4 py-2.5 text-xs font-medium flex items-center justify-between gap-3 shadow-xl backdrop-blur-md z-50 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
            </span>
            <span className="font-bold">A new version of Friend OS is ready!</span>
          </div>
          <button
            type="button"
            onClick={applyUpdate}
            className="px-3 py-1 bg-white text-indigo-900 font-extrabold rounded-xl text-xs hover:bg-slate-100 transition-all flex items-center gap-1.5 shadow-md flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Update Now</span>
          </button>
        </div>
      )}

      {/* 3. Subtle In-App Install Prompt Banner (Only when not standalone and not dismissed) */}
      {!isStandalone && !bannerDismissed && (canInstall || isIOS || isAndroid) && (
        <div className="bg-slate-900/90 border-b border-slate-800/90 px-4 py-2 text-xs flex items-center justify-between gap-2 text-slate-300 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
            <p className="truncate text-xs">
              <span className="font-bold text-white">Install Friend OS</span> for the best full-screen mobile experience.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onOpenInstallModal}
              className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shadow transition-all flex items-center gap-1.5"
            >
              <Download className="w-3 h-3" />
              <span>Install App</span>
            </button>
            <button
              type="button"
              onClick={handleDismissBanner}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Dismiss install banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
