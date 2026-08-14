import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { FriendGroup, GroupMember, Profile } from '../types';

export async function fetchUserGroup(userId: string): Promise<{ group: FriendGroup; members: GroupMember[] } | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    // Check memberships for user
    const { data: membership, error: memErr } = await supabase
      .from('group_members')
      .select('group_id, role, status')
      .eq('user_id', userId)
      .maybeSingle();

    if (memErr) {
      console.warn('Error fetching user group membership:', memErr.message);
    }

    let groupId = membership?.group_id;

    // If no membership, fetch the first available group or default group
    if (!groupId) {
      const { data: firstGroup } = await supabase
        .from('friend_groups')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstGroup) {
        groupId = firstGroup.id;
        // Auto-join user to group as member
        await supabase
          .from('group_members')
          .upsert({
            group_id: groupId,
            user_id: userId,
            role: 'member',
            status: 'approved'
          }, { onConflict: 'group_id,user_id' });
      }
    }

    if (!groupId) return null;

    // Fetch group details
    const { data: groupData, error: groupErr } = await supabase
      .from('friend_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupErr || !groupData) return null;

    // Fetch members
    const { data: membersData } = await supabase
      .from('group_members')
      .select('*, profile:user_id(*)')
      .eq('group_id', groupId);

    const group: FriendGroup = {
      id: groupData.id,
      name: groupData.name,
      code: groupData.code,
      created_by: groupData.created_by,
      created_at: groupData.created_at
    };

    const members: GroupMember[] = (membersData || []).map((m: any) => ({
      id: m.id,
      group_id: m.group_id,
      user_id: m.user_id,
      status: m.status || 'approved',
      role: m.role || 'member',
      joined_at: m.joined_at,
      profile: m.profile
    }));

    return { group, members };
  } catch (err) {
    console.warn('Failed to fetch user group:', err);
    return null;
  }
}

export async function createGroupInSupabase(name: string, code: string, creatorId: string): Promise<FriendGroup | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data: group, error: groupErr } = await supabase
      .from('friend_groups')
      .insert([{
        name,
        code: code.trim().toUpperCase(),
        created_by: creatorId
      }])
      .select()
      .single();

    if (groupErr) {
      console.error('Error creating group in Supabase:', groupErr.message);
      return null;
    }

    // Add creator as admin member
    await supabase.from('group_members').insert([{
      group_id: group.id,
      user_id: creatorId,
      role: 'admin',
      status: 'approved'
    }]);

    // Also update creator profile role to admin if not already
    await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', creatorId);

    return {
      id: group.id,
      name: group.name,
      code: group.code,
      created_by: group.created_by,
      created_at: group.created_at
    };
  } catch (err) {
    console.error('Failed to create group:', err);
    return null;
  }
}

export async function joinGroupWithCodeInSupabase(code: string, userId: string): Promise<FriendGroup | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data: group, error: groupErr } = await supabase
      .from('friend_groups')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .single();

    if (groupErr || !group) {
      throw new Error('Invalid group code. Group not found.');
    }

    await supabase.from('group_members').upsert({
      group_id: group.id,
      user_id: userId,
      role: 'member',
      status: 'approved'
    }, { onConflict: 'group_id,user_id' });

    return {
      id: group.id,
      name: group.name,
      code: group.code,
      created_by: group.created_by,
      created_at: group.created_at
    };
  } catch (err: any) {
    console.error('Failed to join group:', err);
    throw err;
  }
}
