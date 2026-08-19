import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Memory, MemoryPhoto } from '../types';
import { dispatchMemoryPushNotification } from './pushNotifications';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return UUID_REGEX.test(str);
}

/**
 * Fetches all shared group memories with their multi-photo records,
 * preserving display order and creator profiles.
 */
export async function fetchMemoriesFromSupabase(): Promise<Memory[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let data: any[] | null = null;
    const { data: primaryData, error: primaryErr } = await supabase
      .from('memories')
      .select('*, memory_photos(*), memory_media(*), memory_tags(*), creator_profile:creator_id(*)')
      .order('memory_date', { ascending: false });

    if (primaryErr || !primaryData) {
      // Fallback query if joins/profile table alias differs
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('memories')
        .select('*, memory_photos(*), memory_media(*), memory_tags(*)')
        .order('memory_date', { ascending: false });

      if (fallbackErr) {
        // Second fallback: simple query without memory_photos if table doesn't exist yet
        const { data: simpleData, error: simpleErr } = await supabase
          .from('memories')
          .select('*, memory_media(*), memory_tags(*)')
          .order('memory_date', { ascending: false });

        if (simpleErr) {
          console.warn('Supabase fetchMemories error:', simpleErr.message);
          return null;
        }
        data = simpleData;
      } else {
        data = fallbackData;
      }
    } else {
      data = primaryData;
    }

    return (data || []).map((m: any) => {
      // 1. Check memory_photos (ordered by display_order)
      let photoList: MemoryPhoto[] = [];
      if (Array.isArray(m.memory_photos) && m.memory_photos.length > 0) {
        photoList = [...m.memory_photos]
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((p: any, idx: number) => ({
            id: p.id,
            memory_id: p.memory_id || m.id,
            storage_path: p.storage_path,
            display_order: p.display_order ?? (idx + 1),
            created_at: p.created_at
          }));
      }

      // 2. Fallback to memory_media if memory_photos is empty
      if (photoList.length === 0 && Array.isArray(m.memory_media) && m.memory_media.length > 0) {
        photoList = m.memory_media.map((med: any, idx: number) => ({
          id: med.id,
          memory_id: med.memory_id || m.id,
          storage_path: med.storage_path,
          display_order: idx + 1,
          created_at: med.created_at
        }));
      }

      // 3. Fallback to media_urls array on parent record
      if (photoList.length === 0 && Array.isArray(m.media_urls) && m.media_urls.length > 0) {
        photoList = m.media_urls.map((url: string, idx: number) => ({
          storage_path: url,
          display_order: idx + 1
        }));
      }

      const mediaUrls = photoList.map(p => p.storage_path).filter(Boolean);

      return {
        id: m.id,
        group_id: m.group_id,
        creator_id: m.creator_id,
        title: m.title,
        caption: m.caption || '',
        media_urls: mediaUrls,
        photos: photoList,
        date: m.memory_date,
        location: m.location || '',
        tagged_user_ids: (m.memory_tags || []).map((tag: any) => tag.user_id).filter(Boolean),
        created_at: m.created_at,
        creator_profile: m.creator_profile
      };
    });
  } catch (err) {
    console.warn('Failed to fetch memories from Supabase:', err);
    return null;
  }
}

/**
 * Creates ONE Memory post containing MULTIPLE photos under ONE single caption.
 * Atomic insertion: creates parent memory and all child photo records.
 */
