import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import {
  User,
  VideoMetadata,
  StreamConfig,
  StreamSession,
  SystemSettings,
  Playlist,
} from '../../src/types/index.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const DEFAULT_SETTINGS: SystemSettings = {
  maxConcurrentStreams: Number(process.env.MAX_CONCURRENT_STREAMS) || 10,
  defaultRtmpUrl: process.env.DEFAULT_RTMP_URL || 'rtmps://a.rtmp.youtube.com:443/live2',
  defaultQuality: 'source',
  defaultBitrate: '4000k',
  defaultFps: 'source',
  autoReconnect: true,
  reconnectDelay: 5,
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB) || 500,
  allowedExtensions: ['.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts'],
  autoRecoverOnBoot: process.env.AUTO_RECOVER_STREAM === 'true',
  adminGoogleEmails: (process.env.ADMIN_GOOGLE_EMAILS || 'titangaming4m@gmail.com,admin@streamloop.io')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean),
  googleDriveEnabled: false,
  googleDriveFolderId: '',
};

export const AUTHORIZED_ADMIN_IDENTITY = 'LIGHT GAMING 4M';

class SupabaseDatabase {
  private client: SupabaseClient | null = null;
  private memoryUsers: User[] = [];
  private memoryVideos: VideoMetadata[] = [];
  private memoryPlaylists: Playlist[] = [];
  private memoryConfigs: Record<string, StreamConfig> = {};
  private memorySessions: StreamSession[] = [];
  private settings: SystemSettings = DEFAULT_SETTINGS;
  private isSaving = false;

  constructor() {
    this.ensureDirs();
    this.loadFromDisk();
    this.initSupabase();
    this.ensureDefaultAdmin();
    this.scanAndIndexLocalVideos();
  }

