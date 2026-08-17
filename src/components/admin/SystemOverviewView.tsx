import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  UserCheck, 
  UserX, 
  Images, 
  Wallet, 
  Lock, 
  Unlock, 
  Clock, 
  ShieldAlert, 
  RefreshCw, 
  FileText,
  Activity
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { AdminAuditLog, fetchAdminAuditLogs } from '../../services/admin';

export const SystemOverviewView: React.FC = () => {
  useAppStore();

  const profiles = appStore.profiles;
  const memories = appStore.memories;
  const loans = appStore.loans;
  const expenses = appStore.expenses;
  const isMemoriesLocked = appStore.memoriesLocked;

  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Statistics calculation
  const totalUsers = profiles.length;
  const activeUsers = profiles.filter(p => !p.is_banned).length;
  const bannedUsers = profiles.filter(p => Boolean(p.is_banned)).length;
  const totalMemoriesCount = memories.length;
  const activeLoans = loans.filter(l => l.status === 'pending' || l.status === 'payment_claimed');
  const completedLoans = loans.filter(l => l.status === 'paid');
  const totalLoanVolume = loans.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await fetchAdminAuditLogs();
      setAuditLogs(logs);
    } catch (e) {
      console.warn('Failed to refresh audit logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <span>System Overview & Admin Activity Log</span>
          </h3>
          <p className="text-xs text-slate-400">
            Real-time aggregate statistics and immutable security audit history.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={isLoadingLogs}
          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Total Users */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-indigo-400">
            <span className="text-xs font-bold text-slate-400">Total Users</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-white">{totalUsers}</p>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-emerald-400 font-bold">{activeUsers} Active</span>
            <span className="text-slate-600">•</span>
            <span className="text-rose-400 font-bold">{bannedUsers} Banned</span>
          </div>
        </div>

        {/* Memories Status */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-violet-400">
            <span className="text-xs font-bold text-slate-400">Memories</span>
            <Images className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-white">{totalMemoriesCount}</p>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            {isMemoriesLocked ? (
              <span className="text-rose-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <Unlock className="w-3 h-3" /> Open
              </span>
            )}
          </div>
        </div>

        {/* Expenses & Loans */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-bold text-slate-400">Money Loans</span>
            <Wallet className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-white">{loans.length}</p>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-amber-400 font-bold">{activeLoans.length} active</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-bold">{completedLoans.length} paid</span>
          </div>
        </div>

        {/* Loan Volume */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-bold text-slate-400">Total Volume</span>
            <Activity className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-white">₹{totalLoanVolume.toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-500 font-semibold">{expenses.length} group expenses</p>
        </div>
      </div>

      {/* Admin Audit Trail */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Admin Audit Trail ({auditLogs.length})</span>
          </h4>
          <span className="text-[10px] text-slate-500 font-semibold">
            Tracked security events
          </span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-3 sm:p-4 divide-y divide-slate-900 max-h-96 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No admin actions logged yet.
            </div>
          ) : (
            auditLogs.map(log => {
              const dateStr = log.created_at
                ? new Date(log.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'Just now';

              return (
                <div key={log.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono text-[10px] font-bold">
                        {log.action_type}
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {log.target_resource}
                      </span>
                    </div>

                    {log.details && (
                      <p className="text-xs text-slate-400">
                        {log.details}
                      </p>
                    )}

                    <p className="text-[10px] text-slate-500 font-mono">
                      By {log.admin_email}
                    </p>
                  </div>

                  <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{dateStr}</span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
