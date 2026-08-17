import React, { useState } from 'react';
import { 
  KeyRound, 
  Send, 
  Mail, 
  Search, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { Profile } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';

export const PasswordManagementView: React.FC = () => {
  const { showToast } = useToast();
  useAppStore();

  const profiles = appStore.profiles;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const filteredProfiles = profiles.filter(p =>
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConfirmReset = async () => {
    if (!selectedUser) return;
    setIsProcessing(true);

    try {
      const result = await appStore.adminInitiateUserPasswordReset(selectedUser.id);
      if (result.success) {
        showToast(
          'Reset Email Sent 🔑',
          result.message || `Password recovery link dispatched to ${selectedUser.email}.`,
          'success'
        );
      } else {
        showToast('Reset Failed', result.message || 'Could not send reset email.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to trigger password reset.', 'error');
    } finally {
      setIsProcessing(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-black text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-indigo-400" />
          <span>User Password & Authentication Management</span>
        </h3>
        <p className="text-xs text-slate-400">
          Dispatch official Supabase Auth recovery and password reset links to members.
        </p>
      </div>

      {/* Difference Explanation Banner */}
      <div className="p-4 rounded-3xl bg-indigo-950/40 border border-indigo-900/60 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1 text-slate-300">
          <p className="font-bold text-white">
            Notice: Account Login Password vs. Memories Passcode
          </p>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            • <strong>Account Passwords:</strong> Individual credentials for user sign-in. Managed securely via Supabase Auth cryptographic recovery tokens. Plain passwords cannot be read by anyone (including Admins).<br />
            • <strong>Memories Passcode:</strong> Shared group privacy passcode. Configurable under the "Memories Security" tab.
          </p>
        </div>
      </div>

      {/* User Selection & Reset Action */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Select User */}
        <div className="md:col-span-6 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search user to reset password..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 max-h-96 overflow-y-auto space-y-1">
            {filteredProfiles.map(p => {
              const isSelected = selectedUser?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedUser(p)}
                  className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <img
                      src={p.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.username}`}
                      alt={p.full_name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700 bg-slate-900 shrink-0"
                    />
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{p.full_name}</p>
                      <p className={`text-[10px] truncate ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                        {p.email}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: User Card & Reset Flow */}
        <div className="md:col-span-6">
          {selectedUser ? (
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <img
                  src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedUser.username}`}
                  alt={selectedUser.full_name}
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-700 bg-slate-900"
                />
                <div>
                  <h4 className="text-sm font-black text-white">{selectedUser.full_name}</h4>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{selectedUser.email}</span>
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-2">
                <p>
                  Clicking the button below will trigger a secure password reset email sent directly to <strong>{selectedUser.email}</strong>.
                </p>
                <p className="text-[11px] text-slate-400">
                  The user can click the link in their inbox to safely set a new password without sharing any credentials.
                </p>
              </div>

              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={isProcessing}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Send Password Reset Email</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
              <KeyRound className="w-8 h-8 text-slate-600" />
              <p className="font-semibold text-slate-300">Select a user to reset password</p>
              <p className="text-[11px] text-slate-500">
                Choose an account to dispatch a secure password reset link.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-950/80 border border-indigo-800 text-indigo-400">
                <KeyRound className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Send Reset Link?
                </h3>
                <p className="text-xs text-slate-400 font-mono">{selectedUser.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to dispatch a password recovery link to <strong>{selectedUser.email}</strong>?
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>{isProcessing ? 'Sending...' : 'SEND EMAIL'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