  private ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.users)) this.memoryUsers = data.users;
        if (Array.isArray(data.videos)) this.memoryVideos = data.videos;
        if (Array.isArray(data.playlists)) this.memoryPlaylists = data.playlists;
        if (data.configs && typeof data.configs === 'object') this.memoryConfigs = data.configs;
        if (Array.isArray(data.sessions)) this.memorySessions = data.sessions;
        if (data.settings && typeof data.settings === 'object') {
          this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
        }
        console.log(`[Database] Loaded persistent data: ${this.memoryUsers.length} users, ${this.memoryVideos.length} videos, ${this.memoryPlaylists.length} playlists.`);
      }
    } catch (err) {
      console.warn('[Database] Warning loading database from disk:', err);
    }
  }

  private saveToDisk() {
    if (this.isSaving) return;
    this.isSaving = true;
    try {
      this.ensureDirs();
      const payload = {
        users: this.memoryUsers,
        videos: this.memoryVideos,
        playlists: this.memoryPlaylists,
        configs: this.memoryConfigs,
        sessions: this.memorySessions,
        settings: this.settings,
        lastUpdated: new Date().toISOString(),
      };
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.warn('[Database] Warning saving database to disk:', err);
    } finally {
      this.isSaving = false;
    }
  }

  private ensureDefaultAdmin() {
    const adminEmail = 'titangaming4m@gmail.com';
    let admin = this.memoryUsers.find(u => u.email.toLowerCase() === adminEmail || u.id === 'usr_admin_default');
    if (!admin) {
      admin = {
        id: 'usr_admin_default',
        googleId: 'sb_admin_default',
        email: adminEmail,
        name: 'LIGHT GAMING 4M',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      this.memoryUsers.unshift(admin);
      this.saveToDisk();
    } else {
      admin.role = 'ADMIN';
      admin.status = 'ACTIVE';
    }
  }

  private scanAndIndexLocalVideos() {
    try {
      if (!fs.existsSync(UPLOADS_DIR)) return;
      const files = fs.readdirSync(UPLOADS_DIR);
      const defaultUser = this.memoryUsers[0]?.id || 'usr_admin_default';

      for (const file of files) {
        if (file.startsWith('.') || file.endsWith('.json') || file === 'temp_chunks' || file === 'thumbnails') continue;
        const fullPath = path.join(UPLOADS_DIR, file);
        try {
          const stat = fs.statSync(fullPath);
          if (!stat.isFile() || stat.size === 0) continue;

          const exists = this.memoryVideos.some(v => v.storedName === file || v.path === fullPath);
          if (!exists) {
            const ext = path.extname(file).toLowerCase();
            const allowed = ['.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts'];
            if (allowed.includes(ext)) {
              const cleanName = file.replace(/^(vid_[0-9]+_[a-f0-9]+_|yt_broadcast_)/i, '').replace(/_/g, ' ');
              const newVid: VideoMetadata = {
                id: `vid_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                userId: defaultUser,
                originalName: cleanName.length > 3 ? cleanName : file,
                storedName: file,
                path: fullPath,
                size: stat.size,
                mimeType: 'video/mp4',
                duration: 60,
                width: 1920,
                height: 1080,
                fps: 30,
                bitrate: 4500000,
                videoCodec: 'h264',
                audioCodec: 'aac',
                hasAudio: true,
                storageProvider: 'local',
                createdAt: stat.birthtime ? stat.birthtime.toISOString() : new Date().toISOString(),
              };
              this.memoryVideos.push(newVid);
            }
          }
        } catch {}
      }
      this.saveToDisk();
    } catch (err) {
      console.warn('[Database] Local video scan note:', err);
    }
  }

  public initSupabase() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (url && key && !url.includes('placeholder')) {
      try {
        this.client = createClient(url, key);
        console.log('[Supabase DB] Connected to Supabase Database successfully.');
      } catch (err) {
        console.error('[Supabase DB] Failed to initialize Supabase client:', err);
      }
    }
  }

  public init() {
    this.initSupabase();
  }

  public isEmailAdmin(email: string): boolean {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    const adminEmails = this.settings.adminGoogleEmails || [];
    return adminEmails.some(e => e.trim().toLowerCase() === clean) || clean === 'titangaming4m@gmail.com';
  }

  public isUserAdmin(user: { email?: string; name?: string; role?: string } | string): boolean {
    if (!user) return false;
    if (typeof user === 'string') {
      return this.isEmailAdmin(user);
    }
    const emailMatches = user.email ? this.isEmailAdmin(user.email) : false;
    const nameMatches = user.name ? user.name.toUpperCase().includes('LIGHT GAMING 4M') : false;
    return emailMatches || nameMatches || user.role === 'ADMIN';
  }

  public upsertGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
    avatar?: string;
  }): { user: User; isNew: boolean } {
    const cleanEmail = profile.email.trim().toLowerCase();
    const shouldBeAdmin = this.isEmailAdmin(cleanEmail) || (profile.name && profile.name.toUpperCase().includes('LIGHT GAMING 4M'));

    let existing = this.memoryUsers.find(u => (u.googleId && u.googleId === profile.googleId) || u.email.toLowerCase() === cleanEmail);
    if (existing) {
      existing.googleId = profile.googleId || existing.googleId;
      existing.name = profile.name || existing.name;
      existing.avatar = profile.avatar || existing.avatar;
      existing.lastLogin = new Date().toISOString();
      if (shouldBeAdmin) existing.role = 'ADMIN';
      this.saveToDisk();
      return { user: existing, isNew: false };
    }

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      googleId: profile.googleId,
      email: cleanEmail,
      name: profile.name || cleanEmail.split('@')[0],
      avatar: profile.avatar || '',
      role: shouldBeAdmin ? 'ADMIN' : 'USER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      googleDriveConnected: false,
    };

    this.memoryUsers.push(newUser);
    this.saveToDisk();
    return { user: newUser, isNew: true };
  }

  public addUser(user: User): User {
    const existing = this.findUserById(user.id) || this.findUserByEmail(user.email);
    if (!existing) {
      this.memoryUsers.push(user);
    } else {
      Object.assign(existing, user);
    }
    this.saveToDisk();
    return user;
  }

  public getUsers(): User[] {
    return [...this.memoryUsers];
  }

  public findUserById(id: string): User | undefined {
    return this.memoryUsers.find(u => u.id === id);
  }

  public findUserByGoogleId(googleId: string): User | undefined {
    return this.memoryUsers.find(u => u.googleId === googleId);
  }

  public findUserByEmail(email: string): User | undefined {
    const clean = email.trim().toLowerCase();
    return this.memoryUsers.find(u => u.email.toLowerCase() === clean);
  }

  public updateUserRole(userId: string, role: 'ADMIN' | 'USER'): User | null {
    const user = this.findUserById(userId);
    if (user) {
      user.role = role;
      this.saveToDisk();
      return user;
    }
    return null;
  }

  public updateUserStatus(userId: string, status: 'ACTIVE' | 'DISABLED'): User | null {
    const user = this.findUserById(userId);
    if (user) {
      user.status = status;
      this.saveToDisk();
      return user;
    }
    return null;
  }

  public deleteUser(userId: string): boolean {
    const idx = this.memoryUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      this.memoryUsers.splice(idx, 1);
      this.memoryVideos = this.memoryVideos.filter(v => v.userId !== userId);
      this.memoryPlaylists = this.memoryPlaylists.filter(p => p.userId !== userId);
      delete this.memoryConfigs[userId];
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // Videos
  public getVideos(userId?: string): VideoMetadata[] {
    let list = [...this.memoryVideos];
    if (userId) {
      const user = this.findUserById(userId);
      const isAdmin = user ? this.isUserAdmin(user) : false;
      // Admins can see all videos or their own; regular users see their videos
      if (!isAdmin) {
        list = list.filter(v => !v.userId || v.userId === userId);
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getVideoById(id: string, userId?: string): VideoMetadata | undefined {
    const user = userId ? this.findUserById(userId) : undefined;
    const isAdmin = user ? this.isUserAdmin(user) : false;
    return this.memoryVideos.find(v => v.id === id && (isAdmin || !userId || !v.userId || v.userId === userId));
  }

  public addVideo(video: VideoMetadata): VideoMetadata {
    const existingIndex = this.memoryVideos.findIndex(v => v.id === video.id);
    if (existingIndex !== -1) {
      this.memoryVideos[existingIndex] = video;
    } else {
      this.memoryVideos.push(video);
    }
    this.saveToDisk();
    return video;
  }

  public updateVideo(id: string, updates: Partial<VideoMetadata>, userId?: string): VideoMetadata | null {
    const video = this.getVideoById(id, userId);
    if (video) {
      Object.assign(video, updates);
      this.saveToDisk();
      return video;
    }
    return null;
  }

  public renameVideo(id: string, newName: string, userId?: string): VideoMetadata | null {
    const video = this.getVideoById(id, userId);
    if (video) {
      video.originalName = newName;
      this.saveToDisk();
      return video;
    }
    return null;
  }

  public deleteVideo(id: string, userId?: string): boolean {
    const index = this.memoryVideos.findIndex(v => v.id === id && (!userId || !v.userId || v.userId === userId));
    if (index !== -1) {
      this.memoryVideos.splice(index, 1);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // Playlists
  public getPlaylists(userId?: string): Playlist[] {
    let list = [...this.memoryPlaylists];
    if (userId) {
      list = list.filter(p => !p.userId || p.userId === userId);
    }
    return list;
  }

  public getPlaylistById(id: string, userId?: string): Playlist | undefined {
    return this.memoryPlaylists.find(p => p.id === id && (!userId || !p.userId || p.userId === userId));
  }

  public savePlaylist(playlist: Playlist): Playlist {
    const existingIdx = this.memoryPlaylists.findIndex(p => p.id === playlist.id);
    if (existingIdx !== -1) {
      this.memoryPlaylists[existingIdx] = playlist;
    } else {
      this.memoryPlaylists.push(playlist);
    }
    this.saveToDisk();
    return playlist;
  }

  public createPlaylist(userIdOrPlaylist: string | Playlist, name?: string, videoIds?: string[]): Playlist {
    if (typeof userIdOrPlaylist === 'object') {
      return this.savePlaylist(userIdOrPlaylist);
    }
    const userId = userIdOrPlaylist;
    const newPlaylist: Playlist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId,
      name: name || 'Untitled Playlist',
      videoIds: videoIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.memoryPlaylists.push(newPlaylist);
    this.saveToDisk();
    return newPlaylist;
  }

  public updatePlaylist(idOrPlaylist: string | Playlist, userIdOrUpdates?: string | Partial<Playlist>, updatesParam?: Partial<Playlist>): Playlist | null {
    if (typeof idOrPlaylist === 'object') {
      const pl = this.getPlaylistById(idOrPlaylist.id);
      if (pl) {
        Object.assign(pl, idOrPlaylist, { updatedAt: new Date().toISOString() });
        this.saveToDisk();
        return pl;
      }
      return null;
    }

    const id = idOrPlaylist;
    const userId = typeof userIdOrUpdates === 'string' ? userIdOrUpdates : undefined;
    const updates = typeof userIdOrUpdates === 'object' ? userIdOrUpdates : (updatesParam || {});

    const pl = this.getPlaylistById(id, userId);
    if (pl) {
      Object.assign(pl, updates, { updatedAt: new Date().toISOString() });
      this.saveToDisk();
      return pl;
    }
    return null;
  }

  public deletePlaylist(id: string, userId?: string): boolean {
    const index = this.memoryPlaylists.findIndex(p => p.id === id && (!userId || !p.userId || p.userId === userId));
    if (index !== -1) {
      this.memoryPlaylists.splice(index, 1);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // Stream Configs
  public getStreamConfig(userId: string): StreamConfig {
    if (this.memoryConfigs[userId]) {
      return this.memoryConfigs[userId];
    }
    return {
      userId,
      rtmpUrl: this.settings.defaultRtmpUrl,
      streamKey: '',
      quality: 'source',
      bitrate: '4000k',
      fps: 'source',
      autoReconnect: true,
      reconnectDelay: 5,
      loop: true,
      audio: true,
    };
  }

  public getUserStreamConfig(userId: string): StreamConfig {
    return this.getStreamConfig(userId);
  }

  public saveStreamConfig(userId: string, config: Partial<StreamConfig>): StreamConfig {
    const current = this.getStreamConfig(userId);
    const updated = { ...current, ...config, userId };
    this.memoryConfigs[userId] = updated;
    this.saveToDisk();
    return updated;
  }

  public saveUserStreamConfig(userId: string, config: Partial<StreamConfig>): StreamConfig {
    return this.saveStreamConfig(userId, config);
  }

  // Sessions
  public getSessions(userId?: string): StreamSession[] {
    let list = [...this.memorySessions];
    if (userId) {
      list = list.filter(s => !s.userId || s.userId === userId);
    }
    return list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  public addSession(session: StreamSession): StreamSession {
    this.memorySessions.push(session);
    this.saveToDisk();
    return session;
  }

  public updateSession(id: string, updates: Partial<StreamSession>): StreamSession | null {
    const session = this.memorySessions.find(s => s.id === id);
    if (session) {
      Object.assign(session, updates);
      this.saveToDisk();
      return session;
    }
    return null;
  }

  public clearSessions(userId?: string): void {
    if (userId) {
      this.memorySessions = this.memorySessions.filter(s => s.userId !== userId);
    } else {
      this.memorySessions = [];
    }
    this.saveToDisk();
  }

  // Settings
  public getSettings(): SystemSettings {
    return { ...this.settings };
  }

  public updateSettings(updates: Partial<SystemSettings>): SystemSettings {
    this.settings = { ...this.settings, ...updates };
    this.saveToDisk();
    return { ...this.settings };
  }
}

export const db = new SupabaseDatabase();
db.init();
