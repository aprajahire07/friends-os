import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Memory } from '../types';

export async function fetchMemoriesFromSupabase(): Promise<Memory[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('memories')
      .select('*, memory_media(*), memory_tags(*), creator_profile:creator_id(*)')
      .order('memory_date', { ascending: false });

    if (error) {
      console.warn('Supabase fetchMemories error:', error.message);
      return null;
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      group_id: m.group_id,
      creator_id: m.creator_id,
      title: m.title,
      caption: m.caption,
      media_urls: (m.memory_media || []).map((med: any) => med.storage_path),
      date: m.memory_date,
      location: m.location,
      tagged_user_ids: (m.memory_tags || []).map((tag: any) => tag.user_id),
      created_at: m.created_at,
      creator_profile: m.creator_profile
    }));
  } catch (err) {
    console.warn('Failed to fetch memories:', err);
    return null;
  }
}

export async function addMemoryToSupabase(memory: Partial<Memory>): Promise<Memory | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('memories')
      .insert([{
        group_id: memory.group_id,
        creator_id: memory.creator_id,
        title: memory.title,
        caption: memory.caption,
        memory_date: memory.date,
        location: memory.location
      }])
      .select('*, creator_profile:creator_id(*)')
      .single();

    if (error) {
      console.error('Error inserting memory:', error.message);
      return null;
    }

    if (memory.media_urls && memory.media_urls.length > 0) {
      const mediaRows = memory.media_urls.map(url => ({
        memory_id: data.id,
        storage_path: url,
        media_type: 'image'
      }));
      await supabase.from('memory_media').insert(mediaRows);
    }

    if (memory.tagged_user_ids && memory.tagged_user_ids.length > 0) {
      const tagRows = memory.tagged_user_ids.map(uid => ({
        memory_id: data.id,
        user_id: uid
      }));
      await supabase.from('memory_tags').insert(tagRows);
    }

    return {
      id: data.id,
      group_id: data.group_id,
      creator_id: data.creator_id,
      title: data.title,
      caption: data.caption,
      media_urls: memory.media_urls || [],
      date: data.memory_date,
      location: data.location,
      tagged_user_ids: memory.tagged_user_ids || [],
      created_at: data.created_at,
      creator_profile: data.creator_profile
    };
  } catch (err) {
    console.error('Failed to add memory:', err);
    return null;
  }
}
