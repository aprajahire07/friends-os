import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types';

export const FRIEND_OS_ADMIN_EMAIL = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FRIEND_OS_ADMIN_EMAIL) || 
  'aprajahire07@gmail.com';

// Correct SHA-256 for default '0000'
export const DEFAULT_PASSCODE_HASH = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0';
export const LEGACY_PASSCODE_HASH = '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a';

export function isUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export async function computeSha256(text: string): Promise<string> {
  const clean = text.trim();
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(clean);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    } catch {
      // Fallback below
    }
  }
  // Standard fallback
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `fallback-${Math.abs(hash).toString(16)}`;
}

export function isUserAdmin(profile?: Profile | null): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (profile.email && FRIEND_OS_ADMIN_EMAIL && profile.email.trim().toLowerCase() === FRIEND_OS_ADMIN_EMAIL.trim().toLowerCase()) {
    return true;
  }
  return false;
}

export interface MemoryLockSettings {
  is_locked: boolean;
  passcode_hash: string;
  updated_at?: string;
  updated_by?: string;
}

export async function fetchMemoryLockSettingsFromSupabase(): Promise<MemoryLockSettings | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'memories_lock')
      .maybeSingle();

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        console.info('Supabase: public.app_settings table not created yet. Using local state.');
      } else {
        console.warn('Notice while fetching memory lock settings:', error.message);
      }
      return null;
    }

    if (data && data.value) {
      const isLocked = data.value.is_locked !== undefined 
        ? Boolean(data.value.is_locked) 
        : data.value.locked !== undefined 
          ? Boolean(data.value.locked) 
          : true;

      let remoteHash = data.value.passcode_hash || DEFAULT_PASSCODE_HASH;
      if (remoteHash === LEGACY_PASSCODE_HASH) {
        remoteHash = DEFAULT_PASSCODE_HASH;
      }

      // Sync local storage caches
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('friend_os_memories_passcode_hash', remoteHash);
        localStorage.setItem('friend_os_memoriesPasscodeHash', JSON.stringify(remoteHash));
        localStorage.setItem('friend_os_memories_locked', String(isLocked));
        localStorage.setItem('friend_os_memoriesLocked', JSON.stringify(isLocked));
      }

      return {
        is_locked: isLocked,
        passcode_hash: remoteHash,
        updated_at: data.updated_at,
        updated_by: data.updated_by
      };
    }

    return null;
  } catch (err: any) {
    console.info('Using local memory lock settings (Supabase offline or unconfigured).');
    return null;
  }
}

