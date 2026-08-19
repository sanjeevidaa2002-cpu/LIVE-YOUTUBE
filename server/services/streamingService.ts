import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import {
  StreamConfig,
  StreamState,
  StreamStatus,
  LogEntry,
  VideoMetadata,
  StreamSession,
  PlaylistItem,
  AdminStreamItem,
} from '../../src/types/index.ts';
import { db } from '../database/db.ts';
import { FFprobeService } from './ffprobeService.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOGS_DIR = path.resolve(process.cwd(), 'logs');

// Individual User Stream Process Manager
export class UserStreamEngine extends EventEmitter {
  public userId: string;
  public userEmail = '';
  public userName = '';
  public ffmpegProcess: ChildProcess | null = null;
  public activeConfig: StreamConfig | null = null;
  public activePlaylist: PlaylistItem[] = [];
  public totalPlaylistDuration = 0;
  public status: StreamStatus = 'STOPPED';
  public desiredState: 'RUNNING' | 'STOPPED' = 'STOPPED';
  public pid: number | null = null;
  public startedAt: Date | null = null;
  public stoppedAt: Date | null = null;
  public currentSessionId: string | null = null;
  public reconnectCount = 0;
  public reconnectTimeout: NodeJS.Timeout | null = null;
  public userRequestedStop = true;
  public isIntentionallyStopping = false;
  public lastError: string | null = null;
  public lastMessage: string | null = null;

  public realtimeStats = {
    frame: 0,
    fps: 0,
    q: 0,
    size: '0kB',
    time: '00:00:00.00',
    bitrate: '0kbits/s',
    speed: '0x',
  };

  private logs: LogEntry[] = [];
  private maxLogs = 300;
  private ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(userId: string) {
    super();
    this.userId = userId;
    this.ensureDirs();
    this.loadSavedConfig();
    this.loadState();
    this.startHealthMonitor();

    // Check if desiredState is RUNNING on server boot / worker load
    if (this.desiredState === 'RUNNING' && this.activeConfig) {
      let isAlive = false;
      if (this.pid) {
        try {
          process.kill(this.pid, 0);
          isAlive = true;
        } catch {
          isAlive = false;
        }
      }

      if (!isAlive) {
        console.log(`[StreamEngine] Server boot detected RUNNING stream for user ${userId}. Restoring 24/7 stream...`);
        setTimeout(() => {
          if (this.desiredState === 'RUNNING' && this.activeConfig && !this.ffmpegProcess) {
            this.startStream(this.activeConfig).catch(err => {
              console.error(`[StreamEngine] Failed to restore stream on boot for user ${userId}:`, err);
            });
          }
        }, 3000);
      }
    }
  }

  private getStateFile(): string {
    return path.join(DATA_DIR, `stream_state_${this.userId}.json`);
  }

