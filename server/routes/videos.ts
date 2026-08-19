import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { db } from '../database/db.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { FFprobeService } from '../services/ffprobeService.ts';
import { streamingService } from '../services/streamingService.ts';
import { VideoMetadata } from '../../src/types/index.ts';
import { extractYouTubeVideoId, fetchYouTubeMetadata } from '../utils/youtube.ts';

const router = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');
const TEMP_CHUNKS_DIR = path.join(UPLOADS_DIR, 'temp_chunks');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
if (!fs.existsSync(TEMP_CHUNKS_DIR)) fs.mkdirSync(TEMP_CHUNKS_DIR, { recursive: true });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const sbStorage = (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder'))
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Helper to optimize any video format into a web-compatible faststart MP4
async function processAndUploadVideo(filePath: string, userId: string, storedName: string, meta?: any): Promise<{ storageBucket: string; storagePath: string; storageProvider: 'supabase' | 'local'; finalPath: string }> {
  let finalPath = filePath;
  const optimizedPath = filePath.replace(/\.[^.]+$/i, '_fast.mp4');

  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      return { storageBucket: 'videos', storagePath: `videos/${userId}/${storedName}`, storageProvider: 'local', finalPath };
    }

    // Determine if audio is present
    let hasAudio = true;
    if (meta && typeof meta.hasAudio === 'boolean') {
      hasAudio = meta.hasAudio;
    } else {
      try {
        const probed = await FFprobeService.extractMetadata(filePath);
        hasAudio = probed.hasAudio;
      } catch {
        hasAudio = true;
      }
    }

    // Attempt 1: Fast stream-copy with +faststart
    let copySuccess = false;
    try {
      await new Promise<void>((resolve, reject) => {
        execFile('ffmpeg', [
          '-i', filePath,
          '-c', 'copy',
          '-movflags', '+faststart',
          optimizedPath,
          '-y'
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (fs.existsSync(optimizedPath) && fs.statSync(optimizedPath).size > 0) {
        if (filePath !== optimizedPath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        fs.renameSync(optimizedPath, filePath);
        finalPath = filePath;
        copySuccess = true;
      }
    } catch {
      copySuccess = false;
    }

    // Attempt 2: If stream copy fails (e.g. incompatible container or non-h264 codec), transcode safely with H.264
    if (!copySuccess) {
      try {
        const ffmpegArgs = [
          '-i', filePath,
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
          '-movflags', '+faststart',
          optimizedPath,
          '-y'
        ];

        await new Promise<void>((resolve, reject) => {
          execFile('ffmpeg', ffmpegArgs, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        if (fs.existsSync(optimizedPath) && fs.statSync(optimizedPath).size > 0) {
          if (filePath !== optimizedPath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          fs.renameSync(optimizedPath, filePath);
          finalPath = filePath;
        }
      } catch (encodeErr: any) {
        // Clean up any failed intermediate file
        if (fs.existsSync(optimizedPath)) {
          try { fs.unlinkSync(optimizedPath); } catch {}
        }
        console.warn('[Video Processor] Transcoding notice (keeping original file):', encodeErr.message || encodeErr);
      }
    }
  } catch (err: any) {
    if (fs.existsSync(optimizedPath)) {
      try { fs.unlinkSync(optimizedPath); } catch {}
    }
    console.warn('[Video Processor] Optimization note:', err.message || err);
  }

  const storageBucket = 'videos';
  const storagePath = `videos/${userId}/${storedName}`;
  let storageProvider: 'supabase' | 'local' = 'local';

  if (sbStorage && fs.existsSync(finalPath)) {
    try {
      const fileBuffer = fs.readFileSync(finalPath);
      const { error: uploadErr } = await sbStorage.storage
        .from(storageBucket)
        .upload(storagePath, fileBuffer, {
          contentType: 'video/mp4',
          upsert: true,
        });
      if (!uploadErr) {
        storageProvider = 'supabase';
        console.log(`[Supabase Storage] Successfully uploaded video to ${storageBucket}/${storagePath}`);
      } else {
        console.warn('[Supabase Storage] Upload warning:', uploadErr.message);
      }
    } catch (e) {
      console.warn('[Supabase Storage] Upload exception:', e);
    }
  }

  return { storageBucket, storagePath, storageProvider, finalPath };
}

// -----------------------------------------------------------------------------
// PUBLIC & MEDIA STREAMING ROUTES (Must be before requireAuth)
// -----------------------------------------------------------------------------

// GET /api/videos/thumbnail/:thumbName - Serve thumbnail image
router.get('/thumbnail/:thumbName', (req: Request, res: Response) => {
  const thumbName = path.basename(req.params.thumbName);
  const thumbPath = path.join(THUMBNAILS_DIR, thumbName);

  if (fs.existsSync(thumbPath)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(thumbPath);
  }
  return res.status(404).send('Thumbnail not found');
});

// GET /api/videos/:id/preview - Preview / Stream video with HTTP Range support
router.get('/:id/preview', async (req: Request, res: Response) => {
  const videoId = req.params.id;
  const video = db.getVideoById(videoId);
  
  if (!video) {
    // Check if directly a stored filename exists in UPLOADS_DIR
    const directPath = path.join(UPLOADS_DIR, path.basename(videoId));
    if (fs.existsSync(directPath)) {
      return serveLocalFile(directPath, req, res);
    }
    return res.status(404).json({ error: 'Video not found' });
  }

  // If this is an imported YouTube video or YouTube Live stream
  if (
    video.sourceType === 'YOUTUBE' ||
    video.sourceType === 'YOUTUBE_LIVE' ||
    video.youtubeVideoId
  ) {
    const ytId = video.youtubeVideoId || video.storedName;
    return res.json({
      isYouTube: true,
      youtubeVideoId: ytId,
      sourceType: video.sourceType,
      liveStatus: video.liveStatus || (video.sourceType === 'YOUTUBE_LIVE' ? 'LIVE' : 'NONE'),
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&enablejsapi=1&rel=0`,
      originalName: video.originalName,
      thumbnailUrl: video.thumbnailUrl,
    });
  }

  // If local file exists, serve with Range support and automatic web-compatibility check
  if (video.path && fs.existsSync(video.path)) {
    const ext = path.extname(video.path).toLowerCase();
    
    // If not a standard MP4 or WebM, ensure web-compatible version exists
    if (ext !== '.mp4' && ext !== '.webm') {
      const webVersionPath = `${video.path}.web.mp4`;
      if (!fs.existsSync(webVersionPath)) {
        try {
          const previewArgs = [
            '-i', video.path,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            ...(video.hasAudio !== false ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']),
            '-movflags', '+faststart',
            webVersionPath,
            '-y'
          ];

          await new Promise<void>((resolve, reject) => {
            execFile('ffmpeg', previewArgs, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (transcodeErr) {
          if (fs.existsSync(webVersionPath)) {
            try { fs.unlinkSync(webVersionPath); } catch {}
          }
          console.warn('[Preview Transcode Warning]:', transcodeErr);
        }
      }

      if (fs.existsSync(webVersionPath)) {
        return serveLocalFile(webVersionPath, req, res);
      }
    }

    return serveLocalFile(video.path, req, res);
  }

  // If Supabase storage path exists, attempt to redirect to signed/public URL or stream
  if (sbStorage && video.storageBucket && video.storagePath) {
    try {
      const { data } = sbStorage.storage.from(video.storageBucket).getPublicUrl(video.storagePath);
      if (data?.publicUrl) {
        return res.redirect(data.publicUrl);
      }
    } catch {}
  }

  return res.status(404).json({ error: 'Video file not found on disk or storage' });
});

// GET /api/videos/youtube/info - Detect and retrieve YouTube stream / video metadata before importing
router.get('/youtube/info', async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ detected: false, error: 'URL query parameter is required' });
    }

    const ytInfo = extractYouTubeVideoId(url);
    if (!ytInfo) {
      return res.status(200).json({ detected: false, error: 'Invalid or unsupported YouTube URL' });
    }

    const meta = await fetchYouTubeMetadata(ytInfo.videoId, ytInfo.isLiveUrl);
    return res.json({
      detected: true,
      videoId: ytInfo.videoId,
      isLiveUrl: ytInfo.isLiveUrl,
      normalizedUrl: ytInfo.normalizedUrl,
      title: meta.title,
      channelTitle: meta.channelTitle,
      thumbnailUrl: meta.thumbnailUrl,
      liveStatus: meta.liveStatus,
      isLiveStream: meta.isLiveStream,
      durationSeconds: meta.durationSeconds,
    });
  } catch (err: any) {
    return res.status(500).json({ detected: false, error: err.message || 'Failed to inspect YouTube URL' });
  }
});

function serveLocalFile(filePath: string, req: Request, res: Response) {
  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'video/mp4';
    if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.mov') contentType = 'video/quicktime';
    else if (ext === '.mkv') contentType = 'video/x-matroska';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err: any) {
    console.error('Error serving local video file:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream video file' });
    }
  }
}

// -----------------------------------------------------------------------------
// AUTHENTICATED MANAGEMENT ROUTES
// -----------------------------------------------------------------------------
router.use(requireAuth);

// Configure Multer storage for direct uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const cleanRandom = `vid_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, cleanRandom);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 * 5, // 5GB ceiling
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const settings = db.getSettings();
    const allowed = settings.allowedExtensions || ['.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts'];
    
    if (allowed.includes(ext) || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported video format (${ext}). Allowed formats: ${allowed.join(', ')}`));
    }
  },
});

// Multer in-memory storage for chunked upload slices
const chunkStorage = multer.memoryStorage();
const uploadChunk = multer({
  storage: chunkStorage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

// GET /api/videos - List all videos for authenticated user
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const videos = db.getVideos(req.user!.id);
  return res.json({ videos });
});

// GET /api/videos/:id - Single video metadata
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const video = db.getVideoById(req.params.id, req.user!.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }
  return res.json({ video });
});

// POST /api/videos/upload/init - Initialize chunked upload session
router.post('/upload/init', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { originalName, totalChunks, totalSize } = req.body;
    if (!originalName || !totalChunks || totalChunks <= 0) {
      return res.status(400).json({ error: 'originalName and valid totalChunks are required.' });
    }

    const ext = path.extname(originalName).toLowerCase();
    const settings = db.getSettings();
    const allowed = settings.allowedExtensions || ['.mp4', '.mkv', '.mov', '.avi', '.flv', '.webm', '.ts'];
    if (ext && !allowed.includes(ext)) {
      return res.status(400).json({ error: `Unsupported video format (${ext}). Allowed formats: ${allowed.join(', ')}` });
    }

    const uploadId = `upl_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const uploadSessionDir = path.join(TEMP_CHUNKS_DIR, uploadId);
    fs.mkdirSync(uploadSessionDir, { recursive: true });

    // Store session meta
    const meta = {
      uploadId,
      userId: req.user!.id,
      originalName,
      totalChunks: Number(totalChunks),
      totalSize: Number(totalSize) || 0,
      createdAt: Date.now(),
    };
    fs.writeFileSync(path.join(uploadSessionDir, 'session.json'), JSON.stringify(meta, null, 2), 'utf-8');

    return res.json({
      uploadId,
      message: 'Upload session initialized',
      chunkSize: 4 * 1024 * 1024,
      totalChunks: Number(totalChunks),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to initialize upload session' });
  }
});

// GET /api/videos/upload/status/:uploadId - Query which chunks are already on server
router.get('/upload/status/:uploadId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const safeUploadId = String(req.params.uploadId).replace(/[^a-zA-Z0-9_-]/g, '');
    const uploadSessionDir = path.join(TEMP_CHUNKS_DIR, safeUploadId);

    if (!fs.existsSync(uploadSessionDir)) {
      return res.status(404).json({ exists: false, error: 'Upload session not found or expired.' });
    }

    let sessionMeta: any = null;
    const sessionFile = path.join(uploadSessionDir, 'session.json');
    if (fs.existsSync(sessionFile)) {
      try {
        sessionMeta = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      } catch {}
    }

    const files = fs.readdirSync(uploadSessionDir);
    const uploadedChunks: number[] = [];
    for (const f of files) {
      if (f.startsWith('chunk_')) {
        const idx = parseInt(f.replace('chunk_', ''), 10);
        if (!isNaN(idx)) {
          const stat = fs.statSync(path.join(uploadSessionDir, f));
          if (stat.size > 0) {
            uploadedChunks.push(idx);
          }
        }
      }
    }

    uploadedChunks.sort((a, b) => a - b);
    const totalChunks = sessionMeta?.totalChunks || parseInt(String(req.query.totalChunks || '0'), 10);

    let missingChunks: number[] = [];
    if (totalChunks > 0) {
      const uploadedSet = new Set(uploadedChunks);
      for (let i = 0; i < totalChunks; i++) {
        if (!uploadedSet.has(i)) {
          missingChunks.push(i);
        }
      }
    }

    return res.json({
      exists: true,
      uploadId: safeUploadId,
      totalChunks,
      uploadedCount: uploadedChunks.length,
      uploadedChunks,
      missingChunks,
      isComplete: totalChunks > 0 && missingChunks.length === 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to check upload status' });
  }
});

// POST /api/videos/upload/chunk - Upload individual slice chunk
router.post('/upload/chunk', (req: AuthenticatedRequest, res: Response) => {
  uploadChunk.single('chunk')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Chunk upload failed' });
    }

    const { uploadId, chunkIndex } = req.body;
    if (!uploadId || chunkIndex === undefined || !req.file) {
      return res.status(400).json({ error: 'uploadId, chunkIndex, and chunk file are required.' });
    }

    const safeUploadId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, '');
    const uploadSessionDir = path.join(TEMP_CHUNKS_DIR, safeUploadId);
    if (!fs.existsSync(uploadSessionDir)) {
      return res.status(404).json({ error: 'Upload session not found or expired.' });
    }

    const idx = parseInt(String(chunkIndex), 10);
    if (isNaN(idx) || idx < 0) {
      return res.status(400).json({ error: 'Invalid chunk index provided.' });
    }

    const chunkPath = path.join(uploadSessionDir, `chunk_${idx}`);
    try {
      fs.writeFileSync(chunkPath, req.file.buffer);
      const stat = fs.statSync(chunkPath);
      return res.json({
        success: true,
        chunkIndex: idx,
        size: stat.size,
      });
    } catch (writeErr: any) {
      return res.status(500).json({ error: `Failed to save chunk ${idx}: ${writeErr.message}` });
    }
  });
});

// POST /api/videos/upload/complete - Assemble all chunks into final video file
router.post('/upload/complete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { uploadId, originalName, totalChunks } = req.body;
    if (!uploadId || !originalName || !totalChunks) {
      return res.status(400).json({ error: 'uploadId, originalName, and totalChunks are required.' });
    }

    const safeUploadId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, '');
    const uploadSessionDir = path.join(TEMP_CHUNKS_DIR, safeUploadId);
    if (!fs.existsSync(uploadSessionDir)) {
      return res.status(404).json({ error: 'Upload session directory not found or expired. Please re-upload.' });
    }

    const total = Number(totalChunks);
    const missingChunks: number[] = [];

    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(uploadSessionDir, `chunk_${i}`);
      if (!fs.existsSync(chunkPath) || fs.statSync(chunkPath).size === 0) {
        missingChunks.push(i);
      }
    }

    if (missingChunks.length > 0) {
      return res.status(400).json({
        error: `Missing chunk ${missingChunks[0]} of ${total}. Please re-upload.`,
        missingChunks,
        totalChunks: total,
        uploadId: safeUploadId,
      });
    }

    const ext = path.extname(originalName).toLowerCase() || '.mp4';
    const storedName = `vid_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    const finalFilePath = path.join(UPLOADS_DIR, storedName);

    const writeStream = fs.createWriteStream(finalFilePath);
    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(uploadSessionDir, `chunk_${i}`);
      const data = fs.readFileSync(chunkPath);
      writeStream.write(data);
    }
    writeStream.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (e) => reject(e));
    });

    try {
      fs.rmSync(uploadSessionDir, { recursive: true, force: true });
    } catch {}

    let meta: any = null;
    try {
      meta = await FFprobeService.extractMetadata(finalFilePath);
    } catch (metaErr: any) {
      console.warn('FFprobe analysis warning on chunk assembly:', metaErr);
    }

    const { storageBucket, storagePath, storageProvider } = await processAndUploadVideo(finalFilePath, req.user!.id, storedName, meta);
    const fileStat = fs.statSync(finalFilePath);

    const videoRecord: VideoMetadata = {
      id: `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId: req.user!.id,
      originalName: originalName,
      storedName: storedName,
      path: finalFilePath,
      size: fileStat.size,
      duration: meta ? Math.round(meta.duration * 100) / 100 : 0,
      width: meta ? meta.width : 1920,
      height: meta ? meta.height : 1080,
      fps: meta ? meta.fps : 30,
      bitrate: meta ? meta.bitrate : 4000000,
      videoCodec: meta ? meta.videoCodec : 'h264',
      audioCodec: meta ? meta.audioCodec : 'aac',
      hasAudio: meta ? meta.hasAudio : true,
      thumbnailUrl: meta?.thumbnailStoredName ? `/api/videos/thumbnail/${meta.thumbnailStoredName}` : undefined,
      storageProvider,
      storageBucket,
      storagePath,
      sourceType: 'UPLOAD',
      status: 'READY',
      createdAt: new Date().toISOString(),
    };

    db.addVideo(videoRecord);
    return res.status(201).json({
      message: 'Video uploaded and processed successfully',
      video: videoRecord,
    });
  } catch (err: any) {
    console.error('Error completing chunked upload:', err);
    return res.status(500).json({ error: err.message || 'Failed to assemble video chunks' });
  }
});

// POST /api/videos/upload - Standard direct upload
router.post('/upload', (req: AuthenticatedRequest, res: Response) => {
  upload.single('video')(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds maximum upload limit.' });
        }
      }
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided.' });
    }

    const uploadedPath = req.file.path;
    const originalName = req.file.originalname;
    const storedName = req.file.filename;

    let meta: any = null;
    try {
      meta = await FFprobeService.extractMetadata(uploadedPath);
    } catch (metaErr: any) {
      console.warn('FFprobe analysis warning:', metaErr);
    }

    const { storageBucket, storagePath, storageProvider } = await processAndUploadVideo(uploadedPath, req.user!.id, storedName, meta);
    const fileStat = fs.statSync(uploadedPath);

    const videoRecord: VideoMetadata = {
      id: `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId: req.user!.id,
      originalName: originalName,
      storedName: storedName,
      path: uploadedPath,
      size: fileStat.size,
      duration: meta ? Math.round(meta.duration * 100) / 100 : 0,
      width: meta ? meta.width : 1920,
      height: meta ? meta.height : 1080,
      fps: meta ? meta.fps : 30,
      bitrate: meta ? meta.bitrate : 4000000,
      videoCodec: meta ? meta.videoCodec : 'h264',
      audioCodec: meta ? meta.audioCodec : 'aac',
      hasAudio: meta ? meta.hasAudio : true,
      thumbnailUrl: meta?.thumbnailStoredName ? `/api/videos/thumbnail/${meta.thumbnailStoredName}` : undefined,
      storageProvider,
      storageBucket,
      storagePath,
      sourceType: 'UPLOAD',
      status: 'READY',
      createdAt: new Date().toISOString(),
    };

    db.addVideo(videoRecord);

    return res.status(201).json({
      message: 'Video uploaded and analyzed successfully',
      video: videoRecord,
    });
  });
});

// Helper to transform Google Drive / Dropbox / Cloud URLs to direct download links
function normalizeDirectDownloadUrl(inputUrl: string): string {
  try {
    let url = inputUrl.trim();

    // Google Drive conversion
    // e.g. https://drive.google.com/file/d/1A2B3C.../view -> https://drive.google.com/uc?export=download&id=1A2B3C&confirm=t
    const gDriveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
    if (gDriveMatch && gDriveMatch[1]) {
      return `https://drive.google.com/uc?export=download&id=${gDriveMatch[1]}&confirm=t`;
    }

    // Dropbox conversion
    // e.g. https://www.dropbox.com/s/xxxx/video.mp4?dl=0 -> dl=1
    if (url.includes('dropbox.com')) {
      if (url.includes('dl=0')) {
        return url.replace('dl=0', 'dl=1');
      } else if (!url.includes('dl=1')) {
        return url + (url.includes('?') ? '&dl=1' : '?dl=1');
      }
    }

    return url;
  } catch {
    return inputUrl;
  }
}

// POST /api/videos/upload/url - Direct download and import from remote URL / YouTube / test presets
router.post('/upload/url', async (req: AuthenticatedRequest, res: Response) => {
  let destinationPath = '';
  try {
    const { url, name, isLive } = req.body || {};
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ error: 'A valid HTTP or HTTPS video URL is required.' });
    }

    // 1. Check if the URL is a YouTube Video or YouTube Live Stream
    const ytInfo = extractYouTubeVideoId(url);
    if (ytInfo) {
      const userVideos = db.getVideos(req.user!.id);
      const duplicate = userVideos.find(
        (v) => (v.youtubeVideoId && v.youtubeVideoId === ytInfo.videoId) ||
               (v.sourceUrl && (v.sourceUrl === ytInfo.normalizedUrl || v.sourceUrl === url.trim()))
      );

      if (duplicate) {
        return res.status(409).json({
          error: 'This YouTube video / live stream is already in your Video Library.',
          duplicate: true,
          existingVideo: duplicate,
        });
      }

      const isLiveStream = isLive === true || ytInfo.isLiveUrl;
      const meta = await fetchYouTubeMetadata(ytInfo.videoId, isLiveStream, name);

      const videoRecord: VideoMetadata = {
        id: `yt_${ytInfo.videoId}_${crypto.randomBytes(4).toString('hex')}`,
        userId: req.user!.id,
        originalName: name?.trim() || meta.title || 'YouTube Live Stream',
        storedName: ytInfo.videoId,
        path: '',
        size: 0,
        duration: meta.durationSeconds || 0,
        width: 1920,
        height: 1080,
        fps: 30,
        bitrate: 0,
        videoCodec: 'youtube_embed',
        audioCodec: 'aac',
        hasAudio: true,
        thumbnailUrl: meta.thumbnailUrl || `https://img.youtube.com/vi/${ytInfo.videoId}/hqdefault.jpg`,
        storageProvider: 'local',
        sourceType: (meta.isLiveStream || isLiveStream) ? 'YOUTUBE_LIVE' : 'YOUTUBE',
        youtubeVideoId: ytInfo.videoId,
        sourceUrl: meta.sourceUrl || ytInfo.normalizedUrl,
        liveStatus: meta.liveStatus,
        channelTitle: meta.channelTitle,
        status: 'READY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.addVideo(videoRecord);

      return res.status(201).json({
        message: meta.isLiveStream ? 'YouTube Live Stream imported successfully' : 'YouTube Video imported successfully',
        video: videoRecord,
      });
    }

    // 2. Normal direct media download (MP4, MKV, WebM)
    const downloadUrl = normalizeDirectDownloadUrl(url);
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    let originalName = name?.trim() || path.basename(pathname) || 'imported_video.mp4';
    if (!originalName.includes('.')) {
      originalName += '.mp4';
    }

    const ext = path.extname(originalName).toLowerCase() || '.mp4';
    const storedName = `vid_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    destinationPath = path.join(UPLOADS_DIR, storedName);

    const fetchResponse = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
      redirect: 'follow',
    });

    if (!fetchResponse.ok) {
      return res.status(400).json({
        error: `Failed to download remote video from URL (${fetchResponse.status} ${fetchResponse.statusText})`,
      });
    }

    const contentType = fetchResponse.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return res.status(400).json({
        error: 'The provided URL returned a webpage (HTML) instead of a direct video stream. Please ensure the link is a direct video download link or public direct media file (.mp4, .mkv, .webm).',
      });
    }

    if (!fetchResponse.body) {
      return res.status(400).json({ error: 'Remote server returned empty body.' });
    }

    const fileStream = fs.createWriteStream(destinationPath);
    const { Readable } = await import('stream');
    const { pipeline } = await import('stream/promises');
    const nodeStream = (Readable as any).fromWeb ? (Readable as any).fromWeb(fetchResponse.body) : Readable.from(fetchResponse.body as any);
    await pipeline(nodeStream, fileStream);

    // Verify downloaded file size
    if (!fs.existsSync(destinationPath)) {
      return res.status(400).json({ error: 'Downloaded video file could not be saved to disk.' });
    }

    const fileStat = fs.statSync(destinationPath);
    if (fileStat.size < 5000) { // Less than 5KB is likely an HTML error snippet or empty file
      const previewText = fs.readFileSync(destinationPath, 'utf8').substring(0, 300);
      try { fs.unlinkSync(destinationPath); } catch {}

      if (previewText.includes('<!DOCTYPE') || previewText.includes('<html') || previewText.includes('Google Drive')) {
        return res.status(400).json({
          error: 'The provided URL returned an HTML page (such as access denied or file preview) rather than direct video bytes. Please ensure public sharing permissions are enabled or provide a direct video download URL.',
        });
      }

      return res.status(400).json({
        error: 'Downloaded file is too small or invalid to be a video stream.',
      });
    }

    // Inspect video with FFprobe
    let meta: any = null;
    try {
      meta = await FFprobeService.extractMetadata(destinationPath);
    } catch (metaErr: any) {
      try { fs.unlinkSync(destinationPath); } catch {}
      return res.status(400).json({
        error: `Could not decode media from URL: ${metaErr.message || 'Invalid video stream format'}. Please ensure the URL points to a valid MP4/MKV video.`,
      });
    }

    if (!meta || !meta.duration || meta.duration <= 0) {
      try { fs.unlinkSync(destinationPath); } catch {}
      return res.status(400).json({
        error: 'FFprobe could not detect a valid video duration. The media stream may be incomplete or corrupted.',
      });
    }

    const { storageBucket, storagePath, storageProvider } = await processAndUploadVideo(destinationPath, req.user!.id, storedName, meta);
    const finalStat = fs.statSync(destinationPath);

    const videoRecord: VideoMetadata = {
      id: `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId: req.user!.id,
      originalName: originalName,
      storedName: storedName,
      path: destinationPath,
      size: finalStat.size,
      duration: Math.round(meta.duration * 100) / 100,
      width: meta.width || 1920,
      height: meta.height || 1080,
      fps: meta.fps || 30,
      bitrate: meta.bitrate || 4000000,
      videoCodec: meta.videoCodec || 'h264',
      audioCodec: meta.audioCodec || 'aac',
      hasAudio: meta.hasAudio !== undefined ? meta.hasAudio : true,
      thumbnailUrl: meta.thumbnailStoredName ? `/api/videos/thumbnail/${meta.thumbnailStoredName}` : undefined,
      storageProvider,
      storageBucket,
      storagePath,
      sourceType: 'IMPORT',
      sourceUrl: url,
      status: 'READY',
      createdAt: new Date().toISOString(),
    };

    db.addVideo(videoRecord);

    return res.status(201).json({
      message: 'Video imported and analyzed successfully',
      video: videoRecord,
    });
  } catch (err: any) {
    if (destinationPath && fs.existsSync(destinationPath)) {
      try { fs.unlinkSync(destinationPath); } catch {}
    }
    console.error('Error importing video from URL:', err);
    return res.status(500).json({ error: err.message || 'Failed to import video from URL' });
  }
});

