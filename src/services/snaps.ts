import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SnapMessage } from '../types';
import { validateUploadFile } from './storage';

// In-memory cache for signed URLs for snaps
const snapSignedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUUID(str?: string | null): boolean {
  if (!str) return false;
  return UUID_REGEX.test(str);
}

export interface SendSnapResult {
  success: boolean;
  snap?: SnapMessage;
  snaps?: SnapMessage[];
  error?: string;
}

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
        error: `Snap upload failed: ${error.message}` 
      };
    }

    if (onProgress) onProgress(80);
    const finalPath = data?.path || filePath;
    return { storagePath: finalPath };
  } catch (err: any) {
    console.error('Exception uploading snap image:', err);
    return { 
      storagePath: '', 
      error: `Snap upload failed: ${err.message || 'Network connection issue.'}` 
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

/**
 * Fetches all active and recent snaps relevant to the user (sent or received).
 * Fully backwards-compatible with standard public.snaps schema.
 */
export async function fetchSnapsFromSupabase(userId: string): Promise<SnapMessage[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let query = supabase
      .from('snaps')
      .select('*, sender_profile:sender_id(*)')
      .order('created_at', { ascending: false });

    if (isUUID(userId)) {
      query = query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    }

    const { data: snapsData, error: snapsErr } = await query;

    if (snapsErr) {
      console.warn('Notice fetching snaps with joins, trying fallback:', snapsErr.message);
      const fallbackQuery = isUUID(userId)
        ? supabase.from('snaps').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order('created_at', { ascending: false })
        : supabase.from('snaps').select('*').order('created_at', { ascending: false });

      const { data: fallbackData } = await fallbackQuery;
      if (!fallbackData) return null;
      return fallbackData.map((s: any) => ({
        id: s.id,
        sender_id: s.sender_id,
        recipient_id: s.receiver_id || '',
        recipient_ids: s.receiver_id ? [s.receiver_id] : [],
        is_everyone: false,
        image_url: s.status === 'expired' ? '' : (s.storage_path || s.image_url),
        caption: s.caption,
        view_duration: s.view_duration || 5,
        sent_at: s.created_at || s.sent_at,
        delivered_at: s.delivered_at,
        opened_at: s.opened_at,
        expires_at: s.expires_at,
        status: s.status || 'sent',
        sender_profile: s.sender_profile
      }));
    }

    if (!snapsData || snapsData.length === 0) {
      return [];
    }

    return snapsData.map((s: any) => ({
      id: s.id,
      sender_id: s.sender_id,
      recipient_id: s.receiver_id || '',
      recipient_ids: s.receiver_id ? [s.receiver_id] : [],
      is_everyone: false,
      image_url: s.status === 'expired' ? '' : (s.storage_path || s.image_url),
      caption: s.caption,
      view_duration: s.view_duration || 5,
      sent_at: s.created_at || s.sent_at,
      delivered_at: s.delivered_at,
      opened_at: s.opened_at,
      expires_at: s.expires_at,
      status: s.status || 'sent',
      sender_profile: s.sender_profile
    }));
  } catch (err) {
    console.warn('Failed to fetch snaps:', err);
    return null;
  }
}

/**
 * Sends a snap to either a single friend, multiple friends, or everyone in the group.
 * Backwards-compatible: inserts individual recipient rows into `public.snaps` so that
 * every recipient receives their own independent 1-time view status without requiring
 * experimental database columns.
 */
export async function sendSnapToSupabase(
  senderId: string, 
  recipientIdOrIds: string | string[], 
  storagePath: string, 
  caption?: string,
  viewDuration: number = 5,
  isEveryone: boolean = false
): Promise<SendSnapResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  // 1. Sanitize recipient IDs (must not be empty, must exclude sender)
  const recipientIds = Array.isArray(recipientIdOrIds) 
    ? recipientIdOrIds.filter(id => id && id !== senderId)
    : (recipientIdOrIds && recipientIdOrIds !== senderId ? [recipientIdOrIds] : []);

  console.log('[Snap Delivery] Sending snap request:', {
    senderId,
    recipientCount: recipientIds.length,
    recipientIds,
    isEveryone,
    storagePath
  });

  if (recipientIds.length === 0) {
    console.warn('[Snap Delivery] No eligible recipients found for sender:', senderId);
    return { success: false, error: 'No eligible friends were found in your group to receive the snap.' };
  }

  try {
    // 2. Insert master snap records into public.snaps (one row per recipient for independent viewing)
    const rowsToInsert = recipientIds.map(recId => {
      const row: any = {
        storage_path: storagePath,
        caption: caption || null,
        view_duration: viewDuration || 5,
        status: 'sent'
      };
      if (isUUID(senderId)) row.sender_id = senderId;
      if (isUUID(recId)) row.receiver_id = recId;
      return row;
    });

    const { data: createdRecords, error: snapError } = await supabase
      .from('snaps')
      .insert(rowsToInsert)
      .select();

    if (snapError || !createdRecords || createdRecords.length === 0) {
      console.error('[Snap Error] Supabase snaps insert error:', snapError);
      return { 
        success: false, 
        error: `Snap database insert failed: ${snapError?.message || 'Database error'}` 
      };
    }

    // Optional sync to snap_recipients if table exists in user's schema (safe catch)
    try {
      const recipientEntries = createdRecords
        .filter(r => isUUID(r.id) && isUUID(r.receiver_id))
        .map(r => ({
          snap_id: r.id,
          recipient_id: r.receiver_id,
          status: 'sent',
          delivered_at: new Date().toISOString()
        }));

      if (recipientEntries.length > 0) {
        await supabase.from('snap_recipients').insert(recipientEntries);
      }
    } catch {
      // Non-fatal if table doesn't exist
    }

    const formattedSnaps: SnapMessage[] = createdRecords.map((r: any) => ({
      id: r.id,
      sender_id: r.sender_id || senderId,
      recipient_id: r.receiver_id || '',
      recipient_ids: recipientIds,
      is_everyone: isEveryone || recipientIds.length > 1,
      image_url: r.storage_path,
      caption: r.caption,
      view_duration: r.view_duration || viewDuration || 5,
      sent_at: r.created_at || new Date().toISOString(),
      status: r.status || 'sent',
      sender_profile: null
    }));

    return { 
      success: true, 
      snap: formattedSnaps[0],
      snaps: formattedSnaps
    };
  } catch (err: any) {
    console.error('Failed to send snap record to database:', err);
    return { 
      success: false, 
      error: `Snap database insert failed: ${err.message || 'Unexpected database exception'}` 
    };
  }
}