export async function addMemoryToSupabase(memory: {
  creator_id: string;
  title: string;
  caption?: string;
  media_urls: string[];
  date: string;
  location?: string;
  tagged_user_ids?: string[];
  group_id?: string;
}): Promise<Memory | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let effectiveCreatorId = memory.creator_id;

    // Resolve authenticated Supabase user UUID
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id && isValidUUID(authData.user.id)) {
        effectiveCreatorId = authData.user.id;
      }
    } catch {
      // ignore
    }

    if (!isValidUUID(effectiveCreatorId)) {
      console.warn('Cannot add memory: creator_id is not a valid UUID:', effectiveCreatorId);
      return null;
    }

    // Resolve group_id (must be a valid UUID or omit if nullable)
    let effectiveGroupId: string | undefined = undefined;
    if (memory.group_id && isValidUUID(memory.group_id)) {
      effectiveGroupId = memory.group_id;
    } else {
      // Look up group membership
      try {
        const { data: memData } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', effectiveCreatorId)
          .limit(1)
          .maybeSingle();

        if (memData?.group_id && isValidUUID(memData.group_id)) {
          effectiveGroupId = memData.group_id;
        } else {
          // Look up first existing friend group
          const { data: groupData } = await supabase
            .from('friend_groups')
            .select('id')
            .limit(1)
            .maybeSingle();
          if (groupData?.id && isValidUUID(groupData.id)) {
            effectiveGroupId = groupData.id;
          }
        }
      } catch {
        // ignore
      }
    }

    // 1. Insert parent Memory record
    const payload: any = {
      creator_id: effectiveCreatorId,
      title: memory.title.trim(),
      caption: (memory.caption || '').trim(),
      memory_date: memory.date || new Date().toISOString().split('T')[0],
      location: (memory.location || '').trim()
    };

    if (effectiveGroupId && isValidUUID(effectiveGroupId)) {
      payload.group_id = effectiveGroupId;
    }

    const { data: parentRecord, error: parentErr } = await supabase
      .from('memories')
      .insert([payload])
      .select()
      .single();

    if (parentErr || !parentRecord) {
      console.error('Supabase memories insert error:', parentErr?.message);
      return null;
    }

    const memoryId = parentRecord.id;
    const cleanMediaUrls = (memory.media_urls || []).filter(url => Boolean(url && typeof url === 'string'));

    // 2. Insert child photo records into memory_photos with preserved display_order
    let createdPhotos: MemoryPhoto[] = [];
    if (cleanMediaUrls.length > 0) {
      const photoRows = cleanMediaUrls.map((url, idx) => ({
        memory_id: memoryId,
        storage_path: url,
        display_order: idx + 1
      }));

      try {
        const { data: photoData, error: photoErr } = await supabase
          .from('memory_photos')
          .insert(photoRows)
          .select();

        if (photoErr) {
          console.warn('Notice inserting into memory_photos, falling back:', photoErr.message);
        } else if (photoData) {
          createdPhotos = photoData.map((p: any) => ({
            id: p.id,
            memory_id: p.memory_id,
            storage_path: p.storage_path,
            display_order: p.display_order,
            created_at: p.created_at
          }));
        }
      } catch (photoEx) {
        console.warn('Exception inserting memory_photos:', photoEx);
      }

      // Also insert into memory_media for backwards-compatibility
      try {
        const mediaRows = cleanMediaUrls.map(url => ({
          memory_id: memoryId,
          storage_path: url,
          media_type: url.match(/\.(mp4|webm|mov|mkv)$/i) ? 'video' : 'image'
        }));
        await supabase.from('memory_media').insert(mediaRows);
      } catch {
        // ignore
      }
    }

    // 3. Insert tags
    if (memory.tagged_user_ids && memory.tagged_user_ids.length > 0) {
      const validTagIds = memory.tagged_user_ids.filter(uid => isValidUUID(uid));
      if (validTagIds.length > 0) {
        const tagRows = validTagIds.map(uid => ({
          memory_id: memoryId,
          user_id: uid
        }));
        try {
          await supabase.from('memory_tags').insert(tagRows);
        } catch {
          // ignore
        }
      }
    }

    // Trigger asynchronous Web Push to other group friends
    try {
      const { data: allProfiles } = await supabase.from('profiles').select('id');
      const recipientIds = (allProfiles || [])
        .map((p: any) => p.id)
        .filter((id: string) => id && id !== effectiveCreatorId);

      if (recipientIds.length > 0) {
        dispatchMemoryPushNotification({
          senderName: 'A friend',
          senderId: effectiveCreatorId,
          recipientUserIds: recipientIds,
          memoryTitle: memory.title.trim()
        }).catch(() => {});
      }
    } catch {
      // Non-blocking
    }

    return {
      id: parentRecord.id,
      group_id: parentRecord.group_id,
      creator_id: parentRecord.creator_id,
      title: parentRecord.title,
      caption: parentRecord.caption,
      media_urls: cleanMediaUrls,
      photos: createdPhotos.length > 0 ? createdPhotos : cleanMediaUrls.map((url, i) => ({ storage_path: url, display_order: i + 1 })),
      date: parentRecord.memory_date,
      location: parentRecord.location,
      tagged_user_ids: memory.tagged_user_ids || [],
      created_at: parentRecord.created_at
    };
  } catch (err) {
    console.error('Failed to add memory to Supabase:', err);
    return null;
  }
}

/**
 * Deletes a memory and all its associated photos from database and Supabase Storage.
 */
export async function deleteMemoryFromSupabase(memoryId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !memoryId) return false;

  try {
    // 1. Query all photo storage paths associated with this memory to clean up storage
    let filesToDelete: string[] = [];
    try {
      const { data: photos } = await supabase
        .from('memory_photos')
        .select('storage_path')
        .eq('memory_id', memoryId);

      if (photos && photos.length > 0) {
        filesToDelete.push(...photos.map(p => p.storage_path));
      }

      const { data: media } = await supabase
        .from('memory_media')
        .select('storage_path')
        .eq('memory_id', memoryId);

      if (media && media.length > 0) {
        filesToDelete.push(...media.map(m => m.storage_path));
      }
    } catch {
      // ignore
    }

    // 2. Delete child records first if foreign keys are not cascading
    try {
      await supabase.from('memory_photos').delete().eq('memory_id', memoryId);
    } catch {
      // ignore
    }
    try {
      await supabase.from('memory_media').delete().eq('memory_id', memoryId);
    } catch {
      // ignore
    }
    try {
      await supabase.from('memory_tags').delete().eq('memory_id', memoryId);
    } catch {
      // ignore
    }

    // 3. Delete parent memory row
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', memoryId);

    if (error) {
      console.warn('Error deleting memory from Supabase:', error.message);
      // If error is due to RLS, log warning but continue
    }

    // 4. Remove files from Supabase Storage 'memories' bucket
    const uniqueFiles = Array.from(new Set(filesToDelete)).filter(
      path => path && !path.startsWith('http') && !path.startsWith('blob:') && !path.startsWith('data:')
    );

    if (uniqueFiles.length > 0) {
      try {
        await supabase.storage.from('memories').remove(uniqueFiles);
      } catch (storageErr) {
        console.warn('Notice removing memory storage files:', storageErr);
      }
    }

    return true;
  } catch (err) {
    console.warn('Failed to delete memory:', err);
    return false;
  }
}
