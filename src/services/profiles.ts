import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types';

export function mapProfileFromSupabase(row: any): Profile {
  return {
    id: row.id,
    email: row.email || '',
    full_name: row.full_name || 'User',
    username: row.username || 'user',
    avatar_url: row.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80',
    birthday: row.birthday || '2004-09-15',
    college: row.college || 'GHRCE/GHRSTU',
    course_branch: row.course_branch || 'Computer Science & Engineering',
    semester: Number(row.semester) || 3,
    role: row.role === 'admin' ? 'admin' : 'member',
    status_emoji: row.status_emoji || (row.status_preset ? row.status_preset.split(' ')[0] : '🟢'),
    status_preset: row.status_preset || '🟢 Available',
    status_text: row.status_text || row.custom_status || '',
    status_expires_at: row.status_expires_at || null,
    current_location: row.current_location || null,
    payment_qr_url: row.payment_qr_url || null,
    upi_id: row.upi_id || null,
    created_at: row.created_at || new Date().toISOString()
  };
}

export async function fetchProfilesFromSupabase(): Promise<Profile[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetchProfiles error:', error.message);
      return null;
    }

    if (!data) return [];
    return data.map(mapProfileFromSupabase);
  } catch (err) {
    console.warn('Error fetching profiles from Supabase:', err);
    return null;
  }
}

export async function fetchProfileById(id: string): Promise<Profile | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn('Supabase fetchProfileById error:', error.message);
      return null;
    }

    if (!data) return null;
    return mapProfileFromSupabase(data);
  } catch (err) {
    console.warn('Error fetching profile by id:', err);
    return null;
  }
}

export async function createProfileInSupabase(profile: Partial<Profile> & { id: string; email: string; full_name: string }): Promise<Profile | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const payload = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      username: profile.username || profile.email.split('@')[0],
      avatar_url: profile.avatar_url || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80`,
      birthday: profile.birthday || '2004-09-15',
      college: profile.college || 'GHRCE/GHRSTU',
      course_branch: profile.course_branch || 'Computer Science & Engineering',
      semester: profile.semester || 3,
      role: profile.role || 'member',
      status_preset: profile.status_preset || '🟢 Available',
      status_emoji: profile.status_emoji || '🟢',
      status: 'available',
      custom_status: profile.status_text || '🟢 Available'
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating profile in Supabase:', error.message);
      return null;
    }

    return mapProfileFromSupabase(data);
  } catch (err) {
    console.error('Failed to create profile in Supabase:', err);
    return null;
  }
}

export async function updateProfileInSupabase(userId: string, updates: Partial<Profile>): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const payload: Record<string, any> = { ...updates };
    
    // Ensure backwards and schema compatibility across column naming
    if (updates.status_text !== undefined) {
      payload.status_text = updates.status_text;
      payload.custom_status = updates.status_text;
    }

    if (updates.status_preset !== undefined) {
      payload.status_preset = updates.status_preset;
      payload.status_emoji = updates.status_preset.split(' ')[0] || '🟢';
      payload.status = updates.status_preset.replace(/^[^\s]+\s*/, '').toLowerCase();
    }

    // Try update with full payload
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (error) {
      console.warn('First profile update attempt error, trying sanitized payload:', error.message);
      // Fallback: Remove non-standard fields if schema is strictly minimal
      const cleanPayload: Record<string, any> = {};
      if (updates.full_name) cleanPayload.full_name = updates.full_name;
      if (updates.avatar_url) cleanPayload.avatar_url = updates.avatar_url;
      if (updates.college) cleanPayload.college = updates.college;
      if (updates.course_branch) cleanPayload.course_branch = updates.course_branch;
      if (updates.semester) cleanPayload.semester = updates.semester;
      if (updates.status_preset) cleanPayload.status_preset = updates.status_preset;
      if (updates.status_emoji) cleanPayload.status_emoji = updates.status_emoji;
      if (updates.status_text) cleanPayload.custom_status = updates.status_text;
      if (updates.status_expires_at !== undefined) cleanPayload.status_expires_at = updates.status_expires_at;
      if (updates.current_location !== undefined) cleanPayload.current_location = updates.current_location;
      if (updates.payment_qr_url !== undefined) cleanPayload.payment_qr_url = updates.payment_qr_url;
      if (updates.upi_id !== undefined) cleanPayload.upi_id = updates.upi_id;

      const { error: retryErr } = await supabase
        .from('profiles')
        .update(cleanPayload)
        .eq('id', userId);

      if (retryErr) {
        console.error('Error updating profile in Supabase:', retryErr.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to update profile:', err);
    return false;
  }
}

export function subscribeToRealtimeProfiles(onProfileChange: (profile: Profile) => void) {
  if (!isSupabaseConfigured || !supabase) return () => {};

  const channel = supabase
    .channel('public:profiles:changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      (payload) => {
        if (payload.new && (payload.new as any).id) {
          const mapped = mapProfileFromSupabase(payload.new);
          onProfileChange(mapped);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

