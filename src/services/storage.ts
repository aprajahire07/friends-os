import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type StoragePurpose = 'notes' | 'memories' | 'chat-media' | 'avatars' | 'payment-qr' | 'snaps' | 'documents';
export type StorageBucket = 'avatars' | 'memories' | 'chat-media' | 'payment-qr' | 'snaps' | 'notes';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileType: 'image' | 'video' | 'document' | 'unknown';
}

// In-memory cache for resolved signed URLs
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Cache discovered existing Supabase buckets
let cachedKnownBuckets: string[] | null = null;
let lastBucketDiscoveryTime = 0;

const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25MB raw (will be auto-compressed)
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
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/x-c',
  'text/x-csrc',
  'text/x-c++',
  'text/x-cpp',
  'text/x-python',
  'text/x-java-source',
  'text/javascript',
  'text/html',
  'text/css',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream'
];

/**
 * Priority candidate buckets for each storage purpose.
 * If one bucket is missing or hits the 50MB limit, the engine rotates to the next available bucket automatically!
 */
export const BUCKET_CANDIDATE_CHAINS: Record<StoragePurpose, string[]> = {
  notes: ['notes', 'study-notes', 'notes-1', 'notes-2', 'documents', 'friend-os-files', 'memories', 'chat-media', 'snaps', 'public', 'default'],
  memories: ['memories', 'memories-1', 'memories-2', 'friend-os-files', 'notes', 'chat-media', 'public', 'default'],
  'chat-media': ['chat-media', 'chat_media', 'memories', 'notes', 'friend-os-files', 'public', 'default'],
  avatars: ['avatars', 'payment-qr', 'memories', 'notes', 'public', 'default'],
  'payment-qr': ['payment-qr', 'avatars', 'memories', 'notes', 'public', 'default'],
  snaps: ['snaps', 'memories', 'notes', 'chat-media', 'friend-os-files', 'public', 'default'],
  documents: ['documents', 'notes', 'study-notes', 'friend-os-files', 'memories', 'public', 'default']
};

const CODE_AND_DOC_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'text', 'rtf',
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'java', 'py', 'js', 'jsx', 'ts', 'tsx',
  'html', 'css', 'json', 'md', 'markdown', 'csv', 'sql', 'log', 'xml', 'yaml', 'yml',
  'zip', 'rar', '7z', 'tar', 'gz'
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

  const mimeType = (file.type || '').toLowerCase();
  const fileName = (file.name || '').toLowerCase();
  const ext = fileName.split('.').pop() || '';

  let fileType: 'image' | 'video' | 'document' | 'unknown' = 'unknown';

  if (ALLOWED_IMAGE_TYPES.includes(mimeType) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'svg'].includes(ext)) {
    fileType = 'image';
  } else if (ALLOWED_VIDEO_TYPES.includes(mimeType) || ['mp4', 'webm', 'mov', 'mkv'].includes(ext)) {
    fileType = 'video';
  } else if (
    ALLOWED_DOCUMENT_TYPES.includes(mimeType) || 
    CODE_AND_DOC_EXTENSIONS.includes(ext) ||
    mimeType.startsWith('text/') ||
    mimeType.includes('document') ||
    mimeType.includes('pdf') ||
    mimeType.includes('word') ||
    mimeType.includes('sheet') ||
    mimeType.includes('presentation')
  ) {
    fileType = 'document';
  }

  if (!allowedCategories.includes(fileType as any)) {
    return {
      valid: false,
      error: `File type not supported (${ext || mimeType || 'unknown'}). Please choose a valid image, video, or PDF/document.`,
      fileType
    };
  }

  // Size limit check
  if (fileType === 'image' && file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Image size exceeds maximum limit of 25MB.', fileType };
  }
  if (fileType === 'video' && file.size > MAX_VIDEO_SIZE) {
    return { valid: false, error: 'Video size exceeds maximum limit of 50MB.', fileType };
  }
  if (fileType === 'document' && file.size > MAX_DOCUMENT_SIZE) {
    return { valid: false, error: 'Document size exceeds maximum limit of 35MB.', fileType };
  }

  return { valid: true, fileType };
}

export function validateFile(
  file: File,
  allowedCategory: 'image' | 'video' | 'document' = 'document'
): FileValidationResult {
  return validateUploadFile(file, [allowedCategory]);
}

/**
 * Client-side smart image compression.
 * Automatically downsizes huge smartphone camera photos (e.g. 10MB) to ~250KB-500KB
 * preserving crystal-clear readability for study notes while saving 90%+ storage quota!
 */
