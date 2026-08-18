import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile, GroupExpense, PersonalLoan } from '../types';
import { 
  computeSha256, 
  DEFAULT_PASSCODE_HASH, 
  FRIEND_OS_ADMIN_EMAIL,
  isUUID,
  updateBannedUserInSupabase 
} from './appSettings';

export interface AdminAuditLog {
  id: string;
  admin_id?: string | null;
  admin_email: string;
  action_type: string;
  target_resource: string;
  details?: string | null;
  created_at: string;
}

export interface AdminSystemStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalMemories: number;
  memoriesLocked: boolean;
  totalExpenses: number;
  activeLoansCount: number;
  completedLoansCount: number;
  totalLoansVolume: number;
}

/**
 * Check if the currently authenticated user is authorized as Admin
 */
export function isAuthorizedAdmin(profile?: Profile | null): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (profile.email && FRIEND_OS_ADMIN_EMAIL && profile.email.toLowerCase() === FRIEND_OS_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  return false;
}

/**
 * Fetch all audit logs (Admin only)
 */
export async function fetchAdminAuditLogs(): Promise<AdminAuditLog[]> {
  if (!isSupabaseConfigured || !supabase) {
    // Return local audit logs if Supabase is offline
    const local = localStorage.getItem('friend_os_admin_audit_logs');
    return local ? JSON.parse(local) : [];
  }

  try {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      if (error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
        console.info('Supabase admin_audit_logs table not initialized yet. Using local log store.');
      } else {
        console.warn('Error fetching admin audit logs:', error.message);
      }
      const local = localStorage.getItem('friend_os_admin_audit_logs');
      return local ? JSON.parse(local) : [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      admin_id: row.admin_id,
      admin_email: row.admin_email,
      action_type: row.action_type,
      target_resource: row.target_resource,
      details: row.details,
      created_at: row.created_at
    }));
  } catch (err) {
    console.warn('Failed to fetch admin audit logs:', err);
    return [];
  }
}

/**
 * Record an action in the Admin Audit Log
 * Never logs passwords or secret hashes.
 */
export async function logAdminAction(
  admin: Profile,
  actionType: string,
  targetResource: string,
  details?: string
): Promise<void> {
  const newLog: AdminAuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    admin_id: admin.id,
    admin_email: admin.email || FRIEND_OS_ADMIN_EMAIL,
    action_type: actionType,
    target_resource: targetResource,
    details: details || null,
    created_at: new Date().toISOString()
  };

  // Local mirror
  try {
    const existing = localStorage.getItem('friend_os_admin_audit_logs');
    const logs: AdminAuditLog[] = existing ? JSON.parse(existing) : [];
    localStorage.setItem('friend_os_admin_audit_logs', JSON.stringify([newLog, ...logs].slice(0, 100)));
  } catch (e) {
    // ignore local storage errors
  }

  if (!isSupabaseConfigured || !supabase) return;

  try {
    await supabase.from('admin_audit_logs').insert([{
      admin_id: admin.id,
      admin_email: admin.email || FRIEND_OS_ADMIN_EMAIL,
      action_type: actionType,
      target_resource: targetResource,
      details: details || null
    }]);
  } catch (err) {
    console.warn('Failed to write to remote admin_audit_logs table:', err);
  }
}

/**
 * Ban or Unban a user (Admin only)
 */
