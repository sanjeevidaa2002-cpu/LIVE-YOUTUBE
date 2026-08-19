import { spawn, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface ExtractedVideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  videoCodec: string;
  audioCodec?: string;
  hasAudio: boolean;
  thumbnailStoredName?: string;
}

export interface VideoValidationResult {
  valid: boolean;
  reason?: string;
  info?: ExtractedVideoInfo;
}

export class FFprobeService {
  private static ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';
  private static ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

  public static async checkAvailability(): Promise<{
    ffmpegInstalled: boolean;
    ffmpegVersion: string | null;
    ffprobeInstalled: boolean;
    ffprobeVersion: string | null;
  }> {
    const result = {
      ffmpegInstalled: false,
      ffmpegVersion: null as string | null,
      ffprobeInstalled: false,
      ffprobeVersion: null as string | null,
    };

    try {
      const ffmpegOut = await new Promise<string>((resolve, reject) => {
        execFile(this.ffmpegPath, ['-version'], (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout);
        });
      });
      result.ffmpegInstalled = true;
      const firstLine = ffmpegOut.split('\n')[0];
      result.ffmpegVersion = firstLine ? firstLine.trim() : 'Installed';
    } catch {
      result.ffmpegInstalled = false;
    }

    try {
      const ffprobeOut = await new Promise<string>((resolve, reject) => {
        execFile(this.ffprobePath, ['-version'], (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout);
        });
      });
      result.ffprobeInstalled = true;
      const firstLine = ffprobeOut.split('\n')[0];
      result.ffprobeVersion = firstLine ? firstLine.trim() : 'Installed';
    } catch {
      result.ffprobeInstalled = false;
    }

    return result;
  }

  public static async getVersion(): Promise<string | null> {
    const avail = await this.checkAvailability();
    return avail.ffprobeVersion;
  }

  public static async validateVideoForStreaming(videoFilePath: string): Promise<VideoValidationResult> {
    if (!videoFilePath) {
      return { valid: false, reason: 'File path is empty or undefined.' };
    }

    if (!fs.existsSync(videoFilePath)) {
      return { valid: false, reason: `File does not exist on server storage: ${videoFilePath}` };
    }

    try {
      fs.accessSync(videoFilePath, fs.constants.R_OK);
    } catch (err: any) {
      return { valid: false, reason: `File is not readable: ${err.message}` };
    }

    try {
      const info = await this.extractMetadata(videoFilePath);
      if (!info.duration || info.duration <= 0) {
        return { valid: false, reason: 'Invalid or zero video duration detected by FFprobe.' };
      }
      if (!info.width || !info.height || info.width <= 0 || info.height <= 0) {
        return { valid: false, reason: 'Invalid video dimensions detected by FFprobe.' };
      }
      if (!info.videoCodec) {
        return { valid: false, reason: 'No valid video codec found in file stream.' };
      }

      return { valid: true, info };
    } catch (err: any) {
      return { valid: false, reason: `FFprobe inspection failed: ${err.message}` };
    }
  }

  public static async extractMetadata(videoFilePath: string): Promise<ExtractedVideoInfo> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(videoFilePath) || fs.statSync(videoFilePath).size === 0) {
        return reject(new Error(`Media file does not exist or is empty (0 bytes): ${videoFilePath}`));
      }

      const args = [
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoFilePath
      ];

      const child = spawn(this.ffprobePath, args);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to execute ffprobe: ${err.message}`));
      });

      child.on('close', async (code) => {
        if (code !== 0) {
          return reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        }

        try {
          const parsed = JSON.parse(stdout);
          const videoStream = parsed.streams?.find((s: any) => s.codec_type === 'video');
          const audioStream = parsed.streams?.find((s: any) => s.codec_type === 'audio');

          if (!videoStream) {
            return reject(new Error('No video stream found in media file.'));
          }

          const duration = parseFloat(parsed.format?.duration || videoStream?.duration || '0');
          const width = parseInt(videoStream?.width || '1920', 10);
          const height = parseInt(videoStream?.height || '1080', 10);
          
          // Compute FPS
          let fps = 30;
          if (videoStream?.r_frame_rate) {
            const parts = videoStream.r_frame_rate.split('/');
            if (parts.length === 2 && parseFloat(parts[1]) > 0) {
              const val = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
              if (val > 0 && val <= 120) {
                fps = val;
              } else if (videoStream?.avg_frame_rate) {
                const avgParts = videoStream.avg_frame_rate.split('/');
                if (avgParts.length === 2 && parseFloat(avgParts[1]) > 0) {
                  const avgVal = Math.round(parseFloat(avgParts[0]) / parseFloat(avgParts[1]));
                  if (avgVal > 0 && avgVal <= 120) {
                    fps = avgVal;
                  }
                }
              }
            }
          }
          if (fps > 120 || fps <= 0) fps = 30;

          const bitrate = parseInt(parsed.format?.bit_rate || videoStream?.bit_rate || '4000000', 10);
          const videoCodec = videoStream?.codec_name || 'h264';
          const audioCodec = audioStream?.codec_name || undefined;
          const hasAudio = !!audioStream;

          // Generate a thumbnail if not present
          let thumbnailStoredName: string | undefined;
          try {
            thumbnailStoredName = await this.generateThumbnail(videoFilePath, duration);
          } catch (thumbErr) {
            console.warn('Thumbnail generation warning:', thumbErr);
          }

          resolve({
            duration,
            width,
            height,
            fps: fps || 30,
            bitrate,
            videoCodec,
            audioCodec,
            hasAudio,
            thumbnailStoredName,
          });
        } catch (parseErr) {
          reject(new Error(`Failed to parse ffprobe output: ${(parseErr as Error).message}`));
        }
      });
    });
  }

  public static async generateThumbnail(videoFilePath: string, duration: number): Promise<string> {
    const thumbDir = path.resolve(process.cwd(), 'uploads', 'thumbnails');
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }

    const thumbName = `thumb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const outputPath = path.join(thumbDir, thumbName);
    
    // Seek to 10% of the video or 1 second to avoid initial black frames
    const seekTime = Math.min(Math.max(1, duration * 0.1), 10);

    return new Promise((resolve, reject) => {
      const args = [
        '-ss', seekTime.toString(),
        '-i', videoFilePath,
        '-vframes', '1',
        '-q:v', '3',
        '-vf', 'scale=640:-1',
        outputPath,
        '-y'
      ];

      const child = spawn(this.ffmpegPath, args);

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve(thumbName);
        } else {
          reject(new Error(`Thumbnail generation failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Ensures that a video file has an audio track. If missing, produces a lightweight
   * copy with silent AAC stereo audio so concat demuxer runs seamlessly without audio dropouts.
   */
  public static async ensureAudioTrack(sourceFilePath: string, videoId: string): Promise<string> {
    try {
      const info = await this.extractMetadata(sourceFilePath);
      if (info.hasAudio) {
        return sourceFilePath;
      }

      const normalizedDir = path.resolve(process.cwd(), 'uploads', 'normalized');
      if (!fs.existsSync(normalizedDir)) {
        fs.mkdirSync(normalizedDir, { recursive: true });
      }

      const targetPath = path.join(normalizedDir, `audio_${videoId}.mp4`);
      if (fs.existsSync(targetPath)) {
        return targetPath;
      }

      return new Promise((resolve, reject) => {
        const args = [
          '-i', sourceFilePath,
          '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-shortest',
          targetPath,
          '-y'
        ];

        const child = spawn(this.ffmpegPath, args);
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0 && fs.existsSync(targetPath)) {
            resolve(targetPath);
          } else {
            // Fallback to original
            resolve(sourceFilePath);
          }
        });
      });
    } catch {
      return sourceFilePath;
    }
  }
}
