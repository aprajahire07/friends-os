/**
 * YouTube Utility functions for Memories feature
 * Safely extracts video IDs from various YouTube URL formats and generates secure embed links.
 */

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extracts an 11-character YouTube video ID from various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID (with or without params like &t=, &ab_channel=)
 * - https://youtu.be/VIDEO_ID (with or without ?t=)
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 * - Raw 11-char ID
 */
export function extractYouTubeVideoId(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Raw 11-char ID
  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  // 2. youtu.be/VIDEO_ID
  const shortMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (shortMatch && shortMatch[1]) {
    return shortMatch[1];
  }

  // 3. youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?(?:[^&]*&)*v=([a-zA-Z0-9_-]{11})/i);
  if (watchMatch && watchMatch[1]) {
    return watchMatch[1];
  }

  // 4. youtube.com/shorts/VIDEO_ID
  const shortsMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch && shortsMatch[1]) {
    return shortsMatch[1];
  }

  // 5. youtube.com/embed/VIDEO_ID or /v/VIDEO_ID or /live/VIDEO_ID
  const embedMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(?:embed|v|live)\/([a-zA-Z0-9_-]{11})/i);
  if (embedMatch && embedMatch[1]) {
    return embedMatch[1];
  }

  // 6. Generic URL parse fallback
  try {
    const urlString = trimmed.startsWith('http://') || trimmed.startsWith('https://') 
      ? trimmed 
      : `https://${trimmed}`;
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');

    if (host === 'youtube.com') {
      const v = parsed.searchParams.get('v');
      if (v && YOUTUBE_ID_REGEX.test(v)) return v;

      const segments = parsed.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'v', 'live'].includes(segments[0]) && segments[1] && YOUTUBE_ID_REGEX.test(segments[1])) {
        return segments[1];
      }
    } else if (host === 'youtu.be') {
      const segment = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (segment && YOUTUBE_ID_REGEX.test(segment)) return segment;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Validates whether the given string is a valid YouTube link or ID.
 */
export function isValidYouTubeUrl(input?: string | null): boolean {
  return extractYouTubeVideoId(input) !== null;
}

export interface YouTubeLinkItem {
  url: string;
  videoId: string;
}

/**
 * Extracts all valid YouTube video links and IDs from various inputs (single string, array, JSON string, or comma-separated text).
 * Deduplicates and returns an array of { url, videoId }.
 */
export function extractAllYouTubeLinks(input?: string | string[] | null): YouTubeLinkItem[] {
  if (!input) return [];

  const rawCandidates: string[] = [];

  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string') {
        rawCandidates.push(item);
      }
    }
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];

    // Try parsing as JSON array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (typeof p === 'string') rawCandidates.push(p);
          }
        }
      } catch {
        // Fallback to comma/line split
        rawCandidates.push(...trimmed.split(/[\n,]+/));
      }
    } else {
      // Split by commas or newlines if multiple
      const parts = trimmed.split(/[\n,]+/);
      rawCandidates.push(...parts);
    }
  }

  const results: YouTubeLinkItem[] = [];
  const seenIds = new Set<string>();

  for (const candidate of rawCandidates) {
    const cleanCand = candidate.trim();
    if (!cleanCand) continue;

    const videoId = extractYouTubeVideoId(cleanCand);
    if (videoId && !seenIds.has(videoId)) {
      seenIds.add(videoId);
      const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
      results.push({
        url: canonicalUrl,
        videoId: videoId
      });
    }
  }

  return results;
}

/**
 * Formats multiple YouTube URLs/IDs into both legacy-compatible columns and array representations.
 */
export function formatYouTubePayload(urlsOrIds?: (string | null | undefined)[] | null): {
  youtube_url: string | null;
  youtube_video_id: string | null;
  youtube_urls: string[];
  youtube_video_ids: string[];
} {
  const items = extractAllYouTubeLinks(urlsOrIds?.filter(Boolean) as string[]);
  const urls = items.map(it => it.url);
  const ids = items.map(it => it.videoId);

  if (urls.length === 0) {
    return {
      youtube_url: null,
      youtube_video_id: null,
      youtube_urls: [],
      youtube_video_ids: []
    };
  }

  if (urls.length === 1) {
    return {
      youtube_url: urls[0],
      youtube_video_id: ids[0],
      youtube_urls: urls,
      youtube_video_ids: ids
    };
  }

  return {
    youtube_url: JSON.stringify(urls),
    youtube_video_id: JSON.stringify(ids),
    youtube_urls: urls,
    youtube_video_ids: ids
  };
}

/**
 * Generates an official, secure iframe embed URL for YouTube.
 * Uses youtube-nocookie.com for enhanced privacy and security.
 */
export function getYouTubeEmbedUrl(videoId: string): string {
  const sanitizedId = encodeURIComponent(videoId.replace(/[^a-zA-Z0-9_-]/g, ''));
  return `https://www.youtube-nocookie.com/embed/${sanitizedId}?rel=0&modestbranding=1&playsinline=1`;
}

/**
 * Returns the standard YouTube thumbnail URL for video preview.
 */
export function getYouTubeThumbnailUrl(videoId: string, quality: 'hq' | 'mq' | 'default' = 'hq'): string {
  const sanitizedId = encodeURIComponent(videoId.replace(/[^a-zA-Z0-9_-]/g, ''));
  if (quality === 'hq') return `https://img.youtube.com/vi/${sanitizedId}/hqdefault.jpg`;
  if (quality === 'mq') return `https://img.youtube.com/vi/${sanitizedId}/mqdefault.jpg`;
  return `https://img.youtube.com/vi/${sanitizedId}/default.jpg`;
}