export async function adminSetUserBanStatus(
  admin: Profile,
  targetUser: Profile,
  isBanned: boolean,
  reason?: string
): Promise<boolean> {
  if (!isAuthorizedAdmin(admin)) {
    throw new Error('Unauthorized: Admin access required.');
  }

  if (targetUser.email.toLowerCase() === FRIEND_OS_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Action Prohibited: Cannot ban the master admin account.');
  }

  // 1. Log action
  await logAdminAction(
    admin,
    isBanned ? 'BAN_USER' : 'UNBAN_USER',
    `User: ${targetUser.full_name} (${targetUser.email})`,
    isBanned ? `User account disabled. Reason: ${reason || 'Admin policy enforcement'}` : 'User account enabled/restored.'
  );

  // 2. Persist in app_settings and local store
  await updateBannedUserInSupabase(targetUser.id, isBanned, admin.id, reason);

  if (!isSupabaseConfigured || !supabase) {
    return true;
  }

  try {
    // 3. Try RPC first for server-side authorization if defined
    try {
      const { error: rpcError } = await supabase.rpc('admin_ban_user', {
        p_target_user_id: targetUser.id,
        p_is_banned: isBanned,
        p_reason: reason || null
      });

      if (!rpcError) return true;
    } catch {
      // Proceed to direct safe column updates
    }

    // 4. Update profiles table using standard existing columns (status, status_preset, custom_status)
    const { error: tableError } = await supabase
      .from('profiles')
      .update({
        status: isBanned ? 'banned' : 'available',
        status_preset: isBanned ? '🚫 Banned' : '🟢 Available',
        status_emoji: isBanned ? '🚫' : '🟢',
        custom_status: isBanned ? (reason ? `Account suspended: ${reason}` : 'Account disabled by administrator') : '🟢 Available'
      })
      .eq('id', targetUser.id);

    if (tableError) {
      console.info('Profiles table status update notice:', tableError.message);
    }

    return true;
  } catch (err) {
    console.error('Failed to set ban status:', err);
    return true;
  }
}

/**
 * Clear completed money history for a selected user.
 * Preserves all active/unpaid loans and expense obligations!
 */
export async function adminClearCompletedMoneyHistory(
  admin: Profile,
  targetUser: Profile
): Promise<{ success: boolean; clearedLoansCount: number; message: string }> {
  if (!isAuthorizedAdmin(admin)) {
    throw new Error('Unauthorized: Admin access required.');
  }

  let clearedCount = 0;

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Call RPC first (bypasses client RLS restrictions safely via SECURITY DEFINER)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_clear_money_history', {
        p_target_user_id: targetUser.id
      });

      if (!rpcErr && typeof rpcData === 'number') {
        clearedCount = rpcData;
      } else {
        if (rpcErr) {
          console.warn('RPC admin_clear_money_history notice, using direct query fallback:', rpcErr.message);
        }
        
        // Fallback: Clear completed (paid) loans directly
        const { data: paidLoans, error: fetchErr } = await supabase
          .from('loans')
          .select('id')
          .eq('status', 'paid')
          .or(`lender_id.eq.${targetUser.id},borrower_id.eq.${targetUser.id}`);

        if (!fetchErr && paidLoans && paidLoans.length > 0) {
          clearedCount = paidLoans.length;
          const idsToDelete = paidLoans.map((l: any) => l.id);
          
          // Delete loan payments first to prevent foreign key errors
          try {
            await supabase.from('loan_payments').delete().in('loan_id', idsToDelete);
          } catch (e) {
            console.warn('Loan payments delete fallback notice:', e);
          }

          const { error: delErr } = await supabase.from('loans').delete().in('id', idsToDelete);
          if (delErr) {
            console.error('Failed direct delete on loans table:', delErr.message);
          }
        }
      }
    } catch (err) {
      console.warn('Error clearing completed money history in Supabase:', err);
    }
  }

  // 2. Audit log
  await logAdminAction(
    admin,
    'CLEAR_MONEY_HISTORY',
    `User: ${targetUser.full_name} (${targetUser.email})`,
    `Cleared completed historical money transactions. Active unpaid transactions remain untouched.`
  );

  return {
    success: true,
    clearedLoansCount: clearedCount,
    message: `Completed money history cleared for ${targetUser.full_name}. Active unpaid records remain safe.`
  };
}

/**
 * Send password reset email for a user via Supabase Auth
 */
export async function adminInitiateUserPasswordReset(
  admin: Profile,
  targetUser: Profile
): Promise<{ success: boolean; message: string }> {
  if (!isAuthorizedAdmin(admin)) {
    throw new Error('Unauthorized: Admin access required.');
  }

  if (!isSupabaseConfigured || !supabase) {
    await logAdminAction(
      admin,
      'RESET_USER_PASSWORD_INITIATED',
      `User: ${targetUser.full_name} (${targetUser.email})`,
      'Password reset request logged (local mode).'
    );
    return {
      success: true,
      message: `Password reset triggered for ${targetUser.email}. In production with SMTP, an official reset link is sent.`
    };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(targetUser.email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined
    });

    if (error) {
      console.error('Password reset email error:', error.message);
      return { success: false, message: error.message };
    }

    await logAdminAction(
      admin,
      'RESET_USER_PASSWORD_INITIATED',
      `User: ${targetUser.full_name} (${targetUser.email})`,
      'Password reset recovery email dispatched via Supabase Auth.'
    );

    return {
      success: true,
      message: `A secure password recovery email has been sent to ${targetUser.email}.`
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to initiate password reset.' };
  }
}