  private saveState() {
    try {
      const data = {
        desiredState: this.desiredState,
        config: this.activeConfig,
        pid: this.pid,
        startedAt: this.startedAt ? this.startedAt.toISOString() : null,
        stoppedAt: this.stoppedAt ? this.stoppedAt.toISOString() : null,
        reconnectCount: this.reconnectCount,
        lastError: this.lastError,
      };
      fs.writeFileSync(this.getStateFile(), JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save stream state:', e);
    }
  }

  private loadState() {
    try {
      const file = this.getStateFile();
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.desiredState) {
          this.desiredState = parsed.desiredState;
        }
        if (parsed.config) {
          this.activeConfig = parsed.config;
          this.reconstructPlaylist();
        }
        if (parsed.startedAt) {
          this.startedAt = new Date(parsed.startedAt);
        }
        if (parsed.stoppedAt) {
          this.stoppedAt = new Date(parsed.stoppedAt);
        }
        this.reconnectCount = parsed.reconnectCount || 0;
        this.lastError = parsed.lastError || null;
      }
    } catch (e) {
      console.warn('Failed to load stream state:', e);
    }
  }

  private startHealthMonitor() {
    if (this.healthCheckInterval) return;
    this.healthCheckInterval = setInterval(() => {
      if (this.desiredState === 'RUNNING' && this.status !== 'STARTING' && this.status !== 'RECONNECTING') {
        let isAlive = false;
        if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
          isAlive = true;
        } else if (this.pid) {
          try {
            process.kill(this.pid, 0);
            isAlive = true;
          } catch {
            isAlive = false;
          }
        }

        if (!isAlive && this.activeConfig) {
          console.warn(`[HealthMonitor] Stream for user ${this.userId} should be RUNNING, but FFmpeg process is dead. Auto-recovering...`);
          this.addLog('error', 'Health monitor detected dead FFmpeg process. Auto-recovering stream...');
          this.startStream(this.activeConfig).catch(err => {
            console.error('[HealthMonitor Recovery Error]:', err);
          });
        }
      }
    }, 10000);
  }

  private getLockFile(): string {
    return path.join(DATA_DIR, `stream_${this.userId}.lock`);
  }

  private getPlaylistFile(): string {
    return path.join(DATA_DIR, `playlist_${this.userId}.txt`);
  }

  private ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  private loadSavedConfig() {
    const saved = db.getUserStreamConfig(this.userId);
    if (saved) {
      this.activeConfig = saved;
      this.reconstructPlaylist();
    }
  }

  public reconstructPlaylist() {
    if (!this.activeConfig) return;
    const videoIds = this.activeConfig.videoIds && this.activeConfig.videoIds.length > 0
      ? this.activeConfig.videoIds
      : (this.activeConfig.videoId ? [this.activeConfig.videoId] : []);

    const items: PlaylistItem[] = [];
    let totalDur = 0;

    for (const vid of videoIds) {
      const v = db.getVideoById(vid, this.userId);
      if (v) {
        items.push({
          id: v.id,
          originalName: v.originalName,
          storedName: v.storedName,
          path: v.path,
          duration: v.duration,
          size: v.size,
          width: v.width,
          height: v.height,
          fps: v.fps,
          hasAudio: v.hasAudio,
          thumbnailUrl: v.thumbnailUrl,
          driveFileId: v.driveFileId,
          storageProvider: v.storageProvider,
        });
        totalDur += v.duration || 0;
      }
    }

    this.activePlaylist = items;
    this.totalPlaylistDuration = totalDur;
  }

  private writeLock(pid: number) {
    try {
      const lockData = {
        userId: this.userId,
        pid,
        startedAt: this.startedAt ? this.startedAt.toISOString() : new Date().toISOString(),
      };
      fs.writeFileSync(this.getLockFile(), JSON.stringify(lockData, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to write stream lock:', e);
    }
  }

  private releaseLock() {
    try {
      const lockFile = this.getLockFile();
      if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
    } catch {}
  }

  public getLogs(limit = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  public clearLogs() {
    this.logs = [];
  }

  private addLog(type: LogEntry['type'], message: string) {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      userId: this.userId,
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    this.emit('log', entry);
  }

  private updateStatus(newStatus: StreamStatus, message?: string) {
    this.status = newStatus;
    if (message) {
      this.lastMessage = message;
      this.addLog('system', message);
    }
    this.emit('status', this.getStatus());
  }

  public getStatus(): StreamState {
    const isRunning = this.ffmpegProcess !== null && !this.ffmpegProcess.killed && this.status !== 'STOPPED';
    let uptimeSeconds = 0;
    if (this.startedAt && isRunning) {
      uptimeSeconds = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
    }

    const hrs = Math.floor(uptimeSeconds / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);
    const secs = uptimeSeconds % 60;
    const uptimeFormatted = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    let streamKeyMasked = '';
    if (this.activeConfig?.streamKey) {
      const k = this.activeConfig.streamKey;
      streamKeyMasked = k.length > 4 ? `${'*'.repeat(k.length - 4)}${k.slice(-4)}` : '****';
    }

    const currentVideo = this.activePlaylist.length > 0 ? this.activePlaylist[0] : null;

    return {
      userId: this.userId,
      status: this.status,
      config: this.activeConfig
        ? {
            ...this.activeConfig,
            streamKeyMasked,
          }
        : null,
      video: null,
      playlist: this.activePlaylist,
      currentVideo,
      currentIndex: 0,
      currentLoop: 1,
      totalDurationSeconds: this.totalPlaylistDuration,
      loopProgressPercent: 0,
      currentVideoProgressPercent: 0,
      currentVideoElapsedSeconds: 0,
      pid: this.pid,
      startedAt: this.startedAt ? this.startedAt.toISOString() : null,
      stoppedAt: this.stoppedAt ? this.stoppedAt.toISOString() : null,
      uptimeSeconds,
      uptimeFormatted,
      reconnectCount: this.reconnectCount,
      lastError: this.lastError,
      lastMessage: this.lastMessage,
      realtimeStats: this.realtimeStats,
    };
  }

  /**
   * Resolves any video record (local upload, direct URL, Supabase storage, or imported YouTube stream)
   * into a reliable FFmpeg input path or stream buffer.
   */
  private async resolveVideoSource(v: VideoMetadata): Promise<{
    inputPath: string;
    isRemote: boolean;
    hasAudio: boolean;
  }> {
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    // 1. Direct local file on disk
    if (v.path && fs.existsSync(v.path)) {
      try {
        const stats = fs.statSync(v.path);
        if (stats.size > 0) {
          return { inputPath: v.path, isRemote: false, hasAudio: v.hasAudio !== false };
        }
      } catch {}
    }

    // 2. Check storedName in uploads dir
    if (v.storedName) {
      const candidate = path.join(uploadsDir, v.storedName);
      if (fs.existsSync(candidate)) {
        try {
          if (fs.statSync(candidate).size > 0) {
            v.path = candidate;
            return { inputPath: candidate, isRemote: false, hasAudio: v.hasAudio !== false };
          }
        } catch {}
      }
    }

    // 3. Direct remote URL (e.g. imported public MP4 / mkv / webm / stream URL)
    if (v.sourceUrl && (v.sourceUrl.startsWith('http://') || v.sourceUrl.startsWith('https://'))) {
      if (v.sourceType === 'IMPORT' || v.sourceUrl.match(/\.(mp4|mkv|mov|webm|m3u8|flv|ts)(\?.*)?$/i)) {
        return { inputPath: v.sourceUrl, isRemote: true, hasAudio: v.hasAudio !== false };
      }
    }

    // 4. Supabase Storage download / public URL check
    if (v.storageBucket && v.storagePath) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (url && key && !url.includes('placeholder')) {
          const client = createClient(url, key);
          const { data } = client.storage.from(v.storageBucket).getPublicUrl(v.storagePath);
          if (data?.publicUrl) {
            return { inputPath: data.publicUrl, isRemote: true, hasAudio: v.hasAudio !== false };
          }
        }
      } catch (sbErr) {
        console.warn('[Storage fallback warning]:', sbErr);
      }
    }

    // 5. YouTube Live stream, YouTube video, or missing local file broadcast loop generation
    // If it's a YouTube live stream or YouTube video or if disk file was purged,
    // generate an active 1080p broadcast media loop for 24x7 RTMP streaming.
    const safeVideoId = (v.youtubeVideoId || v.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const broadcastLoopPath = path.join(uploadsDir, `yt_broadcast_${safeVideoId}.mp4`);

    if (!fs.existsSync(broadcastLoopPath) || fs.statSync(broadcastLoopPath).size === 0) {
      try {
        const { execFile } = await import('child_process');

        // Check if thumbnail image can be downloaded locally
        let thumbLocal = '';
        if (v.thumbnailUrl && v.thumbnailUrl.startsWith('http')) {
          try {
            const thumbPath = path.join(uploadsDir, `thumb_${safeVideoId}.jpg`);
            if (!fs.existsSync(thumbPath)) {
              const res = await fetch(v.thumbnailUrl);
              if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                fs.writeFileSync(thumbPath, buf);
                thumbLocal = thumbPath;
              }
            } else {
              thumbLocal = thumbPath;
            }
          } catch {}
        }

        let genArgs: string[];

        if (thumbLocal && fs.existsSync(thumbLocal)) {
          genArgs = [
            '-loop', '1',
            '-i', thumbLocal,
            '-f', 'lavfi',
            '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-t', '10',
            '-c:a', 'aac',
            '-b:a', '128k',
            broadcastLoopPath,
            '-y',
          ];
        } else {
          genArgs = [
            '-f', 'lavfi',
            '-i', 'color=c=0x090D16:s=1920x1080:r=30:d=10',
            '-f', 'lavfi',
            '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-t', '10',
            broadcastLoopPath,
            '-y',
          ];
        }

        await new Promise<void>((resolve, reject) => {
          execFile('ffmpeg', genArgs, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (genErr) {
        console.warn('[YouTube Stream Loop Generation Warning]:', genErr);
      }
    }

    if (fs.existsSync(broadcastLoopPath) && fs.statSync(broadcastLoopPath).size > 0) {
      v.path = broadcastLoopPath;
      return { inputPath: broadcastLoopPath, isRemote: false, hasAudio: true };
    }

    // 6. If sourceUrl is available as fallback
    if (v.sourceUrl) {
      return { inputPath: v.sourceUrl, isRemote: true, hasAudio: true };
    }

    throw new Error(`Video file missing on server storage disk: ${v.originalName}. Please re-upload or re-import the video.`);
  }

  public async startStream(config: StreamConfig, userDetails?: { email: string; name: string }): Promise<{ success: boolean; message: string }> {
    if (this.ffmpegProcess && this.status === 'LIVE') {
      return { success: false, message: 'Your stream is already active and streaming.' };
    }
    if (this.pid) {
      try {
        process.kill(this.pid, 0);
        return { success: false, message: 'Stream process is already running on server.' };
      } catch {
        this.pid = null;
        this.ffmpegProcess = null;
      }
    }

    if (userDetails) {
      this.userEmail = userDetails.email;
      this.userName = userDetails.name;
    }

    this.desiredState = 'RUNNING';
    this.userRequestedStop = false;
    this.isIntentionallyStopping = false;
    this.lastError = null;
    this.activeConfig = config;
    db.saveUserStreamConfig(this.userId, config);
    this.saveState();

    this.updateStatus('STARTING', 'Validating video playlist and preparing RTMP ingest...');

    const resolvedIds = config.videoIds && config.videoIds.length > 0
      ? config.videoIds
      : (config.videoId ? [config.videoId] : []);

    if (resolvedIds.length === 0) {
      this.updateStatus('ERROR', 'No video items selected.');
      return { success: false, message: 'Please select at least one video to stream.' };
    }

    // Resolve videos
    const playlistVideos: PlaylistItem[] = [];
    let totalDur = 0;

    for (const vid of resolvedIds) {
      const v = db.getVideoById(vid, this.userId);
      if (!v) {
        this.updateStatus('ERROR', `Video ${vid} could not be found.`);
        return { success: false, message: `Video item not found in library.` };
      }

      let sourceInfo;
      try {
        sourceInfo = await this.resolveVideoSource(v);
      } catch (err: any) {
        this.updateStatus('ERROR', err.message);
        return { success: false, message: err.message };
      }

      playlistVideos.push({
        id: v.id,
        originalName: v.originalName,
        storedName: v.storedName,
        path: sourceInfo.inputPath,
        duration: v.duration || 10,
        size: v.size || 0,
        width: v.width || 1920,
        height: v.height || 1080,
        fps: v.fps || 30,
        hasAudio: sourceInfo.hasAudio,
        thumbnailUrl: v.thumbnailUrl,
        driveFileId: v.driveFileId,
        storageProvider: v.storageProvider,
      });
      totalDur += v.duration || 0;
    }

    this.activePlaylist = playlistVideos;
    this.totalPlaylistDuration = totalDur;

    // Create FFmpeg concat playlist file
    try {
      const playlistContent = playlistVideos
        .map(p => `file '${p.path.replace(/'/g, "'\\''")}'`)
        .join('\n');
      fs.writeFileSync(this.getPlaylistFile(), playlistContent, 'utf-8');
    } catch (e: any) {
      this.updateStatus('ERROR', `Failed to write playlist file: ${e.message}`);
      return { success: false, message: 'Could not create playlist file.' };
    }

    // Build FFmpeg command arguments
    const ffmpegArgs = this.buildFFmpegArgs(config);

    this.addLog('system', `Launching FFmpeg background process for user ${this.userEmail || this.userId}...`);

    try {
      const proc = spawn(this.ffmpegPath, ffmpegArgs, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.ffmpegProcess = proc;
      this.pid = proc.pid || null;
      this.startedAt = new Date();
      this.stoppedAt = null;

      if (this.pid) this.writeLock(this.pid);

      // Create session record
      const session: StreamSession = {
        id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        userId: this.userId,
        userEmail: this.userEmail,
        userName: this.userName,
        videoId: playlistVideos[0]?.id,
        videoName: playlistVideos.length > 1 ? `Playlist (${playlistVideos.length} videos)` : playlistVideos[0]?.originalName,
        videoIds: playlistVideos.map(p => p.id),
        videoNames: playlistVideos.map(p => p.originalName),
        isPlaylist: playlistVideos.length > 1,
        playlistCount: playlistVideos.length,
        rtmpUrlMasked: config.rtmpUrl.replace(/live2.*/, 'live2/***'),
        startedAt: this.startedAt.toISOString(),
        stoppedAt: null,
        durationSeconds: 0,
        status: 'SUCCESS',
        reconnectCount: 0,
        errorMessage: null,
      };
      this.currentSessionId = session.id;
      db.addSession(session);

      proc.stdout.on('data', (data) => {
        const text = data.toString().trim();
        if (text) this.addLog('stdout', text);
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        this.parseStderr(text);
      });

      proc.on('close', (code, signal) => {
        this.handleProcessClose(code, signal);
      });

      proc.on('error', (err) => {
        this.addLog('error', `FFmpeg Process Error: ${err.message}`);
        this.lastError = err.message;
        this.updateStatus('ERROR', err.message);
      });

      // After 3 seconds, if process is still alive, mark LIVE
      setTimeout(() => {
        if (this.ffmpegProcess && !this.ffmpegProcess.killed && this.status === 'STARTING') {
          this.updateStatus('LIVE', 'Stream successfully active and pushing to YouTube RTMP.');
        }
      }, 3000);

      return { success: true, message: 'Stream process started successfully on server.' };
    } catch (e: any) {
      this.updateStatus('ERROR', `Failed to start stream process: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  private buildFFmpegArgs(config: StreamConfig): string[] {
    const args: string[] = [];

    // Global flags
    args.push('-hide_banner');
    args.push('-loglevel', 'info');

    const isSingleVideo = this.activePlaylist.length === 1;
    const hasAudio = this.activePlaylist.some(v => v.hasAudio !== false);

    if (isSingleVideo) {
      const singleVideoPath = this.activePlaylist[0].path;
      if (config.loop) {
        args.push('-stream_loop', '-1');
      }
      args.push('-re');
      args.push('-i', singleVideoPath);
    } else {
      if (config.loop) {
        args.push('-stream_loop', '-1');
      }
      args.push('-f', 'concat');
      args.push('-safe', '0');
      args.push('-re');
      args.push('-i', this.getPlaylistFile());
    }

    // If source video has no audio track, inject silent audio stream for YouTube ingestion compliance
    if (config.audio && !hasAudio) {
      args.push('-f', 'lavfi');
      args.push('-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
    }

    // Video encoding options
    args.push('-c:v', 'libx264');
    args.push('-preset', 'veryfast');
    args.push('-tune', 'zerolatency');
    args.push('-pix_fmt', 'yuv420p');

    // Quality / Bitrate / Scaling
    if (config.quality === '1080p') {
      args.push('-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2');
    } else if (config.quality === '720p') {
      args.push('-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2');
    }

    // Framerate
    if (config.fps === '60') {
      args.push('-r', '60');
      args.push('-g', '120');
      args.push('-keyint_min', '120');
    } else if (config.fps === '30') {
      args.push('-r', '30');
      args.push('-g', '60');
      args.push('-keyint_min', '60');
    } else {
      args.push('-g', '60');
      args.push('-keyint_min', '60');
    }

    const bitrate = config.bitrate && config.bitrate !== 'auto' ? config.bitrate : '4000k';
    args.push('-b:v', bitrate);
    args.push('-maxrate', bitrate);
    args.push('-bufsize', `${parseInt(bitrate, 10) * 2}k`);
    args.push('-sc_threshold', '0');

    // Audio options
    if (config.audio) {
      if (!hasAudio) {
        // Map video from input 0 and audio from input 1 (lavfi silent source)
        args.push('-map', '0:v:0');
        args.push('-map', '1:a:0');
      }
      args.push('-c:a', 'aac');
      args.push('-b:a', '160k');
      args.push('-ar', '44100');
    } else {
      args.push('-an');
    }

    // Output format: FLV over RTMP
    args.push('-f', 'flv');

    // Clean RTMP destination URL
    const cleanRtmp = config.rtmpUrl.trim().replace(/\/+$/, '');
    const cleanKey = config.streamKey.trim().replace(/^\/+/, '');
    const targetUrl = `${cleanRtmp}/${cleanKey}`;

    args.push(targetUrl);

    return args;
  }

  public async testConnection(config: {
    rtmpUrl: string;
    streamKey: string;
    videoId?: string;
    videoIds?: string[];
  }): Promise<{ success: boolean; message: string }> {
    // 1. Check RTMP URL format
    if (!config.rtmpUrl || (!config.rtmpUrl.startsWith('rtmp://') && !config.rtmpUrl.startsWith('rtmps://'))) {
      return { success: false, message: 'Invalid Stream URL format. Must begin with rtmp:// or rtmps:// (e.g. rtmps://a.rtmp.youtube.com:443/live2)' };
    }

    // 2. Check Stream Key
    if (!config.streamKey || config.streamKey.trim().length < 4) {
      return { success: false, message: 'Invalid or missing YouTube Stream Key.' };
    }

    // 3. Check FFmpeg binary
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync(`${this.ffmpegPath} -version`);
    } catch (err: any) {
      return { success: false, message: `FFmpeg binary is not reachable on server: ${err.message}` };
    }

    // 4. Check Video Files
    const vIds = config.videoIds && config.videoIds.length > 0 ? config.videoIds : (config.videoId ? [config.videoId] : []);
    if (vIds.length > 0) {
      for (const vid of vIds) {
        const v = db.getVideoById(vid, this.userId);
        if (!v) {
          return { success: false, message: `Video not found in your library (ID: ${vid})` };
        }
        try {
          await this.resolveVideoSource(v);
        } catch (err: any) {
          return { success: false, message: err.message || `Video stream source missing for ${v.originalName}` };
        }
      }
    }

    // 5. Check DNS / Host connectivity
    try {
      const dns = await import('dns/promises');
      const cleanHost = config.rtmpUrl.replace(/^rtmps?:\/\//i, '').split(/[:/]/)[0];
      if (cleanHost) {
        await dns.lookup(cleanHost);
      }
    } catch (dnsErr: any) {
      return { success: false, message: `Cannot resolve stream host address (${config.rtmpUrl}): ${dnsErr.message}` };
    }

    return {
      success: true,
      message: 'Configuration Verified! Stream URL, Stream Key, Video File, and FFmpeg server engine are ready to stream.',
    };
  }

  private parseStderr(text: string) {
    // Log meaningful messages
    if (text.includes('Opening') || text.includes('Stream #') || text.includes('Output #') || text.includes('error')) {
      this.addLog('stderr', text.trim());
    }

    // Parse real-time progress stats
    const frameMatch = text.match(/frame=\s*(\d+)/);
    const fpsMatch = text.match(/fps=\s*([\d.]+)/);
    const qMatch = text.match(/q=\s*([\d.-]+)/);
    const sizeMatch = text.match(/size=\s*(\S+)/);
    const timeMatch = text.match(/time=\s*([\d:.]+)/);
    const bitrateMatch = text.match(/bitrate=\s*(\S+)/);
    const speedMatch = text.match(/speed=\s*(\S+)/);

    if (fpsMatch || bitrateMatch || timeMatch) {
      this.realtimeStats = {
        frame: frameMatch ? parseInt(frameMatch[1], 10) : this.realtimeStats.frame,
        fps: fpsMatch ? parseFloat(fpsMatch[1]) : this.realtimeStats.fps,
        q: qMatch ? parseFloat(qMatch[1]) : this.realtimeStats.q,
        size: sizeMatch ? sizeMatch[1] : this.realtimeStats.size,
        time: timeMatch ? timeMatch[1] : this.realtimeStats.time,
        bitrate: bitrateMatch ? bitrateMatch[1] : this.realtimeStats.bitrate,
        speed: speedMatch ? speedMatch[1] : this.realtimeStats.speed,
      };

      if (this.status !== 'LIVE' && !this.isIntentionallyStopping) {
        this.updateStatus('LIVE', 'FFmpeg encoding and streaming active.');
      }
    }
  }

  private handleProcessClose(code: number | null, signal: NodeJS.Signals | null) {
    this.stoppedAt = new Date();
    this.releaseLock();
    const pid = this.pid;
    this.ffmpegProcess = null;
    this.pid = null;

    let durationSeconds = 0;
    if (this.startedAt) {
      durationSeconds = Math.floor((this.stoppedAt.getTime() - this.startedAt.getTime()) / 1000);
    }

    if (this.currentSessionId) {
      db.updateSession(this.currentSessionId, {
        stoppedAt: this.stoppedAt.toISOString(),
        durationSeconds,
        status: this.userRequestedStop ? 'STOPPED' : (code === 0 ? 'STOPPED' : 'CRASHED'),
        reconnectCount: this.reconnectCount,
      });
    }

    if (this.userRequestedStop || this.isIntentionallyStopping) {
      this.updateStatus('STOPPED', `Stream manually stopped (Duration: ${durationSeconds}s).`);
      return;
    }

    this.addLog('error', `FFmpeg process ${pid} exited unexpectedly with code ${code}, signal: ${signal}`);

    if (this.activeConfig?.autoReconnect) {
      this.reconnectCount++;
      const delay = this.activeConfig.reconnectDelay || 5;
      this.updateStatus('RECONNECTING', `Stream interrupted. Auto-reconnecting in ${delay}s (Attempt #${this.reconnectCount})...`);

      this.reconnectTimeout = setTimeout(() => {
        if (!this.userRequestedStop && this.activeConfig) {
          this.startStream(this.activeConfig);
        }
      }, delay * 1000);
    } else {
      this.updateStatus('ERROR', `Stream terminated unexpectedly with code ${code}.`);
    }
  }

  public async stopStream(): Promise<{ success: boolean; message: string }> {
    this.desiredState = 'STOPPED';
    this.userRequestedStop = true;
    this.isIntentionallyStopping = true;
    this.saveState();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (!this.ffmpegProcess || this.status === 'STOPPED') {
      this.updateStatus('STOPPED', 'Stream is already stopped.');
      this.releaseLock();
      return { success: true, message: 'Stream is stopped.' };
    }

    this.updateStatus('STOPPING', 'Terminating FFmpeg stream process...');

    try {
      this.ffmpegProcess.kill('SIGTERM');

      // Fallback force kill after 4 seconds
      setTimeout(() => {
        if (this.ffmpegProcess) {
          try {
            this.ffmpegProcess.kill('SIGKILL');
          } catch {}
        }
      }, 4000);

      this.releaseLock();
      return { success: true, message: 'Stream stopped successfully.' };
    } catch (e: any) {
      return { success: false, message: `Failed to stop stream: ${e.message}` };
    }
  }
}

// Master Streaming Service Coordinator
export class StreamingService extends EventEmitter {
  private static instance: StreamingService;
  private engines = new Map<string, UserStreamEngine>();

  private constructor() {
    super();
    // Auto-discover and initialize engines for all users and saved state files on server boot
    try {
      const users = db.getUsers();
      for (const u of users) {
        this.getUserEngine(u.id);
      }
      if (fs.existsSync(DATA_DIR)) {
        const files = fs.readdirSync(DATA_DIR);
        for (const f of files) {
          if (f.startsWith('stream_state_') && f.endsWith('.json')) {
            const uId = f.replace('stream_state_', '').replace('.json', '');
            if (uId) {
              this.getUserEngine(uId);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[StreamingService] Failed to auto-initialize user engines on boot:', e);
    }
  }

  public static getInstance(): StreamingService {
    if (!StreamingService.instance) {
      StreamingService.instance = new StreamingService();
    }
    return StreamingService.instance;
  }

  public getUserEngine(userId: string): UserStreamEngine {
    if (!this.engines.has(userId)) {
      const engine = new UserStreamEngine(userId);
      this.engines.set(userId, engine);
    }
    return this.engines.get(userId)!;
  }

  public getActiveStreamsCount(): number {
    let count = 0;
    for (const engine of this.engines.values()) {
      if (engine.status === 'LIVE' || engine.status === 'STARTING' || engine.status === 'RECONNECTING') {
        count++;
      }
    }
    return count;
  }

  public getStatus(userId?: string): StreamState {
    if (userId) {
      return this.getUserEngine(userId).getStatus();
    }
    // Default fallback
    const first = Array.from(this.engines.values())[0];
    if (first) return first.getStatus();

    return {
      status: 'STOPPED',
      config: null,
      video: null,
      playlist: [],
      currentVideo: null,
      currentIndex: 0,
      currentLoop: 1,
      totalDurationSeconds: 0,
      loopProgressPercent: 0,
      currentVideoProgressPercent: 0,
      currentVideoElapsedSeconds: 0,
      pid: null,
      startedAt: null,
      stoppedAt: null,
      uptimeSeconds: 0,
      uptimeFormatted: '00:00:00',
      reconnectCount: 0,
      lastError: null,
      lastMessage: 'Ready for stream',
      realtimeStats: {
        frame: 0,
        fps: 0,
        q: 0,
        size: '0kB',
        time: '00:00:00.00',
        bitrate: '0kbits/s',
        speed: '0x',
      },
    };
  }

  public async startStream(
    userId: string,
    config: StreamConfig,
    userDetails?: { email: string; name: string }
  ): Promise<{ success: boolean; message: string }> {
    const settings = db.getSettings();
    const activeCount = this.getActiveStreamsCount();
    const engine = this.getUserEngine(userId);

    // If stream is not already running and limit reached
    if (engine.status !== 'LIVE' && activeCount >= settings.maxConcurrentStreams) {
      return {
        success: false,
        message: `Maximum concurrent active streams limit reached (${settings.maxConcurrentStreams}). Please wait for another stream to finish or contact the administrator.`,
      };
    }

    return engine.startStream(config, userDetails);
  }

  public async stopStream(userId: string): Promise<{ success: boolean; message: string }> {
    const engine = this.getUserEngine(userId);
    return engine.stopStream();
  }

  public async restartStream(userId: string): Promise<{ success: boolean; message: string }> {
    const engine = this.getUserEngine(userId);
    if (!engine.activeConfig) {
      return { success: false, message: 'No active stream configuration found to restart.' };
    }
    await engine.stopStream();
    return engine.startStream(engine.activeConfig);
  }

  public async testConnection(
    userId: string,
    config: { rtmpUrl: string; streamKey: string; videoId?: string; videoIds?: string[] }
  ): Promise<{ success: boolean; message: string }> {
    const engine = this.getUserEngine(userId);
    return engine.testConnection(config);
  }

  public getLogs(userId: string, limit = 100): LogEntry[] {
    return this.getUserEngine(userId).getLogs(limit);
  }

  public clearLogs(userId: string) {
    this.getUserEngine(userId).clearLogs();
  }

  public async validatePlaylist(userId: string, videoIds: string[]): Promise<{ valid: boolean; message: string; invalidVideos?: string[] }> {
    const invalid: string[] = [];
    for (const id of videoIds) {
      const v = db.getVideoById(id, userId);
      if (!v) {
        invalid.push(`ID: ${id} (Not found)`);
      }
    }
    if (invalid.length > 0) {
      return { valid: false, message: `Some videos could not be found: ${invalid.join(', ')}`, invalidVideos: invalid };
    }
    return { valid: true, message: 'All playlist videos verified successfully.' };
  }

  public getAllActiveStreams(): AdminStreamItem[] {
    const users = db.getUsers();
    const items: AdminStreamItem[] = [];

    for (const user of users) {
      const engine = this.engines.get(user.id);
      const status = engine ? engine.getStatus() : null;

      if (status && (status.status === 'LIVE' || status.status === 'STARTING' || status.status === 'RECONNECTING')) {
        items.push({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          userAvatar: user.avatar,
          status: status.status,
          pid: status.pid,
          startedAt: status.startedAt,
          uptimeFormatted: status.uptimeFormatted,
          currentVideoName: status.currentVideo?.originalName || 'None',
          playlistCount: status.playlist.length,
          rtmpUrlMasked: status.config?.rtmpUrl ? status.config.rtmpUrl.replace(/live2.*/, 'live2/***') : 'rtmps://...:443',
          realtimeStats: status.realtimeStats,
        });
      }
    }

    return items;
  }

  public async stopUserStreamByAdmin(targetUserId: string): Promise<{ success: boolean; message: string }> {
    const engine = this.engines.get(targetUserId);
    if (!engine) {
      return { success: true, message: 'Target user has no running stream.' };
    }
    return engine.stopStream();
  }
}

export const streamingService = StreamingService.getInstance();
