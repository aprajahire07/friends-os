import React, { useState } from 'react';
import { 
  Users, 
  ShieldAlert, 
  CheckCircle, 
  Search, 
  UserX, 
  UserCheck, 
  Calendar, 
  Mail, 
  AlertTriangle,
  Lock
} from 'lucide-react';
import { Profile } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import { FRIEND_OS_ADMIN_EMAIL } from '../../services/appSettings';

export const UserManagementView: React.FC = () => {
  const { showToast } = useToast();
  useAppStore();
  
  const currentUser = appStore.currentUser;
  const profiles = appStore.profiles;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned'>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal confirmation state
  const [userToBan, setUserToBan] = useState<Profile | null>(null);
  const [banReason, setBanReason] = useState('');
  const [userToUnban, setUserToUnban] = useState<Profile | null>(null);

  // Filter profiles
  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = 
      p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.username.toLowerCase().includes(searchQuery.toLowerCase());

    const isBanned = Boolean(p.is_banned);
    if (filterStatus === 'active') return matchesSearch && !isBanned;
    if (filterStatus === 'banned') return matchesSearch && isBanned;
    return matchesSearch;
  });

  const handleConfirmBan = async () => {
    if (!userToBan || !currentUser) return;
    setIsProcessing(true);

    try {
      const success = await appStore.adminBanUser(userToBan.id, banReason);
      if (success) {
        showToast(
          'User Banned 🚫',
          `${userToBan.full_name} has been disabled. Their historical data is preserved.`,
          'info'
        );
      } else {
        showToast('Action Failed', 'Could not ban user. Please try again.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to ban user.', 'error');
    } finally {
      setIsProcessing(false);
      setUserToBan(null);
      setBanReason('');
    }
  };

  const handleConfirmUnban = async () => {
    if (!userToUnban || !currentUser) return;
    setIsProcessing(true);

    try {
      const success = await appStore.adminUnbanUser(userToUnban.id);
      if (success) {
        showToast(
          'User Restored ✅',
          `${userToUnban.full_name}'s account has been successfully re-activated.`,
          'success'
        );
      } else {
        showToast('Action Failed', 'Could not restore user account.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to unban user.', 'error');
    } finally {
      setIsProcessing(false);
      setUserToUnban(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>User Management ({profiles.length})</span>
          </h3>
          <p className="text-xs text-slate-400">
            View user status, join dates, and manage account access permissions.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              filterStatus === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({profiles.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              filterStatus === 'active'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active ({profiles.filter(p => !p.is_banned).length})
          </button>
          <button
            onClick={() => setFilterStatus('banned')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              filterStatus === 'banned'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Banned ({profiles.filter(p => p.is_banned).length})
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name, email, or username..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* User Table / Cards */}
      <div className="space-y-3">
        {filteredProfiles.length === 0 ? (
          <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-3xl text-xs text-slate-400">
            No users matched your filter criteria.
          </div>
        ) : (
          filteredProfiles.map(profile => {
            const isMasterAdmin = profile.email.toLowerCase() === FRIEND_OS_ADMIN_EMAIL.toLowerCase();
            const isBanned = Boolean(profile.is_banned);
            const joinDate = profile.created_at
              ? new Date(profile.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
              : 'Unknown';

            return (
              <div
                key={profile.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isBanned
                    ? 'bg-rose-950/20 border-rose-900/60'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* User Info */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`}
                      alt={profile.full_name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-700 bg-slate-900"
                    />
                    {isBanned && (
                      <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-rose-600 text-white">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white">{profile.full_name}</h4>
                      {isMasterAdmin && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700 text-indigo-300 font-extrabold text-[9px] uppercase">
                          ⚙️ Master Admin
                        </span>
                      )}
                      {isBanned ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-700 text-rose-400 font-bold text-[10px] flex items-center gap-1">
                          <UserX className="w-3 h-3" /> Banned
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{profile.email}</span>
                      </span>
                      <span className="font-mono text-slate-500">@{profile.username}</span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Calendar className="w-3 h-3" /> Joined {joinDate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {isMasterAdmin ? (
                    <span className="text-[11px] text-indigo-400 font-semibold px-3 py-1.5 rounded-xl bg-indigo-950/40 border border-indigo-900">
                      System Protected
                    </span>
                  ) : isBanned ? (
                    <button
                      onClick={() => setUserToUnban(profile)}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>✅ Unban</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setUserToBan(profile)}
                      className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 active:scale-95 text-rose-300 hover:text-white font-bold text-xs transition-all flex items-center gap-1.5"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>🚫 Ban</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal: BAN USER */}
      {userToBan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400">
                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Ban User: {userToBan.full_name}?
                </h3>
                <p className="text-xs text-slate-400 font-mono">{userToBan.email}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2 text-slate-300">
              <p>
                When banned, this user will be blocked from sending chat messages, posting snaps/memories, adding money transactions, and creating plans.
              </p>
              <p className="text-emerald-400 font-semibold text-[11px]">
                🛡️ Note: All existing user data (messages, friends, money history, memories) will remain stored safely.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Reason for Ban (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Inappropriate behavior, spam, requested pause"
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setUserToBan(null);
                  setBanReason('');
                }}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmBan}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <UserX className="w-4 h-4" />
                <span>{isProcessing ? 'Banning...' : 'CONFIRM BAN'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: UNBAN USER */}
      {userToUnban && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                <UserCheck className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Restore User: {userToUnban.full_name}?
                </h3>
                <p className="text-xs text-slate-400 font-mono">{userToUnban.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to unban <strong>{userToUnban.full_name}</strong>? They will immediately regain access to all normal FRIEND OS features.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setUserToUnban(null)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmUnban}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isProcessing ? 'Restoring...' : 'CONFIRM UNBAN'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
