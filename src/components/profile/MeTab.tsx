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
  BookOpen
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { Profile } from '../../types';
import { StatusPicker } from '../friends/StatusPicker';
import { useToast } from '../ui/Toast';
import { FileUpload } from '../ui/FileUpload';
import { getSyncMediaUrl } from '../../services/storage';

interface MeTabProps {
  onSelectTab: (tab: string) => void;
  onOpenPaymentQR: (friend: Profile) => void;
  onOpenOnboarding: () => void;
}

export const MeTab: React.FC<MeTabProps> = ({
  onSelectTab,
  onOpenPaymentQR,
  onOpenOnboarding,
}) => {
  const { showToast } = useToast();
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
            <img
              src={resolvedAvatarUrl}
              alt={user.full_name}
              className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500/40 shadow-lg"
            />
            <button
              type="button"
              onClick={() => setShowAvatarModal(true)}
              className="absolute inset-0 rounded-full bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity backdrop-blur-xs"
              title="Change Profile Photo"
            >
              <Camera className="w-5 h-5" />
            </button>
            <span className="absolute -bottom-1 -right-1 text-sm bg-slate-950 p-0.5 rounded-full shadow">
              {user.status_emoji || '🟢'}
            </span>
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

        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <button
            onClick={() => onOpenPaymentQR(user)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>My Payment QR</span>
          </button>

          <button
            onClick={onOpenOnboarding}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition-all"
          >
            Edit Profile Setup
          </button>
        </div>
      </div>

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
            onClick={() => onSelectTab('exam_papers')}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 flex flex-col items-center gap-2 text-center transition-all group relative overflow-hidden"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">📚 Exam Papers</h4>
              <p className="text-[10px] text-slate-400">Previous papers & study</p>
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
