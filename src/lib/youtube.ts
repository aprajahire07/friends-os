/**
 * YouTube Utility Helper
 * Validates, parses, and safely formats YouTube URLs and embed links.
 */

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extracts a valid 11-character YouTube video ID from various YouTube URL formats.
 * Supported URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID (with query params like &t=10s, ?si=...)
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - Plain 11-char video ID
 *
 * Security: Rejects non-YouTube domains, raw iframe HTML, or malicious scripts.
 */
export function extractYouTubeVideoId(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Reject HTML tags, script injection, or arbitrary iframes
  if (trimmed.includes('<') || trimmed.includes('>') || trimmed.toLowerCase().includes('javascript:')) {
    return null;
  }

  // Direct 11-character ID check
  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    let urlStr = trimmed;
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      urlStr = 'https://' + urlStr;
    }

    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');

    // 1. youtu.be short link: https://youtu.be/VIDEO_ID
    if (host === 'youtu.be') {
      const pathname = parsed.pathname.replace(/^\/+/, '');
      const id = pathname.split('/')[0]?.split('?')[0];
      if (id && YOUTUBE_ID_REGEX.test(id)) {
        return id;
      }
    }

    // 2. youtube.com or youtube-nocookie.com
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      // Standard /watch?v=VIDEO_ID
      const v = parsed.searchParams.get('v');
      if (v && YOUTUBE_ID_REGEX.test(v)) {
        return v;
      }

      // /shorts/VIDEO_ID
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch && shortsMatch[1] && YOUTUBE_ID_REGEX.test(shortsMatch[1])) {
        return shortsMatch[1];
      }

      // /embed/VIDEO_ID
      const embedMatch = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch && embedMatch[1] && YOUTUBE_ID_REGEX.test(embedMatch[1])) {
        return embedMatch[1];
      }

      // /v/VIDEO_ID
      const vMatch = parsed.pathname.match(/^\/v\/([a-zA-Z0-9_-]{11})/);
      if (vMatch && vMatch[1] && YOUTUBE_ID_REGEX.test(vMatch[1])) {
        return vMatch[1];
      }
    }
  } catch {
    // Fall back to regex pattern matching
  }

  // Robust fallback regex
  const regexPatterns = [
    /(?:https?:\/\/)?(?:www\.|m\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)([a-zA-Z0-9_-]{11})/i
  ];

  for (const pattern of regexPatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1] && YOUTUBE_ID_REGEX.test(match[1])) {
      return match[1];
    }
  }

  return null;
}

/**
 * Validates whether a given string is a valid YouTube video URL or ID.
 */
export function isValidYouTubeUrl(input?: string | null): boolean {
  return extractYouTubeVideoId(input) !== null;
}

/**
 * Safely generates an official YouTube iframe embed URL from a video ID.
 * Only sanitized 11-char IDs are accepted.
 */
export function getYouTubeEmbedUrl(videoIdOrUrl?: string | null): string | null {
  const videoId = extractYouTubeVideoId(videoIdOrUrl);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&enablejsapi=1`;
}

/**
 * Gets high quality or standard thumbnail URL for a YouTube video.
 */
export function getYouTubeThumbnailUrl(videoIdOrUrl?: string | null, quality: 'hq' | 'mq' | 'default' = 'hq'): string | null {
  const videoId = extractYouTubeVideoId(videoIdOrUrl);
  if (!videoId) return null;

  switch (quality) {
    case 'mq':
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    case 'default':
      return `https://img.youtube.com/vi/${videoId}/default.jpg`;
    case 'hq':
    default:
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
}

/**
 * Formats a clean standard YouTube watch URL.
 */
export function getYouTubeWatchUrl(videoIdOrUrl?: string | null): string | null {
  const videoId = extractYouTubeVideoId(videoIdOrUrl);
  if (!videoId) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}
