import { spawn, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { FFprobeService, ExtractedVideoInfo } from './ffprobeService.ts';
import { CookiesService } from './cookiesService.ts';
import { fetchYouTubeMetadata } from '../utils/youtube.ts';
import { VideoMetadata } from '../../src/types/index.ts';

export interface YouTubeDownloadResult {
  filePath: string;
  storedName: string;
  originalName: string;
  videoId: string;
  duration: number;
  channelTitle?: string;
  thumbnailUrl?: string;
  sourceUrl: string;
  isBroadcastLoop?: boolean;
}

export class YouTubeDownloadService {
  private static cachedBinaryPath: string | null = null;

  /**
   * Locate the yt-dlp binary on the system
   */
  public static getYtDlpBinary(): string {
    if (this.cachedBinaryPath && fs.existsSync(this.cachedBinaryPath)) {
      return this.cachedBinaryPath;
    }

    const candidatePaths = [
      '/usr/local/bin/yt-dlp',
      path.resolve(process.cwd(), 'bin', 'yt-dlp'),
      path.resolve(process.cwd(), 'bin', 'yt-dlp.exe'),
      'yt-dlp',
    ];

    for (const p of candidatePaths) {
      if (p === 'yt-dlp') {
        this.cachedBinaryPath = 'yt-dlp';
        return 'yt-dlp';
      }
      if (fs.existsSync(p)) {
        try {
          fs.accessSync(p, fs.constants.X_OK);
          this.cachedBinaryPath = p;
          return p;
        } catch {}
      }
    }

    this.cachedBinaryPath = 'yt-dlp';
    return 'yt-dlp';
  }

  /**
   * Extract YouTube Video ID from any YouTube URL
   */
  public static extractVideoId(url: string): { videoId: string; isLiveUrl: boolean; normalizedUrl: string } | null {
    if (!url || typeof url !== 'string') return null;
    const clean = url.trim();

    const isLive = /youtube\.com\/live\/[a-zA-Z0-9_-]{11}/i.test(clean) || /[?&]live=1/i.test(clean);

    const patterns = [
      /(?:youtube\.com\/(?:watch\?.*v=|live\/|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
      /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/i,
    ];

    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match && match[1]) {
        return {
          videoId: match[1],
          isLiveUrl: isLive,
          normalizedUrl: `https://www.youtube.com/watch?v=${match[1]}`,
        };
      }
    }

    return null;
  }

  /**
   * Fetch video info / title / duration using yt-dlp or oEmbed fallback
   */
  public static async fetchVideoInfo(url: string): Promise<{
    title: string;
    duration: number;
    channelTitle?: string;
    thumbnailUrl?: string;
    videoId: string;
  }> {
    const yt = this.extractVideoId(url);
    if (!yt) {
      return {
        title: 'YouTube Video',
        duration: 0,
        videoId: 'unknown',
      };
    }

    // Try YouTube metadata utility first (fast, reliable, no bot blocks)
    try {
      const meta = await fetchYouTubeMetadata(yt.videoId, yt.isLiveUrl);
      if (meta && meta.title && meta.title !== 'YouTube Video') {
        return {
          title: meta.title,
          duration: meta.durationSeconds || 0,
          channelTitle: meta.channelTitle,
          thumbnailUrl: meta.thumbnailUrl,
          videoId: yt.videoId,
        };
      }
    } catch {}

    const cookiesPath = CookiesService.getCookiesPath();

    // If cookies are not configured, do not spawn yt-dlp on datacenter IPs to avoid bot check errors
    if (!cookiesPath) {
      return {
        title: `YouTube Video (${yt.videoId})`,
        duration: 0,
        videoId: yt.videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${yt.videoId}/hqdefault.jpg`,
      };
    }

    const ytBinary = this.getYtDlpBinary();

    return new Promise((resolve) => {
      const args = [
        '--no-playlist',
        '--no-warnings',
        '--extractor-args', 'youtube:player_client=default,-android_sdkless',
        '--dump-json',
        '--cookies', cookiesPath,
        yt.normalizedUrl,
      ];

      execFile(ytBinary, args, { timeout: 15000 }, (err, stdout) => {
        if (!err && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim().split('\n')[0]);
            return resolve({
              title: parsed.title || `YouTube Video (${yt.videoId})`,
              duration: parsed.duration || 0,
              channelTitle: parsed.channel || parsed.uploader || undefined,
              thumbnailUrl: parsed.thumbnail || `https://img.youtube.com/vi/${yt.videoId}/hqdefault.jpg`,
              videoId: parsed.id || yt.videoId,
            });
          } catch {}
        }

        resolve({
          title: `YouTube Video (${yt.videoId})`,
          duration: 0,
          videoId: yt.videoId,
          thumbnailUrl: `https://img.youtube.com/vi/${yt.videoId}/hqdefault.jpg`,
        });
      });
    });
  }

  /**
   * Dedicated test method for verifying configured cookies with YouTube
   */
  public static async testCookiesWithYouTube(): Promise<{ success: boolean; title: string }> {
    const cookiesPath = CookiesService.getCookiesPath();
    if (!cookiesPath) {
      throw new Error('No YouTube cookies found. Please paste your cookies.txt or JSON data first.');
    }

    const ytBinary = this.getYtDlpBinary();
    const testUrl = 'https://www.youtube.com/watch?v=1zZ1yVpYdZE';

    return new Promise((resolve, reject) => {
      const args = [
        '--no-playlist',
        '--dump-json',
        '--skip-download',
        '--cookies', cookiesPath,
        testUrl,
      ];

      execFile(ytBinary, args, { timeout: 15000 }, (err, stdout, stderr) => {
        if (!err && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim().split('\n')[0]);
            return resolve({
              success: true,
              title: parsed.title || 'YouTube Verification Clip',
            });
          } catch {}
        }

        const combinedErr = `${err?.message || ''} ${stderr || ''}`;
        const isBotCheck = combinedErr.includes('Sign in to confirm') || combinedErr.includes('bot') || combinedErr.includes('LOGIN_REQUIRED');
        if (isBotCheck) {
          return reject(new Error('YouTube rejected the cookies (bot protection triggered). Please export fresh cookies from an active logged-in browser session.'));
        }

        return reject(new Error('YouTube rejected the cookies or the session expired. Please export fresh cookies and try again.'));
      });
    });
  }

  /**
   * Generates or retrieves a validated, active 1080p broadcast media loop with AAC audio
   * for YouTube streams that cannot be directly dumped due to bot verification or live streams.
   */
  public static async ensurePlayableBroadcastLoop(
    videoId: string,
    outputDirectory: string,
    thumbnailUrl?: string
  ): Promise<{ filePath: string; duration: number; hasAudio: boolean; storedName: string }> {
    const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storedName = `yt_broadcast_${safeId}.mp4`;
    const broadcastLoopPath = path.join(outputDirectory, storedName);

    // If loop file exists and is valid, return immediately
    if (fs.existsSync(broadcastLoopPath) && fs.statSync(broadcastLoopPath).size > 2048) {
      try {
        const val = await FFprobeService.validateVideoForStreaming(broadcastLoopPath);
        if (val.valid && val.info) {
          return {
            filePath: broadcastLoopPath,
            storedName,
            duration: val.info.duration || 10,
            hasAudio: true,
          };
        }
      } catch {}
    }

    // Try downloading the thumbnail locally for a visual loop
    let thumbLocal = '';
    const candidateThumbUrls = [
      thumbnailUrl,
      `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    ].filter(Boolean) as string[];

    for (const tUrl of candidateThumbUrls) {
      try {
        const thumbPath = path.join(outputDirectory, `thumb_${safeId}.jpg`);
        const res = await fetch(tUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 1000) {
            fs.writeFileSync(thumbPath, buf);
            thumbLocal = thumbPath;
            break;
          }
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

    const val = await FFprobeService.validateVideoForStreaming(broadcastLoopPath);
    return {
      filePath: broadcastLoopPath,
      storedName,
      duration: val.info?.duration || 10,
      hasAudio: true,
    };
  }

  /**
   * Download a YouTube video to a local MP4 file on the server.
   * If cookies are configured, passes them to yt-dlp to bypass bot checks.
   */
  public static async downloadVideo(
    url: string,
    outputDirectory: string,
    preferredName?: string
  ): Promise<YouTubeDownloadResult> {
    const yt = this.extractVideoId(url);
    if (!yt) {
      throw new Error('Invalid YouTube URL. Please provide a valid watch, shorts, live, or youtu.be link.');
    }

    const ytBinary = this.getYtDlpBinary();
    const videoId = yt.videoId;
    const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const storedName = `yt_${safeId}_${timestamp}.mp4`;
    const destinationPath = path.join(outputDirectory, storedName);
    const cookiesPath = CookiesService.getCookiesPath();

    // If cookies are not configured, YouTube requires bot verification on datacenter IPs.
    // Fast-fail gracefully so the caller immediately generates the resilient 1080p broadcast loop
    // without spawning doomed unauthenticated child processes that trigger bot alerts.
    if (!cookiesPath) {
      console.log(`[YouTube Downloader] Direct download on datacenter IP requires cookies for ${yt.normalizedUrl}. Using 1080p broadcast stream loop.`);
      const customErr: any = new Error(`YouTube bot verification active (Sign in to confirm you're not a bot).`);
      customErr.isBotRestricted = true;
      customErr.videoId = videoId;
      throw customErr;
    }

    console.log(`[YouTube Downloader] Starting media acquisition for ${yt.normalizedUrl} -> ${destinationPath} (Using authenticated cookies)`);

    const clientStrategies = [
      'youtube:player_client=default,-android_sdkless',
      'youtube:player_client=web,default',
      'youtube:player_client=ios',
      'youtube:player_client=mweb',
    ];

    let lastError: any = null;
    let downloadSucceeded = false;

    for (const strategy of clientStrategies) {
      try {
        console.log(`[YouTube Downloader] Attempting download with strategy: ${strategy}`);
        await this.runDownloadProcess(ytBinary, yt.normalizedUrl, destinationPath, strategy, cookiesPath);

        if (fs.existsSync(destinationPath) && fs.statSync(destinationPath).size > 1024) {
          downloadSucceeded = true;
          break;
        }
      } catch (err: any) {
        lastError = err;
        const sanitizedNotice = (err.message || String(err)).replace(/ERROR:\s*\[youtube\]/g, 'Notice: [youtube]');
        console.log(`[YouTube Downloader] Strategy ${strategy} notice: ${sanitizedNotice.slice(0, 150)}`);
        if (fs.existsSync(destinationPath)) {
          try { fs.unlinkSync(destinationPath); } catch {}
        }
      }
    }

    if (!downloadSucceeded || !fs.existsSync(destinationPath) || fs.statSync(destinationPath).size === 0) {
      const cleanErrMsg = (lastError?.message || 'Download failed')
        .replace(/Traceback \(most recent call last\):[\s\S]*/, '')
        .trim();

      const isBotCheck = cleanErrMsg.includes('LOGIN_REQUIRED') || cleanErrMsg.includes('Sign in to confirm') || cleanErrMsg.includes('bot');
      const customErr: any = new Error(
        isBotCheck
          ? `YouTube bot verification active (Sign in to confirm you're not a bot).`
          : `Could not acquire media directly: ${cleanErrMsg}`
      );
      customErr.isBotRestricted = isBotCheck;
      customErr.cleanErrMsg = cleanErrMsg;
      customErr.videoId = videoId;
      throw customErr;
    }

    // Inspect downloaded video with FFprobe
    const validation = await FFprobeService.validateVideoForStreaming(destinationPath);
    if (!validation.valid || !validation.info) {
      if (fs.existsSync(destinationPath)) {
        try { fs.unlinkSync(destinationPath); } catch {}
      }
      throw new Error(`Downloaded media is not playable by FFmpeg: ${validation.reason || 'Invalid media streams'}`);
    }

    // Ensure audio stream exists
    if (!validation.info.hasAudio) {
      console.log(`[YouTube Downloader] Adding silent AAC audio track for RTMP compliance...`);
      const fixedPath = destinationPath.replace(/\.mp4$/i, '_audio.mp4');
      try {
        await new Promise<void>((resolve, reject) => {
          execFile('ffmpeg', [
            '-i', destinationPath,
            '-f', 'lavfi',
            '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-shortest',
            fixedPath,
            '-y',
          ], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        if (fs.existsSync(fixedPath) && fs.statSync(fixedPath).size > 0) {
          fs.unlinkSync(destinationPath);
          fs.renameSync(fixedPath, destinationPath);
        }
      } catch (audioErr) {
        console.warn(`[YouTube Downloader] Audio track insertion notice:`, audioErr);
        if (fs.existsSync(fixedPath)) {
          try { fs.unlinkSync(fixedPath); } catch {}
        }
      }
    }

    const finalMeta = await FFprobeService.extractMetadata(destinationPath);

    return {
      filePath: destinationPath,
      storedName,
      originalName: preferredName?.trim() || `YouTube - ${videoId}`,
      videoId,
      duration: finalMeta.duration || 0,
      thumbnailUrl: finalMeta.thumbnailStoredName
        ? `/api/videos/thumbnail/${finalMeta.thumbnailStoredName}`
        : `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      sourceUrl: yt.normalizedUrl,
      isBroadcastLoop: false,
    };
  }

  /**
   * Run the yt-dlp download child process
   */
  private static runDownloadProcess(
    ytBinary: string,
    url: string,
    destinationPath: string,
    extractorArg: string,
    cookiesPath: string | null
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '--no-playlist',
        '--extractor-args', extractorArg,
        '-f', 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
        '--merge-output-format', 'mp4',
        '-o', destinationPath,
        '--no-continue',
      ];

      if (cookiesPath && fs.existsSync(cookiesPath)) {
        args.push('--cookies', cookiesPath);
      }

      args.push(url);

      const child = spawn(ytBinary, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';

      child.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const cleanErr = stderr.replace(/ERROR:\s*\[youtube\]/g, 'Notice: [youtube]').trim();
          reject(new Error(`yt-dlp exited with code ${code}: ${cleanErr.slice(-400)}`));
        }
      });
    });
  }
}