export async function updateMemoryLockInSupabase(
  isLocked: boolean, 
  adminUserId?: string,
  passcodeHash?: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    // 1. Try dedicated toggle RPC first (preserves existing password)
    try {
      const { error: rpcErr } = await supabase.rpc('admin_toggle_memories_lock', {
        p_is_locked: isLocked
      });
      if (!rpcErr) return true;
    } catch {
      // Fallback
    }

    // 2. Try general update RPC
    try {
      const { error: rpcErr2 } = await supabase.rpc('admin_update_memories_security', {
        p_is_locked: isLocked,
        p_passcode_hash: passcodeHash || null
      });
      if (!rpcErr2) return true;
    } catch {
      // Fallback to table upsert
    }

    // 3. Direct table upsert fallback: fetch existing hash first to never overwrite with default!
    let existingHash = passcodeHash;
    if (!existingHash) {
      const { data: existingData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'memories_lock')
        .maybeSingle();

      if (existingData?.value?.passcode_hash) {
        existingHash = existingData.value.passcode_hash;
      } else {
        existingHash = (typeof localStorage !== 'undefined' && localStorage.getItem('friend_os_memories_passcode_hash')) || DEFAULT_PASSCODE_HASH;
      }
    }

    const payload: any = {
      is_locked: isLocked,
      passcode_hash: existingHash
    };

    const upsertObj: any = {
      key: 'memories_lock',
      value: payload,
      updated_at: new Date().toISOString()
    };
    if (adminUserId && isUUID(adminUserId)) {
      upsertObj.updated_by = adminUserId;
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert(upsertObj, { onConflict: 'key' });

    if (error) {
      console.warn('Notice updating memory lock in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.info('Memory lock saved locally.');
    return false;
  }
}

export async function updateMemoryPasscodeInSupabase(
  newPasscodeHash: string,
  adminUserId?: string,
  currentIsLocked?: boolean
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  const cleanHash = newPasscodeHash.trim().toLowerCase();

  try {
    // 1. Try dedicated set passcode RPC
    try {
      const { error: rpcErr } = await supabase.rpc('admin_set_memories_passcode', {
        p_passcode_hash: cleanHash
      });
      if (!rpcErr) return true;
    } catch {
      // Fallback
    }

    // 2. Try general update RPC
    try {
      const effectiveLocked = currentIsLocked !== undefined ? currentIsLocked : true;
      const { error: rpcErr2 } = await supabase.rpc('admin_update_memories_security', {
        p_is_locked: effectiveLocked,
        p_passcode_hash: cleanHash
      });
      if (!rpcErr2) return true;
    } catch {
      // Fallback to table upsert
    }

    // 3. Direct table upsert fallback
    let lockState = currentIsLocked;
    if (lockState === undefined) {
      const { data: existingData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'memories_lock')
        .maybeSingle();

      lockState = existingData?.value?.is_locked !== undefined ? Boolean(existingData.value.is_locked) : true;
    }

    const payload: any = {
      is_locked: lockState,
      passcode_hash: cleanHash
    };

    const upsertObj: any = {
      key: 'memories_lock',
      value: payload,
      updated_at: new Date().toISOString()
    };
    if (adminUserId && isUUID(adminUserId)) {
      upsertObj.updated_by = adminUserId;
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert(upsertObj, { onConflict: 'key' });

    if (error) {
      console.warn('Notice updating passcode in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.info('Passcode saved locally.');
    return false;
  }
}

export function getLocalBannedUserIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('friend_os_banned_user_ids');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isUserIdBannedLocally(userId: string): boolean {
  const ids = getLocalBannedUserIds();
  return ids.includes(userId);
}

export async function fetchBannedUserIdsFromSupabase(): Promise<string[]> {
  const localIds = getLocalBannedUserIds();
  if (!isSupabaseConfigured || !supabase) return localIds;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'banned_users')
      .maybeSingle();

    if (error) {
      return localIds;
    }

    if (data && data.value && Array.isArray(data.value.banned_user_ids)) {
      const merged = Array.from(new Set([...localIds, ...data.value.banned_user_ids]));
      if (typeof window !== 'undefined') {
        localStorage.setItem('friend_os_banned_user_ids', JSON.stringify(merged));
      }
      return merged;
    }

    return localIds;
  } catch (err) {
    return localIds;
  }
}

export async function updateBannedUserInSupabase(
  targetUserId: string,
  isBanned: boolean,
  adminUserId: string,
  reason?: string
): Promise<boolean> {
  const currentLocal = getLocalBannedUserIds();
  let updatedIds: string[];

  if (isBanned) {
    updatedIds = Array.from(new Set([...currentLocal, targetUserId]));
  } else {
    updatedIds = currentLocal.filter(id => id !== targetUserId);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('friend_os_banned_user_ids', JSON.stringify(updatedIds));
  }

  if (!isSupabaseConfigured || !supabase) return true;

  try {
    // Fetch latest remote banned_users record
    const { data } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'banned_users')
      .maybeSingle();

    let remoteIds: string[] = [];
    let reasons: Record<string, string> = {};

    if (data && data.value) {
      if (Array.isArray(data.value.banned_user_ids)) {
        remoteIds = data.value.banned_user_ids;
      }
      if (data.value.reasons) {
        reasons = { ...data.value.reasons };
      }
    }

    if (isBanned) {
      remoteIds = Array.from(new Set([...remoteIds, targetUserId]));
      if (reason) reasons[targetUserId] = reason;
    } else {
      remoteIds = remoteIds.filter(id => id !== targetUserId);
      delete reasons[targetUserId];
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'banned_users',
        value: {
          banned_user_ids: remoteIds,
          reasons,
          updated_at: new Date().toISOString()
        },
        updated_by: adminUserId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.info('Supabase: app_settings note for banned_users:', error.message);
    }

    return true;
  } catch (err) {
    return true;
  }
}

