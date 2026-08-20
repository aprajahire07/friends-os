import React, { useState } from 'react';
import { 
  User, 
  GraduationCap, 
  Cake, 
  Wallet, 
  CalendarDays, 
  Images, 
  Backpack, 
  CheckCircle2, 
  Sparkles, 
  QrCode, 
  MapPin, 
  Camera, 
  X, 
  ShieldCheck, 
  Users, 
  FileText,
  Smartphone,
  Download
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { Profile } from '../../types';
import { StatusPicker } from '../friends/StatusPicker';
import { useToast } from '../ui/Toast';
import { FileUpload } from '../ui/FileUpload';
import { getSyncMediaUrl } from '../../services/storage';
import { isUserAdmin } from '../../services/appSettings';
import { Avatar } from '../ui/Avatar';
import { usePWA } from '../../hooks/usePWA';

interface MeTabProps {
  onSelectTab: (tab: string) => void;
  onOpenPaymentQR: (friend: Profile) => void;
  onOpenOnboarding: () => void;
  onOpenInstallPWA?: () => void;
}

export const MeTab: React.FC<MeTabProps> = ({
  onSelectTab,
  onOpenPaymentQR,
  onOpenOnboarding,
  onOpenInstallPWA,
}) => {
  const { showToast } = useToast();
  const { isStandalone } = usePWA();
  useAppStore();
  const user = appStore.currentUser;
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const resolvedAvatarUrl = user.avatar_url ? getSyncMediaUrl('avatars', user.avatar_url) : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80';

  // Birthdays calculation
  const today = new Date();
  const currentMonthNum = today.getMonth() + 1;
  const currentDay = today.getDate();

  const thisMonthBirthdays = appStore.profiles
    .map(p => {
      if (!p.birthday) return null;
      const parts = p.birthday.split('-');
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (m === currentMonthNum) {
        const daysToGo = d - currentDay;
        return {
          profile: p,
          daysToGo,
          dateStr: `${d} August`,
        };
      }
      return null;
    })
    .filter(Boolean) as { profile: Profile; daysToGo: number; dateStr: string }[];

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-12">
      {/* Profile Header Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0 group">
            <Avatar
              profile={user}
              src={user.avatar_url}
              name={user.full_name}
              username={user.username}
              size="xl"
              showStatus={true}
              statusEmoji={user.status_emoji || '🟢'}
              className="border-2 border-indigo-500/40 shadow-lg"
            />
            <button
              type="button"
              onClick={() => setShowAvatarModal(true)}
              className="absolute inset-0 rounded-full bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity backdrop-blur-xs"
              title="Change Profile Photo"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-white">{user.full_name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-indigo-400 font-mono">@{user.username}</p>
              <button
                type="button"
                onClick={() => setShowAvatarModal(true)}
                className="text-[10px] text-slate-400 hover:text-indigo-300 underline"
              >
                Change photo
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              🏫 {user.college} • Sem {user.semester}
            </p>
          </div>
        </div>

        {/* Current Live Status Banner & Compact Control */}
        <div className="mt-4 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Live Status:</span>
            <StatusPicker />
          </div>
          {user.current_location && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{user.current_location}</span>
            </span>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => onOpenPaymentQR(user)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>My Payment QR</span>
          </button>

          <div className="flex items-center gap-2">
            {!isStandalone && onOpenInstallPWA && (
              <button
                onClick={onOpenInstallPWA}
                className="px-3 py-1.5 rounded-xl bg-indigo-950/80 border border-indigo-700/70 hover:bg-indigo-900 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span>Install PWA</span>
              </button>
            )}

            <button
              onClick={onOpenOnboarding}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition-all"
            >
              Edit Profile Setup
            </button>
          </div>
        </div>
      </div>

      {/* PWA App Installation Card if not installed yet */}
      {!isStandalone && onOpenInstallPWA && (
        <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-800/50 rounded-3xl p-5 text-slate-100 shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                <span>Install Friend OS App</span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">PWA</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Add to your Android or iPhone home screen for fast fullscreen access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenInstallPWA}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 flex-shrink-0 transition-all active:scale-95"
          >
            Install
          </button>
        </div>
      )}

      {/* BIRTHDAYS THIS MONTH SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-slate-100 shadow-xl space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Cake className="w-4 h-4 text-pink-400" />
          <span>Birthdays This Month 🎂</span>
        </h3>

        {thisMonthBirthdays.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No upcoming birthdays this month.</p>
        ) : (
          <div className="space-y-2">
            {thisMonthBirthdays.map(item => (
              <div
                key={item.profile.id}
                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎂</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {item.profile.full_name} — {item.dateStr}
                    </h4>
                    <p className="text-[10px] text-pink-400 font-semibold mt-0.5">
                      "{item.daysToGo === 0 ? 'Today!' : item.daysToGo > 0 ? `${item.daysToGo} days to go` : 'Passed'}"
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MORE FEATURES & NAVIGATION */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          More Apps & Tools
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onSelectTab('ai')}
            className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/40 hover:border-indigo-400 flex flex-col items-center gap-2 text-center transition-all group shadow-lg shadow-indigo-950/50"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-indigo-600/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-white flex items-center justify-center gap-1">
                <span>AI 🤖</span>
              </h4>
              <p className="text-[10px] text-indigo-300 font-medium">Google Gemini AI</p>
            </div>
          </button>

          <button
            onClick={() => onSelectTab('college')}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 flex flex-col items-center gap-2 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">College Hub</h4>
              <p className="text-[10px] text-slate-400">Attendance & AI</p>
            </div>
          </button>

          <button
            onClick={() => onSelectTab('expenses')}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 flex flex-col items-center gap-2 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Money</h4>
              <p className="text-[10px] text-slate-400">Debts & Expenses</p>
            </div>
          </button>

          <button
            onClick={() => onSelectTab('plans')}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 flex flex-col items-center gap-2 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Plans</h4>
              <p className="text-[10px] text-slate-400">Group Outings</p>
            </div>
          </button>

          <button
            onClick={() => onSelectTab('memories')}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-pink-500/50 flex flex-col items-center gap-2 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Images className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Memories</h4>
              <p className="text-[10px] text-slate-400">Photo Albums</p>
            </div>
          </button>

          <button
            onClick={() => onSelectTab('borrowed')}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-violet-500/50 flex flex-col items-center gap-2 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Backpack className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Borrowed</h4>
              <p className="text-[10px] text-slate-400">Gadgets & Items</p>
            </div>
          </button>

          <button
            onClick={() => onSelectTab('notes')}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 flex flex-col items-center gap-2 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">📚 Notes</h4>
              <p className="text-[10px] text-slate-400">PDFs & Docs</p>
            </div>
          </button>

          {isUserAdmin(user) && (
            <button
              onClick={() => onSelectTab('admin')}
              className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-700/60 hover:border-indigo-500 flex flex-col items-center gap-2 text-center transition-all group shadow-lg shadow-indigo-950/50"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform border border-indigo-500/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-indigo-300">⚙️ Admin Center</h4>
                <p className="text-[10px] text-slate-400">Security & Users</p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Avatar Change Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-slate-100 shadow-2xl relative">
            <button
              onClick={() => setShowAvatarModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-4">
              <h3 className="text-base font-bold text-white">Update Profile Picture</h3>
              <p className="text-xs text-slate-400">Choose a new photo from gallery or take a selfie</p>
            </div>

            <FileUpload
              bucket="avatars"
              avatarMode={true}
              userId={user.id}
              currentPreviewUrl={resolvedAvatarUrl}
              onUploadComplete={(paths) => {
                if (paths.length > 0) {
                  appStore.updateUserProfile({ avatar_url: paths[0] });
                  showToast('Avatar Updated!', 'Your new profile picture has been saved.', 'success');
                  setShowAvatarModal(false);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