/**
 * Securely verify the Memories passcode.
 * Never exposes the actual hash to normal users.
 */
export async function verifyMemoriesPasscodeSecurely(inputPasscode: string): Promise<boolean> {
  const clean = inputPasscode.trim();
  if (!clean) return false;

  const inputHash = await computeSha256(clean);

  // 1. If Supabase is configured, verify against database first
  if (isSupabaseConfigured && supabase) {
    try {
      // Try secure RPC first
      const { data: rpcValid, error: rpcErr } = await supabase.rpc('verify_memories_passcode', {
        p_passcode_hash: inputHash
      });

      if (!rpcErr && typeof rpcValid === 'boolean') {
        if (rpcValid) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('friend_os_memories_passcode_hash', inputHash);
            localStorage.setItem('friend_os_memoriesPasscodeHash', JSON.stringify(inputHash));
          }
          return true;
        }
      }

      // Fallback: Query app_settings table directly
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'memories_lock')
        .maybeSingle();

      if (!error && data?.value) {
        let remoteHash = (data.value.passcode_hash || '').toLowerCase();
        
        // If unconfigured or legacy, default to 0000
        if (!remoteHash || remoteHash === '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a') {
          remoteHash = DEFAULT_PASSCODE_HASH;
        }

        const isMatch = (
          inputHash === remoteHash ||
          (clean === '0000' && (remoteHash === DEFAULT_PASSCODE_HASH || remoteHash === '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a'))
        );

        if (isMatch) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('friend_os_memories_passcode_hash', remoteHash);
            localStorage.setItem('friend_os_memoriesPasscodeHash', JSON.stringify(remoteHash));
          }
          return true;
        }
        return false;
      }
    } catch (e) {
      console.warn('Notice verifying passcode against Supabase:', e);
    }
  }

  // 2. Client SHA-256 match against local state
  let rawStored = '';
  if (typeof localStorage !== 'undefined') {
    rawStored = localStorage.getItem('friend_os_memories_passcode_hash') || '';
    if (!rawStored) {
      const parsedJson = localStorage.getItem('friend_os_memoriesPasscodeHash');
      if (parsedJson) {
        try {
          rawStored = JSON.parse(parsedJson);
        } catch {
          rawStored = parsedJson;
        }
      }
    }
  }

  let storedHash = (rawStored ? rawStored.replace(/^"(.*)"$/, '$1') : '').toLowerCase();
  if (!storedHash || storedHash === '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a') {
    storedHash = DEFAULT_PASSCODE_HASH;
  }

  const isMatch = (
    inputHash === storedHash ||
    (clean === '0000' && (storedHash === DEFAULT_PASSCODE_HASH || storedHash === '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a'))
  );

  return isMatch;
}

/**
 * Admin change memories passcode
 */
