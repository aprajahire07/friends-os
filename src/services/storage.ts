import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type StorageBucket = 'avatars' | 'memories' | 'chat-media' | 'payment-qr' | 'snaps' | 'exam-papers';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileType: 'image' | 'video' | 'document' | 'unknown';
}

// In-memory cache for resolved signed URLs
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DOCUMENT_SIZE = 35 * 1024 * 1024; // 35MB

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/svg+xml'
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska'
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/zip'
];

/**
 * Validates a file against allowed MIME types, extensions, and size limits
 */
export function validateUploadFile(
  file: File, 
  allowedCategories: ('image' | 'video' | 'document')[] = ['image', 'video', 'document']
): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file provided.', fileType: 'unknown' };
  }

  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  const ext = fileName.split('.').pop() || '';

  let fileType: 'image' | 'video' | 'document' | 'unknown' = 'unknown';

  if (ALLOWED_IMAGE_TYPES.includes(mimeType) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'svg'].includes(ext)) {
    fileType = 'image';
  } else if (ALLOWED_VIDEO_TYPES.includes(mimeType) || ['mp4', 'webm', 'mov', 'mkv'].includes(ext)) {
    fileType = 'video';
  } else if (ALLOWED_DOCUMENT_TYPES.includes(mimeType) || ['pdf', 'doc', 'docx', 'txt', 'zip'].includes(ext)) {
    fileType = 'document';
  }

  if (fileType === 'unknown' || !allowedCategories.includes(fileType)) {
    const categoryLabels = allowedCategories.map(c => c === 'image' ? 'images (JPG, PNG, WEBP)' : c === 'video' ? 'videos (MP4, MOV)' : 'documents (PDF, DOC)').join(', ');
    return {
      valid: false,
      error: `Unsupported file format. Please upload: ${categoryLabels}`,
      fileType
    };
  }

  // Size checks
  if (fileType === 'image' && file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Image is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Limit is 15MB.`, fileType };
  }
  if (fileType === 'video' && file.size > MAX_VIDEO_SIZE) {
    return { valid: false, error: `Video is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Limit is 50MB.`, fileType };
  }
  if (fileType === 'document' && file.size > MAX_DOCUMENT_SIZE) {
    return { valid: false, error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Limit is 25MB.`, fileType };
  }

  return { valid: true, fileType };
}

/**
 * Uploads a file directly to Supabase Storage and returns the permanent storage path.
 */
export async function uploadFileToStorage(
  bucket: StorageBucket,
  file: File,
  userId?: string,
  onProgress?: (percent: number) => void
): Promise<{ storagePath: string; error?: string }> {
  const validation = validateUploadFile(file);
  if (!validation.valid) {
    return { storagePath: '', error: validation.error };
  }

  if (onProgress) onProgress(10);

  // Generate unique file path
  const ext = file.name.split('.').pop() || (validation.fileType === 'image' ? 'jpg' : 'bin');
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const userPrefix = userId ? userId.replace(/[^a-zA-Z0-9-]/g, '') : 'public';
  const filePath = `${userPrefix}/${timestamp}_${randomStr}_${safeName}`;

  if (onProgress) onProgress(30);

  try {
    if (!isSupabaseConfigured || !supabase) {
      // Fallback local object URL if Supabase client not configured
      const objectUrl = URL.createObjectURL(file);
      if (onProgress) onProgress(100);
      return { storagePath: objectUrl };
    }

    if (onProgress) onProgress(50);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.warn(`Supabase Storage upload warning in ${bucket}:`, error.message);
      return { storagePath: '', error: error.message || 'Upload failed. Please try again.' };
    }

    if (onProgress) onProgress(100);
    return { storagePath: data?.path || filePath };
  } catch (err: any) {
    console.error('File upload exception:', err);
    return { storagePath: '', error: err.message || 'Network error during upload. Please try again.' };
  }
}

/**
 * Resolves a storage path or external URL to a playable/displayable URL.
 * Automatically handles external URLs, blob URLs, public storage, and signed storage URLs.
 */
export async function getResolvedMediaUrl(
  bucket: StorageBucket,
  storagePathOrUrl?: string | null,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (!storagePathOrUrl) return '';

  // Already a full web URL or local object URL
  if (
    storagePathOrUrl.startsWith('http://') ||
    storagePathOrUrl.startsWith('https://') ||
    storagePathOrUrl.startsWith('blob:') ||
    storagePathOrUrl.startsWith('data:')
  ) {
    return storagePathOrUrl;
  }

  if (!isSupabaseConfigured || !supabase) {
    return storagePathOrUrl;
  }

  const cacheKey = `${bucket}:${storagePathOrUrl}`;
  const cached = signedUrlCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60000) {
    return cached.url;
  }

  try {
    // For snaps (private bucket), use signed URLs
    if (bucket === 'snaps') {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePathOrUrl, expiresInSeconds);

      if (error || !data?.signedUrl) {
        // Fallback to public url attempt
        const publicRes = supabase.storage.from(bucket).getPublicUrl(storagePathOrUrl);
        return publicRes.data.publicUrl || storagePathOrUrl;
      }

      signedUrlCache.set(cacheKey, {
        url: data.signedUrl,
        expiresAt: now + expiresInSeconds * 1000
      });
      return data.signedUrl;
    }

    // For public buckets (avatars, memories, chat-media, payment-qr), get public URL
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePathOrUrl);
    if (data?.publicUrl) {
      return data.publicUrl;
    }

    // Fallback signed URL
    const { data: signedData } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePathOrUrl, expiresInSeconds);
    return signedData?.signedUrl || storagePathOrUrl;
  } catch (e) {
    console.warn('Error resolving media URL:', e);
    return storagePathOrUrl;
  }
}

/**
 * Synchronous resolver for instant UI binding.
 * If path is a Supabase storage path, generates the public URL representation.
 */
export function getSyncMediaUrl(bucket: StorageBucket, storagePathOrUrl?: string | null): string {
  if (!storagePathOrUrl) return '';

  if (
    storagePathOrUrl.startsWith('http://') ||
    storagePathOrUrl.startsWith('https://') ||
    storagePathOrUrl.startsWith('blob:') ||
    storagePathOrUrl.startsWith('data:')
  ) {
    return storagePathOrUrl;
  }

  if (!isSupabaseConfigured || !supabase) {
    return storagePathOrUrl;
  }

  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePathOrUrl);
    return data?.publicUrl || storagePathOrUrl;
  } catch {
    return storagePathOrUrl;
  }
}

/**
 * Deletes a file from Supabase storage by its storage path
 */
export async function deleteStorageFile(bucket: StorageBucket, storagePath: string): Promise<boolean> {
  if (!storagePath || !isSupabaseConfigured || !supabase) return false;

  // Don't delete external URLs
  if (storagePath.startsWith('http') && !storagePath.includes(bucket)) {
    return true;
  }

  try {
    const { error } = await supabase.storage.from(bucket).remove([storagePath]);
    if (error) {
      console.warn(`Failed to delete storage file ${storagePath}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error deleting storage file:', err);
    return false;
  }
}
