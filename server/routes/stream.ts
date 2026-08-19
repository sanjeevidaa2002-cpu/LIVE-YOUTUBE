import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { streamingService } from '../services/streamingService.ts';
import { db } from '../database/db.ts';
import { StreamConfig } from '../../src/types/index.ts';

const router = Router();
router.use(requireAuth);

// GET /api/stream/status - Get current user's stream status
router.get('/status', (req: AuthenticatedRequest, res: Response) => {
  const status = streamingService.getStatus(req.user!.id);
  return res.json(status);
});

// POST /api/stream/validate-playlist - Pre-validate a list of video IDs with FFprobe
router.post('/validate-playlist', async (req: AuthenticatedRequest, res: Response) => {
  const { videoIds } = req.body;
  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ error: 'No video IDs provided for validation.' });
  }

  const result = await streamingService.validatePlaylist(req.user!.id, videoIds);
  if (!result.valid) {
    return res.status(400).json({ error: result.message, invalidVideos: result.invalidVideos });
  }

  return res.json({ message: result.message, valid: true });
});

// POST /api/stream/test - Test stream settings and connectivity before going live
router.post('/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rtmpUrl, streamKey, videoId, videoIds } = req.body || {};
    const result = await streamingService.testConnection(req.user!.id, {
      rtmpUrl: rtmpUrl || '',
      streamKey: streamKey || '',
      videoId,
      videoIds,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }

    return res.json({ success: true, message: result.message });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to test stream configuration' });
  }
});

// POST /api/stream/start - Start streaming for the authenticated user
router.post('/start', async (req: AuthenticatedRequest, res: Response) => {
  const {
    videoId,
    videoIds,
    playlistId,
    rtmpUrl,
    streamKey,
    loop,
    quality,
    bitrate,
    fps,
    audio,
    autoReconnect,
    reconnectDelay,
  } = req.body;

  let resolvedVideoIds = Array.isArray(videoIds) && videoIds.length > 0
    ? videoIds
    : (videoId ? [videoId] : []);

  // If playlistId provided, resolve video IDs from user's playlist
  if (resolvedVideoIds.length === 0 && playlistId) {
    const pl = db.getPlaylistById(playlistId, req.user!.id);
    if (pl && pl.videoIds.length > 0) {
      resolvedVideoIds = pl.videoIds;
    }
  }

  if (resolvedVideoIds.length === 0) {
    return res.status(400).json({ error: 'Please select at least one video to start the stream.' });
  }

  if (!rtmpUrl || typeof rtmpUrl !== 'string' || !rtmpUrl.trim()) {
    return res.status(400).json({ error: 'Valid YouTube RTMP URL is required.' });
  }

  if (!streamKey || typeof streamKey !== 'string' || !streamKey.trim()) {
    return res.status(400).json({ error: 'YouTube Stream Key is required.' });
  }

  const streamConfig: StreamConfig = {
    userId: req.user!.id,
    videoId: resolvedVideoIds[0],
    videoIds: resolvedVideoIds,
    playlistId,
    rtmpUrl: rtmpUrl.trim(),
    streamKey: streamKey.trim(),
    loop: loop !== undefined ? Boolean(loop) : true,
    quality: quality || 'source',
    bitrate: bitrate || '4000k',
    fps: fps || 'source',
    audio: audio !== undefined ? Boolean(audio) : true,
    autoReconnect: autoReconnect !== undefined ? Boolean(autoReconnect) : true,
    reconnectDelay: Number(reconnectDelay) || 5,
  };

  const result = await streamingService.startStream(req.user!.id, streamConfig, {
    email: req.user!.email,
    name: req.user!.name,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  return res.json({
    message: result.message,
    status: streamingService.getStatus(req.user!.id),
  });
});

// POST /api/stream/stop - Stop user's stream process
router.post('/stop', async (req: AuthenticatedRequest, res: Response) => {
  const result = await streamingService.stopStream(req.user!.id);
  return res.json({
    message: result.message,
    status: streamingService.getStatus(req.user!.id),
  });
});

// POST /api/stream/restart - Restart user's stream
router.post('/restart', async (req: AuthenticatedRequest, res: Response) => {
  const result = await streamingService.restartStream(req.user!.id);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }
  return res.json({
    message: result.message,
    status: streamingService.getStatus(req.user!.id),
  });
});

// GET /api/stream/logs - Fetch user's recent FFmpeg logs
router.get('/logs', (req: AuthenticatedRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const logs = streamingService.getLogs(req.user!.id, limit);
  return res.json({ logs });
});

// DELETE /api/stream/logs - Clear logs buffer
router.delete('/logs', (req: AuthenticatedRequest, res: Response) => {
  streamingService.clearLogs(req.user!.id);
  return res.json({ message: 'Logs buffer cleared.' });
});

// GET /api/stream/events - Real-time SSE stream for status & logs
router.get('/events', (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const userEngine = streamingService.getUserEngine(req.user!.id);

  // Send initial state
  res.write(`event: status\ndata: ${JSON.stringify(userEngine.getStatus())}\n\n`);
  res.write(`event: logs\ndata: ${JSON.stringify(userEngine.getLogs(50))}\n\n`);

  const statusListener = (status: any) => {
    try {
      res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
    } catch {}
  };

  const logListener = (log: any) => {
    try {
      res.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`);
    } catch {}
  };

  userEngine.on('status', statusListener);
  userEngine.on('log', logListener);

  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {}
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    userEngine.off('status', statusListener);
    userEngine.off('log', logListener);
  });
});

// GET /api/stream/history - Fetch user's stream sessions history
router.get('/history', (req: AuthenticatedRequest, res: Response) => {
  const sessions = db.getSessions(req.user!.id);
  return res.json({ sessions });
});

// DELETE /api/stream/history - Clear user's stream history
router.delete('/history', (req: AuthenticatedRequest, res: Response) => {
  db.clearSessions(req.user!.id);
  return res.json({ message: 'History cleared successfully.' });
});

export default router;
