import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types';
import { isUserIdBannedLocally, fetchBannedUserIdsFromSupabase } from './appSettings';

export function sanitizeCollege(college?: string): string {
  if (!college) return 'GHRCEMN';
  return college
    .replace(/\s*\/\s*GHRCE\s*\/\s*GHRSTU\)?/gi, ')')
    .replace(/\(GHRCE\/GHRSTU\)/gi, '')
    .replace(/\s*\/\s*GHRCE/gi, '')
    .replace(/\s*\/\s*GHRSTU/gi, '')
    .replace(/\(\s*\)/g, '')
    .trim();
}

export function mapProfileFromSupabase(row: any, bannedUserIds?: string[]): Profile {
  const isBanned = Boolean(
    row.is_banned === true ||
    row.status === 'banned' ||
    (bannedUserIds && bannedUserIds.includes(row.id)) ||
    isUserIdBannedLocally(row.id)
  );

  const emailLower = (row.email || '').toLowerCase().trim();
  let fullName = row.full_name || 'User';
  let username = row.username || 'user';

  // Override / Fix requested for shreyashjivtode2@gmail.com
  if (emailLower === 'shreyashjivtode2@gmail.com') {
    fullName = 'Shreyash jivtode';
    if (!row.username || row.username.toLowerCase() === 'apraj' || row.username.toLowerCase() === 'user') {
      username = 'shreyash';
    }
  }

  return {
    id: row.id,
    email: row.email || '',
    full_name: fullName,
    username: username,
    avatar_url: row.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80',
    birthday: row.birthday || '2004-09-15',
    college: sanitizeCollege(row.college),
    course_branch: row.course_branch || 'Computer Science & Engineering',
    semester: Number(row.semester) || 3,
    role: row.role === 'admin' ? 'admin' : 'member',
    status_emoji: isBanned ? '🚫' : (row.status_emoji || (row.status_preset ? row.status_preset.split(' ')[0] : '🟢')),
    status_preset: isBanned ? '🚫 Banned' : (row.status_preset || '🟢 Available'),
    status_text: row.status_text || row.custom_status || '',
    status_expires_at: row.status_expires_at || null,
    current_location: row.current_location || null,
    payment_qr_url: row.payment_qr_url || null,
    upi_id: row.upi_id || null,
    is_banned: isBanned,
    account_status: isBanned ? 'banned' : 'active',
    created_at: row.created_at || new Date().toISOString()
  };
}

export async function fetchProfilesFromSupabase(): Promise<Profile[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  
  try {
    const [profilesRes, bannedUserIds] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      fetchBannedUserIdsFromSupabase()
    ]);

    if (profilesRes.error) {
      console.warn('Supabase fetchProfiles error:', profilesRes.error.message);
      return null;
    }

    if (!profilesRes.data) return [];

    // Check if any database record for shreyashjivtode2@gmail.com needs updating in Supabase
    for (const row of profilesRes.data) {
      if (row.email && row.email.toLowerCase().trim() === 'shreyashjivtode2@gmail.com' && row.full_name !== 'Shreyash jivtode') {
        supabase.from('profiles').update({
          full_name: 'Shreyash jivtode',
          username: (!row.username || row.username.toLowerCase() === 'apraj') ? 'shreyash' : row.username
        }).eq('id', row.id).then(({ error }) => {
          if (error) console.warn('Sync Shreyash profile name in Supabase:', error.message);
          else console.log('✓ Successfully synced Shreyash jivtode name in Supabase database.');
        });
      }
    }

    return profilesRes.data.map(row => mapProfileFromSupabase(row, bannedUserIds));
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
      college: profile.college || 'GHRCEMN',
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
    const cleanPayload: Record<string, any> = {};
    if (updates.full_name !== undefined) cleanPayload.full_name = updates.full_name;
    if (updates.username !== undefined) cleanPayload.username = updates.username;
    if (updates.avatar_url !== undefined) cleanPayload.avatar_url = updates.avatar_url;
    if (updates.birthday !== undefined) cleanPayload.birthday = updates.birthday;
    if (updates.college !== undefined) cleanPayload.college = updates.college;
    if (updates.course_branch !== undefined) cleanPayload.course_branch = updates.course_branch;
    if (updates.semester !== undefined) cleanPayload.semester = updates.semester;
    if (updates.role !== undefined) cleanPayload.role = updates.role;
    if (updates.status_preset !== undefined) cleanPayload.status_preset = updates.status_preset;
    if (updates.status_emoji !== undefined) cleanPayload.status_emoji = updates.status_emoji;
    if (updates.status_text !== undefined) cleanPayload.custom_status = updates.status_text;
    if (updates.status_expires_at !== undefined) cleanPayload.status_expires_at = updates.status_expires_at;
    if (updates.current_location !== undefined) cleanPayload.current_location = updates.current_location;
    if (updates.payment_qr_url !== undefined) cleanPayload.payment_qr_url = updates.payment_qr_url;
    if (updates.upi_id !== undefined) cleanPayload.upi_id = updates.upi_id;
    if (updates.is_banned !== undefined) {
      cleanPayload.status = updates.is_banned ? 'banned' : 'available';
    }

    const { error } = await supabase
      .from('profiles')
      .update(cleanPayload)
      .eq('id', userId);

    if (error) {
      console.warn('Notice while updating profile in Supabase:', error.message);
      return false;
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

