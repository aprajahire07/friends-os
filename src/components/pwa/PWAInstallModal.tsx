import React from 'react';
import { Download, X, Smartphone, Share2, PlusSquare, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { canInstall, isStandalone, isIOS, promptInstall } = usePWA();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (canInstall) {
      const accepted = await promptInstall();
      if (accepted) {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glow Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-[2px]" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* App Icon & Title */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/25 flex-shrink-0 flex items-center justify-center">
            <img 
              src="/icons/icon-192.png" 
              alt="Friend OS Logo" 
              className="w-full h-full rounded-2xl object-cover"
              onError={(e) => {
                // Fallback SVG if image not rendered yet
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-lg font-black text-white tracking-tight">Friend OS</h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Install directly to your home screen for full app experience
            </p>
          </div>
        </div>

        {/* Features Checklist */}
        <div className="space-y-2.5 mb-6 bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Standalone full-screen app mode (no browser bar)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Instant launch from Android / iOS Home Screen</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Live real-time updates for chat, expenses & snaps</span>
          </div>
        </div>

        {/* Dynamic Instructions per Platform */}
        {isStandalone ? (
          <div className="p-3 bg-emerald-950/50 border border-emerald-800/60 rounded-2xl text-center">
            <p className="text-xs font-bold text-emerald-400">
              ✓ Friend OS is already installed in Standalone Mode!
            </p>
          </div>
        ) : isIOS ? (
          /* iOS Safari Guide */
          <div className="space-y-3">
            <p className="text-xs font-bold text-indigo-300">How to install on iPhone / iPad:</p>
            <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
              <li className="leading-relaxed">
                Tap the <span className="inline-flex items-center gap-1 font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700"><Share2 className="w-3 h-3 text-indigo-400" /> Share</span> icon in Safari's bottom toolbar.
              </li>
              <li className="leading-relaxed">
                Scroll down and tap <span className="inline-flex items-center gap-1 font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700"><PlusSquare className="w-3 h-3 text-indigo-400" /> Add to Home Screen</span>.
              </li>
              <li className="leading-relaxed">
                Tap <span className="font-bold text-white">Add</span> in the top-right corner to finish.
              </li>
            </ol>
          </div>
        ) : canInstall ? (
          /* Android / Chrome Automatic Install */
          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>Install Friend OS App</span>
          </button>
        ) : (
          /* Desktop or Android browser without automatic prompt */
          <div className="space-y-3 text-xs text-slate-300 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
            <p className="font-bold text-indigo-300 flex items-center gap-1">
              <Smartphone className="w-4 h-4" /> Install from Browser Menu:
            </p>
            <p className="leading-relaxed">
              Open your browser menu (⋮ in Chrome) and select <span className="font-bold text-white">"Install Friend OS"</span> or <span className="font-bold text-white">"Add to Home Screen"</span>.
            </p>
          </div>
        )}

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors py-1"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};