/**
 * Marks a snap as opened by a specific recipient.
 */
export async function openSnapInSupabase(snapId: string, userId?: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  const now = new Date().toISOString();

  try {
    if (isUUID(snapId)) {
      await supabase
        .from('snaps')
        .update({
          status: 'opened',
          opened_at: now
        })
        .eq('id', snapId);
    }

    if (userId && isUUID(userId) && isUUID(snapId)) {
      try {
        await supabase
          .from('snap_recipients')
          .update({
            status: 'opened',
            opened_at: now
          })
          .eq('snap_id', snapId)
          .eq('recipient_id', userId);
      } catch {
        // safe ignore if table absent
      }
    }

    return true;
  } catch (err) {
    console.error('Failed to mark snap as opened in Supabase:', err);
    return false;
  }
}

/**
 * Destroys/expires a snap for a recipient after the 1-time view timer expires.
 */
export async function destroySnapInSupabase(snapId: string, userId?: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  const now = new Date().toISOString();

  try {
    if (isUUID(snapId)) {
      await supabase
        .from('snaps')
        .update({
          status: 'expired',
          expires_at: now
        })
        .eq('id', snapId);
    }

    if (userId && isUUID(userId) && isUUID(snapId)) {
      try {
        await supabase
          .from('snap_recipients')
          .update({
            status: 'expired',
            expires_at: now
          })
          .eq('snap_id', snapId)
          .eq('recipient_id', userId);
      } catch {
        // safe ignore if table absent
      }
    }

    return true;
  } catch (err) {
    console.error('Failed to expire snap:', err);
    return false;
  }
}