export async function compressImageIfNeeded(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  const mimeType = file.type.toLowerCase();
  // Only compress raster images; keep SVGs, PDFs, and small icons intact
  if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml' || mimeType === 'image/gif') {
    return file;
  }

  // If already under 400KB, no need to compress heavily
  if (file.size < 400 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP or JPEG for optimal compression
      const outputType = 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], cleanName, {
              type: outputType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Queries Supabase to discover active buckets in the project.
 */
async function getAvailableBuckets(): Promise<string[]> {
  const now = Date.now();
  if (cachedKnownBuckets && now - lastBucketDiscoveryTime < 60000) {
    return cachedKnownBuckets;
  }

  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (!error && Array.isArray(buckets) && buckets.length > 0) {
      cachedKnownBuckets = buckets.map(b => b.name);
      lastBucketDiscoveryTime = now;
      return cachedKnownBuckets;
    }
  } catch (e) {
    console.warn('Could not list buckets via API, falling back to candidate list:', e);
  }

  return [];
}

/**
 * Attempts to create a bucket if permissions allow.
 */
async function tryAutoCreateBucket(bucketName: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 52428800 // 50MB
    });
    if (!error) {
      if (cachedKnownBuckets) cachedKnownBuckets.push(bucketName);
      return true;
    }
  } catch {
    // Ignore permissions errors
  }
  return false;
}

/**
 * Uploads a file with Automatic Multi-Bucket Rotation & Fallback.
 * If a bucket is not found or is full, it automatically rotates to the next candidate bucket in the chain.
 * Formats storagePath as `[bucket_name]::[filePath]` for unambiguous URL resolution.
 */
export async function uploadFileWithBucketRotation(
  purpose: StoragePurpose,
  file: File,
  userId?: string,
  onProgress?: (percent: number) => void
): Promise<{ storagePath: string; bucketUsed: string; error?: string }> {
  const validation = validateUploadFile(file);
  if (!validation.valid) {
    return { storagePath: '', bucketUsed: '', error: validation.error };
  }

  if (onProgress) onProgress(10);

  // 1. Smart compression for images to save maximum storage
  let fileToUpload = file;
  if (validation.fileType === 'image') {
    try {
      fileToUpload = await compressImageIfNeeded(file);
    } catch {
      fileToUpload = file;
    }
  }

  if (onProgress) onProgress(25);

  if (!isSupabaseConfigured || !supabase) {
    // Offline / unconfigured fallback
    const objectUrl = URL.createObjectURL(fileToUpload);
    if (onProgress) onProgress(100);
    return { storagePath: objectUrl, bucketUsed: 'local' };
  }

  // 2. Discover available buckets
  const knownBuckets = await getAvailableBuckets();
  const candidateChain = BUCKET_CANDIDATE_CHAINS[purpose] || ['notes', 'memories', 'chat-media', 'public'];

  // Prioritize known active buckets that match candidate chain
  const orderedBuckets: string[] = [
    ...knownBuckets.filter(b => candidateChain.includes(b)),
    ...candidateChain.filter(b => !knownBuckets.includes(b)),
    ...knownBuckets.filter(b => !candidateChain.includes(b))
  ];

  // Remove duplicates
  const uniqueBuckets = Array.from(new Set(orderedBuckets));

  const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const userPrefix = userId ? userId.replace(/[^a-zA-Z0-9-]/g, '') : 'shared';
  const relativePath = `${userPrefix}/${timestamp}_${randomStr}_${safeName}`;

  let lastErrorMsg = '';

  if (onProgress) onProgress(45);

  // 3. Try each bucket in rotation
  for (let i = 0; i < uniqueBuckets.length; i++) {
    const bucketName = uniqueBuckets[i];
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(relativePath, fileToUpload, {
          cacheControl: '3600',
          upsert: true
        });

      if (!error && data) {
        if (onProgress) onProgress(100);
        // Formatted storage path preserving bucket identifier
        const formattedPath = `${bucketName}::${data.path || relativePath}`;
        return { storagePath: formattedPath, bucketUsed: bucketName };
      }

      if (error) {
        lastErrorMsg = error.message;
        const errLower = error.message.toLowerCase();

        // If bucket not found, try to auto-create it once
        if (errLower.includes('bucket not found') || errLower.includes('not found') || errLower.includes('404')) {
          const created = await tryAutoCreateBucket(bucketName);
          if (created) {
            // Retry upload to newly created bucket
            const { data: retryData, error: retryErr } = await supabase.storage
              .from(bucketName)
              .upload(relativePath, fileToUpload, { cacheControl: '3600', upsert: true });

            if (!retryErr && retryData) {
              if (onProgress) onProgress(100);
              return { storagePath: `${bucketName}::${retryData.path || relativePath}`, bucketUsed: bucketName };
            }
          }
        }

        console.warn(`Bucket "${bucketName}" upload failed (${error.message}). Rotating to next candidate bucket...`);
      }
    } catch (e: any) {
      lastErrorMsg = e?.message || 'Bucket upload error';
      console.warn(`Exception on bucket "${bucketName}", rotating...`, e);
    }
  }

  // 4. If all Supabase storage buckets failed, fallback to Data URI to prevent user data loss
  try {
    const dataUrl = await fileToDataUrl(fileToUpload);
    if (onProgress) onProgress(100);
    return { storagePath: dataUrl, bucketUsed: 'data_uri' };
  } catch (err: any) {
    return { storagePath: '', bucketUsed: '', error: lastErrorMsg || 'Storage upload failed across all buckets.' };
  }
}

