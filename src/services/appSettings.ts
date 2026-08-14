import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types';

export const FRIEND_OS_ADMIN_EMAIL = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FRIEND_OS_ADMIN_EMAIL) || 
  'aprajahire07@gmail.com';

// SHA-256 for default '0000'
export const DEFAULT_PASSCODE_HASH = '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a';

export async function computeSha256(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple hex encoding for edge cases
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `fallback-${Math.abs(hash).toString(16)}`;
}

export function isUserAdmin(profile?: Profile | null): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (profile.email && FRIEND_OS_ADMIN_EMAIL && profile.email.toLowerCase() === FRIEND_OS_ADMIN_EMAIL.toLowerCase()) {
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
  if (!isSupabaseConfigured) return null;

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
      return {
        is_locked: Boolean(data.value.is_locked),
        passcode_hash: data.value.passcode_hash || DEFAULT_PASSCODE_HASH,
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
  adminUserId: string,
  passcodeHash?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const payload: any = {
      is_locked: isLocked,
      passcode_hash: passcodeHash || DEFAULT_PASSCODE_HASH
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'memories_lock',
        value: payload,
        updated_by: adminUserId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        console.info('Supabase: app_settings table not in schema cache yet. Memory lock saved locally.');
      } else {
        console.warn('Notice updating memory lock in Supabase:', error.message);
      }
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
  adminUserId: string,
  currentIsLocked: boolean
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const payload: any = {
      is_locked: currentIsLocked,
      passcode_hash: newPasscodeHash
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'memories_lock',
        value: payload,
        updated_by: adminUserId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        console.info('Supabase: app_settings table not in schema cache yet. Passcode saved locally.');
      } else {
        console.warn('Notice updating passcode in Supabase:', error.message);
      }
      return false;
    }
    return true;
  } catch (err) {
    console.info('Passcode saved locally.');
    return false;
  }
}
