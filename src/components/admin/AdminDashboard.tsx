import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Lock, 
  Wallet, 
  KeyRound, 
  BarChart3,
  ShieldAlert,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { UserManagementView } from './UserManagementView';
import { MemoriesSecurityView } from './MemoriesSecurityView';
import { MoneyHistoryView } from './MoneyHistoryView';
import { PasswordManagementView } from './PasswordManagementView';
import { SystemOverviewView } from './SystemOverviewView';
import { FRIEND_OS_ADMIN_EMAIL } from '../../services/appSettings';

interface AdminDashboardProps {
  onBackToHome?: () => void;
}

type AdminTab = 'users' | 'memories' | 'money' | 'passwords' | 'overview';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToHome }) => {
  useAppStore();
  const currentUser = appStore.currentUser;
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('users');

  const isAdmin = currentUser && (
    currentUser.role === 'admin' ||
    (currentUser.email && currentUser.email.toLowerCase() === FRIEND_OS_ADMIN_EMAIL.toLowerCase())
  );

  // Security gate: deny access if not admin
  if (!currentUser || !isAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-950/80 border border-rose-800 flex items-center justify-center text-rose-400">
          <ShieldAlert className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h3 className="text-xl font-black text-white">Access Denied</h3>
        <p className="text-xs text-slate-400">
          You do not have administrative clearance to view the FRIEND OS Admin Control Center.
        </p>
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-colors"
          >
            Return to Home
          </button>
        )}
      </div>
    );
  }

  const tabs = [
    { id: 'users' as AdminTab, label: 'User Management', icon: Users },
    { id: 'memories' as AdminTab, label: 'Memories Security', icon: Lock },
    { id: 'money' as AdminTab, label: 'Money History', icon: Wallet },
    { id: 'passwords' as AdminTab, label: 'Password Management', icon: KeyRound },
    { id: 'overview' as AdminTab, label: 'System Overview & Logs', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/50 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <ShieldCheck className="w-48 h-48 text-indigo-400" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                Root Authority
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {currentUser.email}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>⚙️ Admin Control Center</span>
            </h2>
            <p className="text-xs text-slate-300">
              Manage accounts, enforce memories lock, review audit logs, and oversee FRIEND OS security.
            </p>
          </div>

          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-all flex items-center gap-2 self-start sm:self-center"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to App</span>
            </button>
          )}
        </div>

        {/* Tab Navigation Navigation bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-5 mt-4 border-t border-slate-800/80 no-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeAdminTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveAdminTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-950/80 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content View */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        {activeAdminTab === 'users' && <UserManagementView />}
        {activeAdminTab === 'memories' && <MemoriesSecurityView />}
        {activeAdminTab === 'money' && <MoneyHistoryView />}
        {activeAdminTab === 'passwords' && <PasswordManagementView />}
        {activeAdminTab === 'overview' && <SystemOverviewView />}
      </div>
    </div>
  );
};