/**
 * Helper to convert a file to a Data URI for fallback persistence
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Universal URL resolver supporting multi-bucket encoded paths (`bucket::path`) and legacy paths.
 * Automatically tries fallback candidate buckets and caches resolved signed URLs.
 */
export async function getUniversalStorageUrl(
  storagePathOrUrl?: string | null,
  preferredBucket: StoragePurpose = 'notes',
  expiresInSeconds = 3600
): Promise<string> {
  if (!storagePathOrUrl) return '';

  // 1. Direct Web / Blob / Data URLs
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

  // 2. Parse bucket name and relative path
  let bucketName = preferredBucket as string;
  let relativePath = storagePathOrUrl;

  if (storagePathOrUrl.includes('::')) {
    const parts = storagePathOrUrl.split('::');
    bucketName = parts[0];
    relativePath = parts.slice(1).join('::');
  }

  const cacheKey = `${bucketName}:${relativePath}`;
  const cached = signedUrlCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60000) {
    return cached.url;
  }

  // 3. Candidate bucket chain for fallback
  const candidateChain = [
    bucketName,
    ...(BUCKET_CANDIDATE_CHAINS[preferredBucket] || ['notes', 'memories', 'chat-media', 'public'])
  ];
  const uniqueBuckets = Array.from(new Set(candidateChain));

  for (const b of uniqueBuckets) {
    try {
      // First try signed URL
      const { data: signedData, error: signedErr } = await supabase.storage
        .from(b)
        .createSignedUrl(relativePath, expiresInSeconds);

      if (!signedErr && signedData?.signedUrl) {
        signedUrlCache.set(cacheKey, {
          url: signedData.signedUrl,
          expiresAt: now + expiresInSeconds * 1000
        });
        return signedData.signedUrl;
      }

      // Try public URL
      const { data: pubData } = supabase.storage.from(b).getPublicUrl(relativePath);
      if (pubData?.publicUrl) {
        return pubData.publicUrl;
      }
    } catch {
      // Rotate
    }
  }

  return storagePathOrUrl;
}

/**
 * Universal deletion helper for multi-bucket storage files
 */
export async function deleteUniversalStorageFile(
  storagePathOrUrl: string,
  preferredBucket: StoragePurpose = 'notes'
): Promise<boolean> {
  if (!storagePathOrUrl || !isSupabaseConfigured || !supabase) return false;

  if (storagePathOrUrl.startsWith('data:') || storagePathOrUrl.startsWith('blob:')) {
    return true;
  }

  let bucketName = preferredBucket as string;
  let relativePath = storagePathOrUrl;

  if (storagePathOrUrl.includes('::')) {
    const parts = storagePathOrUrl.split('::');
    bucketName = parts[0];
    relativePath = parts.slice(1).join('::');
  }

  const candidateBuckets = Array.from(new Set([
    bucketName,
    ...(BUCKET_CANDIDATE_CHAINS[preferredBucket] || ['notes', 'memories', 'public'])
  ]));

  for (const b of candidateBuckets) {
    try {
      await supabase.storage.from(b).remove([relativePath]);
    } catch {
      // Ignore
    }
  }

  return true;
}

/**
 * Legacy compatibility aliases
 */
export async function uploadFileToStorage(
  bucket: StorageBucket,
  file: File,
  userId?: string,
  onProgress?: (percent: number) => void
): Promise<{ storagePath: string; error?: string }> {
  const res = await uploadFileWithBucketRotation(bucket as StoragePurpose, file, userId, onProgress);
  return { storagePath: res.storagePath, error: res.error };
}

export async function getResolvedMediaUrl(
  bucket: StorageBucket,
  storagePathOrUrl?: string | null,
  expiresInSeconds: number = 3600
): Promise<string> {
  return getUniversalStorageUrl(storagePathOrUrl, bucket as StoragePurpose, expiresInSeconds);
}

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

  let targetBucket = bucket as string;
  let relativePath = storagePathOrUrl;
  if (storagePathOrUrl.includes('::')) {
    const parts = storagePathOrUrl.split('::');
    targetBucket = parts[0];
    relativePath = parts.slice(1).join('::');
  }

  if (!isSupabaseConfigured || !supabase) return storagePathOrUrl;

  try {
    const { data } = supabase.storage.from(targetBucket).getPublicUrl(relativePath);
    return data?.publicUrl || storagePathOrUrl;
  } catch {
    return storagePathOrUrl;
  }
}

export async function deleteStorageFile(bucket: StorageBucket, storagePath: string): Promise<boolean> {
  return deleteUniversalStorageFile(storagePath, bucket as StoragePurpose);
}