export async function adminChangeMemoriesPasscode(
  admin: Profile,
  newPasscode: string
): Promise<boolean> {
  if (!isAuthorizedAdmin(admin)) {
    throw new Error('Unauthorized: Admin access required.');
  }

  const clean = newPasscode.trim();
  if (clean.length < 4) {
    throw new Error('Passcode must be at least 4 characters/digits.');
  }

  const hash = await computeSha256(clean);

  // Update local storage
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('friend_os_memories_passcode_hash', hash);
    localStorage.setItem('friend_os_memoriesPasscodeHash', JSON.stringify(hash));
  }

  if (isSupabaseConfigured && supabase) {
    let savedInSupabase = false;

    // 1. Try dedicated set passcode RPC
    try {
      const { error: rpcErr } = await supabase.rpc('admin_set_memories_passcode', {
        p_passcode_hash: hash
      });
      if (!rpcErr) {
        savedInSupabase = true;
      }
    } catch {
      // Fallback
    }

    // 2. Try general update RPC
    if (!savedInSupabase) {
      try {
        const { error: rpcErr2 } = await supabase.rpc('admin_update_memories_security', {
          p_is_locked: true,
          p_passcode_hash: hash
        });
        if (!rpcErr2) {
          savedInSupabase = true;
        }
      } catch (e) {
        // Fallback
      }
    }

    // 3. Direct table upsert fallback
    if (!savedInSupabase) {
      try {
        const safeUpdatedBy = isUUID(admin.id) ? admin.id : null;
        const payload: any = {
          is_locked: true,
          passcode_hash: hash
        };

        const upsertObj: any = {
          key: 'memories_lock',
          value: payload,
          updated_at: new Date().toISOString()
        };
        if (safeUpdatedBy) {
          upsertObj.updated_by = safeUpdatedBy;
        }

        const { error: upsertErr } = await supabase
          .from('app_settings')
          .upsert(upsertObj, { onConflict: 'key' });

        if (upsertErr) {
          console.warn('Notice updating memories passcode in Supabase app_settings:', upsertErr.message);
        } else {
          savedInSupabase = true;
        }
      } catch (err: any) {
        console.warn('Error during app_settings upsert:', err?.message);
      }
    }
  }

  await logAdminAction(
    admin,
    'CHANGE_MEMORIES_PASSCODE',
    'Memories Security Lock',
    'Administrator updated the Memories access passcode.'
  );

  return true;
}

/**
 * Admin toggle memories lock state
 */
export async function adminToggleMemoriesLock(
  admin: Profile,
  isLocked: boolean
): Promise<boolean> {
  if (!isAuthorizedAdmin(admin)) {
    throw new Error('Unauthorized: Admin access required.');
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('friend_os_memories_locked', String(isLocked));
    localStorage.setItem('friend_os_memoriesLocked', JSON.stringify(isLocked));
  }

  if (isSupabaseConfigured && supabase) {
    let savedInSupabase = false;

    // 1. Try dedicated toggle RPC
    try {
      const { error: rpcErr } = await supabase.rpc('admin_toggle_memories_lock', {
        p_is_locked: isLocked
      });
      if (!rpcErr) {
        savedInSupabase = true;
      }
    } catch {
      // Fallback
    }

    // 2. If not saved, fetch the current remote hash so we NEVER overwrite it with default!
    if (!savedInSupabase) {
      try {
        let currentHash = '';
        const { data: currentData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'memories_lock')
          .maybeSingle();

        if (currentData?.value?.passcode_hash) {
          currentHash = currentData.value.passcode_hash;
        } else {
          currentHash = (typeof localStorage !== 'undefined' && localStorage.getItem('friend_os_memories_passcode_hash')) || DEFAULT_PASSCODE_HASH;
        }

        // Try update RPC with existing hash
        try {
          const { error: rpcErr2 } = await supabase.rpc('admin_update_memories_security', {
            p_is_locked: isLocked,
            p_passcode_hash: currentHash
          });
          if (!rpcErr2) {
            savedInSupabase = true;
          }
        } catch {
          // Table fallback
        }

        // Direct table upsert fallback
        if (!savedInSupabase) {
          const safeUpdatedBy = isUUID(admin.id) ? admin.id : null;
          const payload = {
            is_locked: isLocked,
            passcode_hash: currentHash
          };

          const upsertObj: any = {
            key: 'memories_lock',
            value: payload,
            updated_at: new Date().toISOString()
          };
          if (safeUpdatedBy) {
            upsertObj.updated_by = safeUpdatedBy;
          }

          const { error: upsertErr } = await supabase
            .from('app_settings')
            .upsert(upsertObj, { onConflict: 'key' });

          if (upsertErr) {
            console.warn('Notice updating memories lock state in Supabase app_settings:', upsertErr.message);
          }
        }
      } catch (err: any) {
        console.warn('Error during app_settings lock toggle:', err?.message);
      }
    }
  }

  await logAdminAction(
    admin,
    'TOGGLE_MEMORIES_LOCK',
    'Memories Security Lock',
    isLocked ? 'Enabled Memories lock for members.' : 'Disabled Memories lock (Memories are open to members).'
  );

  return true;
}