// POST /api/videos/youtube/import - Explicit endpoint to import YouTube video / live stream
router.post('/youtube/import', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url, name, isLive } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Valid YouTube URL is required.' });
    }

    const ytInfo = extractYouTubeVideoId(url);
    if (!ytInfo) {
      return res.status(400).json({ error: 'Invalid YouTube URL. Please provide a supported YouTube watch, live, or short link.' });
    }

    const userVideos = db.getVideos(req.user!.id);
    const duplicate = userVideos.find(
      (v) => (v.youtubeVideoId && v.youtubeVideoId === ytInfo.videoId) ||
             (v.sourceUrl && (v.sourceUrl === ytInfo.normalizedUrl || v.sourceUrl === url.trim()))
    );

    if (duplicate) {
      return res.status(409).json({
        error: 'This YouTube video / live stream is already in your Video Library.',
        duplicate: true,
        existingVideo: duplicate,
      });
    }

    const isLiveStream = isLive === true || ytInfo.isLiveUrl;
    const meta = await fetchYouTubeMetadata(ytInfo.videoId, isLiveStream, name);

    const videoRecord: VideoMetadata = {
      id: `yt_${ytInfo.videoId}_${crypto.randomBytes(4).toString('hex')}`,
      userId: req.user!.id,
      originalName: name?.trim() || meta.title || 'YouTube Live Stream',
      storedName: ytInfo.videoId,
      path: '',
      size: 0,
      duration: meta.durationSeconds || 0,
      width: 1920,
      height: 1080,
      fps: 30,
      bitrate: 0,
      videoCodec: 'youtube_embed',
      audioCodec: 'aac',
      hasAudio: true,
      thumbnailUrl: meta.thumbnailUrl || `https://img.youtube.com/vi/${ytInfo.videoId}/hqdefault.jpg`,
      storageProvider: 'local',
      sourceType: (meta.isLiveStream || isLiveStream) ? 'YOUTUBE_LIVE' : 'YOUTUBE',
      youtubeVideoId: ytInfo.videoId,
      sourceUrl: meta.sourceUrl || ytInfo.normalizedUrl,
      liveStatus: meta.liveStatus,
      channelTitle: meta.channelTitle,
      status: 'READY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.addVideo(videoRecord);

    return res.status(201).json({
      message: meta.isLiveStream ? 'YouTube Live Stream imported successfully' : 'YouTube Video imported successfully',
      video: videoRecord,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to import YouTube video' });
  }
});

