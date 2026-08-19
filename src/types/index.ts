export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  lastLogin: string;
  googleDriveConnected?: boolean;
  googleDriveEmail?: string;
}

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  videoIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VideoMetadata {
  id: string;
  userId?: string;
  originalName: string;
  storedName: string;
  path: string;
  size: number;
  duration: number; // in seconds
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  videoCodec: string;
  audioCodec?: string;
  hasAudio: boolean;
  thumbnailUrl?: string;
  driveFileId?: string; // Google Drive File ID
  storageProvider?: 'google_drive' | 'local' | 'supabase';
  storageBucket?: string;
  storagePath?: string;
  folderId?: string;
  mimeType?: string;
  sourceType?: 'UPLOAD' | 'IMPORT' | 'YOUTUBE' | 'YOUTUBE_LIVE';
  sourceUrl?: string;
  youtubeVideoId?: string;
  liveStatus?: 'LIVE' | 'OFFLINE' | 'UPCOMING' | 'NONE';
  channelTitle?: string;
  status?: 'READY' | 'UPLOADING' | 'CACHED' | 'MISSING' | 'ERROR';
  createdAt: string;
  updatedAt?: string;
}

export type StreamStatus =
  | 'IDLE'
  | 'STARTING'
  | 'LIVE'
  | 'PLAYING_VIDEO'
  | 'SWITCHING_VIDEO'
  | 'RECONNECTING'
  | 'STOPPING'
  | 'STOPPED'
  | 'ERROR';

export interface StreamConfig {
  userId?: string;
  videoId?: string;
  videoIds?: string[]; // Array of selected video IDs in exact playback order
  playlistId?: string;
  rtmpUrl: string;
  streamKey: string;
  loop: boolean;
  quality: 'source' | '720p' | '1080p';
  bitrate: 'auto' | '2500k' | '4000k' | '6000k' | string;
  fps: 'source' | '30' | '60';
  audio: boolean;
  autoReconnect: boolean;
  reconnectDelay: number; // in seconds
}

export interface PlaylistItem {
  id: string;
  originalName: string;
  storedName: string;
  path: string;
  duration: number;
  size: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  thumbnailUrl?: string;
  driveFileId?: string;
  storageProvider?: 'google_drive' | 'local' | 'supabase';
  storageBucket?: string;
  storagePath?: string;
}

export interface StreamState {
  userId?: string;
  status: StreamStatus;
  config: (Omit<StreamConfig, 'streamKey'> & { streamKeyMasked: string }) | null;
  video: VideoMetadata | null;
  playlist: PlaylistItem[];
  currentVideo: PlaylistItem | null;
  currentIndex: number;
  currentLoop: number;
  totalDurationSeconds: number;
  loopProgressPercent: number;
  currentVideoProgressPercent: number;
  currentVideoElapsedSeconds: number;
  pid: number | null;
  startedAt: string | null;
  stoppedAt: string | null;
  uptimeSeconds: number;
  uptimeFormatted: string;
  reconnectCount: number;
  lastError: string | null;
  lastMessage: string | null;
  realtimeStats: {
    frame: number;
    fps: number;
    q: number;
    size: string;
    time: string;
    bitrate: string;
    speed: string;
  };
}

export interface StreamSession {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  videoId?: string;
  videoName: string;
  videoIds?: string[];
  videoNames?: string[];
  isPlaylist?: boolean;
  playlistCount?: number;
  rtmpUrlMasked: string;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number;
  status: 'SUCCESS' | 'STOPPED' | 'CRASHED' | 'RECONNECTED' | 'ERROR';
  reconnectCount: number;
  errorMessage: string | null;
}

export interface SystemSettings {
  maxConcurrentStreams: number;
  defaultRtmpUrl: string;
  defaultQuality: 'source' | '720p' | '1080p';
  defaultBitrate: string;
  defaultFps: 'source' | '30' | '60';
  autoReconnect: boolean;
  reconnectDelay: number;
  maxUploadSizeMb: number;
  allowedExtensions: string[];
  autoRecoverOnBoot: boolean;
  adminGoogleEmails: string[];
  googleDriveEnabled?: boolean;
  googleDriveFolderId?: string;
  googleDriveApiKey?: string;
  googleDriveLocation?: string;
  googleDriveLocationType?: 'folder' | 'file' | 'unknown';
}

export interface StorageStatusInfo {
  provider: 'google_drive' | 'local';
  isConfigured: boolean;
  configured?: boolean;
  apiKeyConfigured?: boolean;
  locationConfigured?: boolean;
  apiKeyMasked?: string;
  location?: string;
  locationType?: 'folder' | 'file' | 'unknown';
  locationStatus?: 'VALID' | 'NOT_ACCESSIBLE' | 'UNKNOWN';
  folderId: string;
  folderName?: string;
  accountEmail?: string;
  status: 'READY' | 'NOT_CONFIGURED' | 'AUTH_ERROR' | 'PERMISSION_DENIED';
  statusMessage: string;
  cacheStats: {
    count: number;
    totalSizeBytes: number;
    cachedFiles: Array<{ name: string; size: number; modified: string }>;
  };
  storageQuota?: {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
  };
}

export interface SystemStatusInfo {
  ffmpegInstalled: boolean;
  ffmpegVersion: string | null;
  ffmpegPath: string | null;
  ffprobeInstalled: boolean;
  ffprobeVersion: string | null;
  ffprobePath: string | null;
  streamingEngineReady: boolean;
  activeStreamsCount: number;
  maxConcurrentStreams: number;
  isLocked: boolean;
  lockPid: number | null;
  os: {
    platform: string;
    arch: string;
    release: string;
    uptime: number;
  };
  cpu: {
    cores: number;
    model: string;
    usagePercent: number;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
  };
  processMemory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  storage: {
    uploadsCount: number;
    uploadsSizeBytes: number;
  };
  activeStreamPid: number | null;
  serverTime: string;
}

export interface GoogleDriveConfig {
  apiKey?: string;
  folderId?: string;
  location?: string;
  locationType?: 'folder' | 'file' | 'unknown';
}

export type StorageStatusResponse = StorageStatusInfo;

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'stdout' | 'stderr' | 'system' | 'error' | 'success';
  message: string;
  userId?: string;
}

export interface AdminOverviewStats {
  totalUsers: number;
  activeUsers: number;
  totalVideos: number;
  activeStreams: number;
  totalPlaylists: number;
  system: SystemStatusInfo;
  storage: StorageStatusInfo;
}

export interface AdminStreamItem {
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  status: StreamStatus;
  pid: number | null;
  startedAt: string | null;
  uptimeFormatted: string;
  currentVideoName: string;
  playlistCount: number;
  rtmpUrlMasked: string;
  realtimeStats: {
    fps: number;
    bitrate: string;
    speed: string;
    time: string;
    size: string;
  };
}
