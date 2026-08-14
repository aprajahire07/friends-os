import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SnapMessage } from '../types';
import { validateUploadFile } from './storage';

// In-memory cache for signed URLs for snaps
const snapSignedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Uploads an actual image File directly to the private 'snaps' Supabase Storage bucket.
 * Generates a unique, non-colliding storage path per snap.
 */
export async function uploadSnapImage(
  file: File,
  senderId: string,
  onProgress?: (percent: number) => void
): Promise<{ storagePath: string; error?: string }> {
  if (!file) {
    return { storagePath: '', error: 'No image file provided.' };
  }

  // Validate format and size
  const validation = validateUploadFile(file, ['image']);
  if (!validation.valid) {
    return { storagePath: '', error: validation.error || 'Please select a valid image (JPEG, PNG, WEBP, HEIC).' };
  }

  if (onProgress) onProgress(15);

  if (!isSupabaseConfigured || !supabase) {
    return { 
      storagePath: '', 
      error: 'Supabase is not configured. Please check your Supabase credentials in settings.' 
    };
  }

  // Generate unique storage path: snaps/{sender_id}/{timestamp}_{random}_{filename}
  const cleanSenderId = senderId.replace(/[^a-zA-Z0-9-]/g, '') || 'user';
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  const filePath = `${cleanSenderId}/${timestamp}_${randomStr}_${cleanFileName}`;

  if (onProgress) onProgress(35);

  try {
    const { data, error } = await supabase.storage
      .from('snaps')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg'
      });

    if (error) {
      console.error('Supabase snaps storage upload error:', error);
      return { 
        storagePath: '', 
        error: `Couldn't upload snap to storage: ${error.message}. Please try again.` 
      };
    }

    if (onProgress) onProgress(80);
    const finalPath = data?.path || filePath;
    return { storagePath: finalPath };
  } catch (err: any) {
    console.error('Exception uploading snap image:', err);
    return { 
      storagePath: '', 
      error: err.message || "Couldn't upload snap. Please check connection and try again." 
    };
  }
}

/**
 * Resolves a private storage path from the 'snaps' bucket to an authorized signed URL for viewing.
 */
export async function getSnapSignedUrl(
  storagePathOrUrl?: string | null,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (!storagePathOrUrl) return '';

  // Already a full web URL or data URL
  if (
    storagePathOrUrl.startsWith('http://') ||
    storagePathOrUrl.startsWith('https://') ||
    storagePathOrUrl.startsWith('data:')
  ) {
    return storagePathOrUrl;
  }

  // Blob URLs are sender-local only - fallback if any
  if (storagePathOrUrl.startsWith('blob:')) {
    return storagePathOrUrl;
  }

  if (!isSupabaseConfigured || !supabase) {
    return storagePathOrUrl;
  }

  // Check in-memory cache
  const cacheKey = `snaps:${storagePathOrUrl}`;
  const cached = snapSignedUrlCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60000) {
    return cached.url;
  }

  try {
    const { data, error } = await supabase.storage
      .from('snaps')
      .createSignedUrl(storagePathOrUrl, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.warn('Could not create signed URL for snap, trying public fallback:', error?.message);
      const { data: pubData } = supabase.storage.from('snaps').getPublicUrl(storagePathOrUrl);
      return pubData?.publicUrl || storagePathOrUrl;
    }

    snapSignedUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: now + expiresInSeconds * 1000
    });

    return data.signedUrl;
  } catch (err) {
    console.warn('Error creating snap signed URL:', err);
    return storagePathOrUrl;
  }
}

/**
 * Removes a file from the 'snaps' bucket if needed (e.g. on cleanup or failed db insert).
 */
export async function deleteSnapStorageFile(storagePath: string): Promise<boolean> {
  if (!storagePath || !isSupabaseConfigured || !supabase) return false;
  if (storagePath.startsWith('http') || storagePath.startsWith('blob:') || storagePath.startsWith('data:')) {
    return true;
  }

  try {
    const { error } = await supabase.storage.from('snaps').remove([storagePath]);
    if (error) {
      console.warn('Error deleting snap storage file:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception deleting snap storage file:', err);
    return false;
  }
}

export async function fetchSnapsFromSupabase(userId: string): Promise<SnapMessage[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let data: any[] | null = null;
    const { data: primaryData, error: primaryErr } = await supabase
      .from('snaps')
      .select('*, sender_profile:sender_id(*)')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (primaryErr || !primaryData) {
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('snaps')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (fallbackErr) {
        console.warn('Supabase fetchSnaps error:', fallbackErr.message);
        return null;
      }
      data = fallbackData;
    } else {
      data = primaryData;
    }

    return (data || []).map((s: any) => ({
      id: s.id,
      sender_id: s.sender_id,
      recipient_id: s.receiver_id || s.recipient_id,
      image_url: s.status === 'expired' ? '' : (s.storage_path || s.image_url),
      caption: s.caption,
      sent_at: s.created_at || s.sent_at,
      delivered_at: s.delivered_at,
      opened_at: s.opened_at,
      expires_at: s.expires_at,
      status: s.status,
      sender_profile: s.sender_profile
    }));
  } catch (err) {
    console.warn('Failed to fetch snaps:', err);
    return null;
  }
}

export async function sendSnapToSupabase(
  senderId: string, 
  recipientId: string, 
  storagePath: string, 
  caption?: string
): Promise<SnapMessage | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('snaps')
      .insert([{
        sender_id: senderId,
        receiver_id: recipientId,
        storage_path: storagePath,
        caption: caption || null,
        status: 'sent'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error inserting snap record into Supabase:', error.message);
      return null;
    }

    return {
      id: data.id,
      sender_id: data.sender_id,
      recipient_id: data.receiver_id,
      image_url: data.storage_path,
      caption: data.caption,
      sent_at: data.created_at,
      status: data.status,
      sender_profile: null
    };
  } catch (err) {
    console.error('Failed to send snap record to database:', err);
    return null;
  }
}

export async function openSnapInSupabase(snapId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('snaps')
      .update({
        status: 'opened',
        opened_at: new Date().toISOString()
      })
      .eq('id', snapId);

    if (error) {
      console.error('Error marking snap as opened:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to mark snap as opened in Supabase:', err);
    return false;
  }
}

export async function destroySnapInSupabase(snapId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase
      .from('snaps')
      .update({
        storage_path: '',
        status: 'expired',
        expires_at: new Date().toISOString()
      })
      .eq('id', snapId);

    if (error) {
      console.error('Error expiring snap in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to expire snap:', err);
    return false;
  }
}
