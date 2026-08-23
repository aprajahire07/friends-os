import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface UserSecuritySettings {
  id?: string;
  user_id: string;
  auto_logout_enabled: boolean;
  auto_logout_seconds: number; // 0 (OFF), 30, 60, 300, 600, 1800, 3600
  logout_on_leave_enabled: boolean;
  hide_sensitive_information: boolean;
  created_at?: string;
  updated_at?: string;
}

export const AUTO_LOGOUT_OPTIONS = [
  { label: 'OFF', seconds: 0 },
  { label: '30 seconds', seconds: 30 },
  { label: '1 minute', seconds: 60 },
  { label: '5 minutes', seconds: 300 },
  { label: '10 minutes', seconds: 600 },
  { label: '30 minutes', seconds: 1800 },
  { label: '1 hour', seconds: 3600 }
];

export const DEFAULT_USER_SECURITY_SETTINGS = (userId: string): UserSecuritySettings => ({
  user_id: userId,
  auto_logout_enabled: false,
  auto_logout_seconds: 0,
  logout_on_leave_enabled: false,
  hide_sensitive_information: false,
});

/**
 * Fetch settings for a specific user from Supabase user_settings table
 */
export async function fetchUserSettingsFromSupabase(userId: string): Promise<UserSecuritySettings> {
  const fallback = DEFAULT_USER_SECURITY_SETTINGS(userId);
  if (!isSupabaseConfigured || !supabase || !userId) {
    return fallback;
  }

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // If table does not exist or schema issue, return clean default
      if (!error.message?.includes('does not exist') && !error.message?.includes('schema cache')) {
        console.warn('Notice fetching user settings from Supabase:', error.message);
      }
      return fallback;
    }

    if (data) {
      return {
        id: data.id,
        user_id: data.user_id,
        auto_logout_enabled: Boolean(data.auto_logout_enabled),
        auto_logout_seconds: Number(data.auto_logout_seconds) || 0,
        logout_on_leave_enabled: Boolean(data.logout_on_leave_enabled),
        hide_sensitive_information: Boolean(data.hide_sensitive_information),
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    }

    // If record doesn't exist yet, insert initial default
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          auto_logout_enabled: false,
          auto_logout_seconds: 0,
          logout_on_leave_enabled: false,
          hide_sensitive_information: false
        })
        .select('*')
        .maybeSingle();

      if (!insertError && inserted) {
        return {
          id: inserted.id,
          user_id: inserted.user_id,
          auto_logout_enabled: Boolean(inserted.auto_logout_enabled),
          auto_logout_seconds: Number(inserted.auto_logout_seconds) || 0,
          logout_on_leave_enabled: Boolean(inserted.logout_on_leave_enabled),
          hide_sensitive_information: Boolean(inserted.hide_sensitive_information),
          created_at: inserted.created_at,
          updated_at: inserted.updated_at,
        };
      }
    } catch {
      // Ignore insert race condition
    }

    return fallback;
  } catch (err: any) {
    console.warn('Error querying user_settings:', err?.message);
    return fallback;
  }
}

/**
 * Update user security and privacy settings in Supabase
 */
export async function saveUserSettingsToSupabase(
  userId: string, 
  settings: Partial<UserSecuritySettings>
): Promise<{ success: boolean; data?: UserSecuritySettings; error?: string }> {
  if (!userId) {
    return { success: false, error: 'User ID is required' };
  }

  const payload = {
    user_id: userId,
    ...(settings.auto_logout_enabled !== undefined && { auto_logout_enabled: settings.auto_logout_enabled }),
    ...(settings.auto_logout_seconds !== undefined && { auto_logout_seconds: settings.auto_logout_seconds }),
    ...(settings.logout_on_leave_enabled !== undefined && { logout_on_leave_enabled: settings.logout_on_leave_enabled }),
    ...(settings.hide_sensitive_information !== undefined && { hide_sensitive_information: settings.hide_sensitive_information }),
    updated_at: new Date().toISOString()
  };

  if (!isSupabaseConfigured || !supabase) {
    return { success: true, data: { ...DEFAULT_USER_SECURITY_SETTINGS(userId), ...payload } };
  }

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .maybeSingle();

    if (error) {
      console.warn('Failed to save user_settings to Supabase:', error.message);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: data ? {
        id: data.id,
        user_id: data.user_id,
        auto_logout_enabled: Boolean(data.auto_logout_enabled),
        auto_logout_seconds: Number(data.auto_logout_seconds) || 0,
        logout_on_leave_enabled: Boolean(data.logout_on_leave_enabled),
        hide_sensitive_information: Boolean(data.hide_sensitive_information),
        created_at: data.created_at,
        updated_at: data.updated_at,
      } : undefined
    };
  } catch (err: any) {
    console.error('Error saving user_settings:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}