// POST /api/videos/import/local - Import existing accessible media file from server or storage
router.post('/import/local', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { localPath, name } = req.body || {};
    if (!localPath || typeof localPath !== 'string') {
      return res.status(400).json({ error: 'Valid local file path is required.' });
    }

    const resolved = path.resolve(localPath);
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: `File not found on server at path: ${localPath}` });
    }

    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Specified path is a directory, not a video file.' });
    }

    let meta: any = null;
    try {
      meta = await FFprobeService.extractMetadata(resolved);
    } catch (metaErr: any) {
      return res.status(400).json({ error: `Could not probe or read media file: ${metaErr.message}` });
    }

    const originalName = name?.trim() || path.basename(resolved);
    const videoRecord: VideoMetadata = {
      id: `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId: req.user!.id,
      originalName,
      storedName: path.basename(resolved),
      path: resolved,
      size: stat.size,
      duration: meta ? Math.round(meta.duration * 100) / 100 : 0,
      width: meta ? meta.width : 1920,
      height: meta ? meta.height : 1080,
      fps: meta ? meta.fps : 30,
      bitrate: meta ? meta.bitrate : 4000000,
      videoCodec: meta ? meta.videoCodec : 'h264',
      audioCodec: meta ? meta.audioCodec : 'aac',
      hasAudio: meta ? meta.hasAudio : true,
      thumbnailUrl: meta?.thumbnailStoredName ? `/api/videos/thumbnail/${meta.thumbnailStoredName}` : undefined,
      storageProvider: 'local',
      sourceType: 'IMPORT',
      status: 'READY',
      createdAt: new Date().toISOString(),
    };

    db.addVideo(videoRecord);
    return res.status(201).json({
      message: 'Server media imported successfully into library',
      video: videoRecord,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to import server file' });
  }
});

// PATCH /api/videos/:id - Rename video
router.patch('/:id', (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Valid video name required' });
  }

  const updated = db.renameVideo(req.params.id, name.trim(), req.user!.id);
  if (!updated) {
    return res.status(404).json({ error: 'Video not found' });
  }

  return res.json({ video: updated });
});

// DELETE /api/videos/:id - Delete video
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const videoId = req.params.id;

  const userStreamStatus = streamingService.getStatus(req.user!.id);
  if (
    userStreamStatus.status === 'LIVE' ||
    userStreamStatus.status === 'STARTING' ||
    userStreamStatus.status === 'RECONNECTING'
  ) {
    const isPlaying =
      userStreamStatus.playlist?.some((p) => p.id === videoId) ||
      userStreamStatus.video?.id === videoId ||
      userStreamStatus.currentVideo?.id === videoId ||
      userStreamStatus.config?.videoIds?.includes(videoId) ||
      userStreamStatus.config?.videoId === videoId;

    if (isPlaying) {
      return res.status(400).json({
        success: false,
        deleted: false,
        error: 'This video is currently being streamed in your live broadcast. Please stop your stream first.',
      });
    }
  }

  const video = db.getVideoById(videoId, req.user!.id);
  if (!video) {
    return res.status(404).json({ error: 'Video record was not found.' });
  }

  // Delete local video file if local
  if (video.path && fs.existsSync(video.path)) {
    try {
      fs.unlinkSync(video.path);
    } catch {}
  }

  // Delete from Supabase Storage if applicable
  if (sbStorage && video.storageBucket && video.storagePath) {
    try {
      await sbStorage.storage.from(video.storageBucket).remove([video.storagePath]);
    } catch {}
  }

  // Delete thumbnail
  if (video.thumbnailUrl && !video.thumbnailUrl.startsWith('http')) {
    const thumbName = path.basename(video.thumbnailUrl);
    const thumbPath = path.join(THUMBNAILS_DIR, thumbName);
    if (fs.existsSync(thumbPath)) {
      try {
        fs.unlinkSync(thumbPath);
      } catch {}
    }
  }

  db.deleteVideo(videoId, req.user!.id);

  return res.json({
    success: true,
    deleted: true,
    videoId,
    message: 'Video deleted successfully.',
  });
});

export default router;
