import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://leozfdimmqqblquuazcj.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_OwANrJR92NdoVDlCvVPmpA_QQeKI58R';

// Retrieve credentials from Vite env or local settings override
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

const localUrl = typeof window !== 'undefined' ? localStorage.getItem('friend_os_supabase_url') || '' : '';
const localKey = typeof window !== 'undefined' ? localStorage.getItem('friend_os_supabase_key') || '' : '';

export const supabaseUrl = localUrl || envUrl || DEFAULT_SUPABASE_URL;
export const supabaseAnonKey = localKey || envKey || DEFAULT_SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') && 
  !supabaseUrl.includes('YOUR_SUPABASE')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Saves custom Supabase URL and Key in local storage and reloads
 */
export function saveSupabaseConfig(url: string, key: string) {
  if (url) {
    localStorage.setItem('friend_os_supabase_url', url.trim());
  } else {
    localStorage.removeItem('friend_os_supabase_url');
  }

  if (key) {
    localStorage.setItem('friend_os_supabase_key', key.trim());
  } else {
    localStorage.removeItem('friend_os_supabase_key');
  }

  window.location.reload();
}
