/**
 * YouTube Live Stream & Video Detection and Metadata Utilities
 */

export interface ParsedYouTubeInfo {
  videoId: string;
  isLiveUrl: boolean;
  normalizedUrl: string;
}

export interface YouTubeMetadataResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  liveStatus: 'LIVE' | 'OFFLINE' | 'UPCOMING' | 'NONE';
  isLiveStream: boolean;
  durationSeconds: number;
  sourceUrl: string;
}

/**
 * Extracts and validates a YouTube video/live stream ID from various supported URL formats.
 */
export function extractYouTubeVideoId(inputUrl: string): ParsedYouTubeInfo | null {
  if (!inputUrl || typeof inputUrl !== 'string') return null;
  const url = inputUrl.trim();

  // Validate that the host looks like YouTube
  const isYouTubeHost = /(?:^|\.)(?:youtube\.com|youtu\.be)$/i;
  
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (!isYouTubeHost.test(parsed.hostname)) {
      return null;
    }
  } catch {
    // If not a standard URL, still test regex pattern
  }

  // Check if explicitly contains /live/
  const isLiveUrl = /youtube\.com\/live\/[a-zA-Z0-9_-]{11}/i.test(url) || /[?&]live=1/i.test(url);

  // Match 11-character alphanumeric with _ and -
  // Patterns supported:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/live/VIDEO_ID
  // - https://youtube.com/live/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  // - https://www.youtube.com/shorts/VIDEO_ID
  // - https://m.youtube.com/watch?v=VIDEO_ID
  const patterns = [
    /(?:youtube\.com\/(?:watch\?.*v=|live\/|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1] && /^[a-zA-Z0-9_-]{11}$/.test(match[1])) {
      const videoId = match[1];
      return {
        videoId,
        isLiveUrl,
        normalizedUrl: isLiveUrl ? `https://www.youtube.com/live/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`,
      };
    }
  }

  return null;
}

/**
 * Parses ISO 8601 duration string (e.g. PT1H2M30S, PT15M33S, P0D) to seconds.
 */
function parseISO8601Duration(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Fetches YouTube metadata using YouTube Data API if configured,
 * or falls back cleanly to YouTube oEmbed service and standard thumbnails.
 */
export async function fetchYouTubeMetadata(
  videoId: string,
  isLiveUrlHint: boolean = false,
  customTitle?: string
): Promise<YouTubeMetadataResult> {
  const fallbackThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const defaultTitle = customTitle || (isLiveUrlHint ? 'YouTube Live Stream' : 'YouTube Video');
  
  let resolvedTitle = defaultTitle;
  let resolvedChannel = 'YouTube';
  let resolvedThumbnail = fallbackThumbnail;
  let liveStatus: 'LIVE' | 'OFFLINE' | 'UPCOMING' | 'NONE' = isLiveUrlHint ? 'LIVE' : 'NONE';
  let durationSeconds = 0;

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GEMINI_API_KEY;

  // 1. If YouTube API Key is available, query official YouTube Data API v3
  if (apiKey) {
    try {
      const apiEndpoint = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails,liveStreamingDetails&key=${apiKey}`;
      const response = await fetch(apiEndpoint);
      if (response.ok) {
        const data: any = await response.json();
        if (data.items && data.items.length > 0) {
          const item = data.items[0];
          const snippet = item.snippet || {};
          const liveStreamingDetails = item.liveStreamingDetails;
          const liveBroadcastContent = snippet.liveBroadcastContent; // 'live' | 'upcoming' | 'none'

          if (snippet.title) resolvedTitle = snippet.title;
          if (snippet.channelTitle) resolvedChannel = snippet.channelTitle;

          if (snippet.thumbnails?.maxres?.url) {
            resolvedThumbnail = snippet.thumbnails.maxres.url;
          } else if (snippet.thumbnails?.high?.url) {
            resolvedThumbnail = snippet.thumbnails.high.url;
          } else if (snippet.thumbnails?.medium?.url) {
            resolvedThumbnail = snippet.thumbnails.medium.url;
          }

          if (liveBroadcastContent === 'live' || liveStreamingDetails?.actualStartTime && !liveStreamingDetails?.actualEndTime) {
            liveStatus = 'LIVE';
          } else if (liveBroadcastContent === 'upcoming' || liveStreamingDetails?.scheduledStartTime && !liveStreamingDetails?.actualStartTime) {
            liveStatus = 'UPCOMING';
          } else if (liveStreamingDetails?.actualEndTime) {
            liveStatus = 'OFFLINE';
          } else if (isLiveUrlHint) {
            liveStatus = 'LIVE';
          }

          if (item.contentDetails?.duration) {
            durationSeconds = parseISO8601Duration(item.contentDetails.duration);
          }

          return {
            videoId,
            title: customTitle || resolvedTitle,
            channelTitle: resolvedChannel,
            thumbnailUrl: resolvedThumbnail,
            liveStatus,
            isLiveStream: liveStatus === 'LIVE' || liveStatus === 'UPCOMING' || isLiveUrlHint,
            durationSeconds,
            sourceUrl: isLiveUrlHint ? `https://www.youtube.com/live/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`,
          };
        }
      }
    } catch (apiErr) {
      console.warn('[YouTube API Warning]:', apiErr);
    }
  }

  // 2. Fallback to official YouTube oEmbed endpoint (No API key required)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedRes = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    });

    if (oembedRes.ok) {
      const oembedData: any = await oembedRes.json();
      if (oembedData.title) resolvedTitle = oembedData.title;
      if (oembedData.author_name) resolvedChannel = oembedData.author_name;
      if (oembedData.thumbnail_url) resolvedThumbnail = oembedData.thumbnail_url;
    }
  } catch (oembedErr) {
    console.warn('[YouTube oEmbed Warning]:', oembedErr);
  }

  return {
    videoId,
    title: customTitle || resolvedTitle,
    channelTitle: resolvedChannel,
    thumbnailUrl: resolvedThumbnail,
    liveStatus,
    isLiveStream: isLiveUrlHint || liveStatus === 'LIVE' || liveStatus === 'UPCOMING',
    durationSeconds,
    sourceUrl: isLiveUrlHint ? `https://www.youtube.com/live/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`,
  };
}
