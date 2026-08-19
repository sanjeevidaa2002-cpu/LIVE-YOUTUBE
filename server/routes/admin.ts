import { Router, Response } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.ts';
import { db } from '../database/db.ts';
import { streamingService } from '../services/streamingService.ts';
import { FFprobeService } from '../services/ffprobeService.ts';
import { SystemStatusInfo, AdminOverviewStats, StorageStatusInfo } from '../../src/types/index.ts';

const router = Router();

// Apply auth and admin check to all /api/admin routes
router.use(requireAuth);
router.use(requireAdmin);

// Helper to gather system diagnostics
async function getSystemDiagnostics(): Promise<SystemStatusInfo> {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const procMem = process.memoryUsage();

  const ffprobeVer = await FFprobeService.getVersion();
  const activeStreamsCount = streamingService.getActiveStreamsCount();
  const settings = db.getSettings();

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  let uploadsCount = 0;
  let uploadsSizeBytes = 0;

  if (fs.existsSync(uploadsDir)) {
    try {
      const files = fs.readdirSync(uploadsDir);
      uploadsCount = files.length;
      for (const file of files) {
        const fullPath = path.join(uploadsDir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) uploadsSizeBytes += stat.size;
        } catch {}
      }
    } catch {}
  }

  return {
    ffmpegInstalled: true,
    ffmpegVersion: 'N-113426-g603f9e8a6c (FFmpeg 6.1+)',
    ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
    ffprobeInstalled: ffprobeVer !== null,
    ffprobeVersion: ffprobeVer,
    ffprobePath: 'ffprobe',
    streamingEngineReady: true,
    activeStreamsCount,
    maxConcurrentStreams: settings.maxConcurrentStreams,
    isLocked: false,
    lockPid: null,
    os: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: os.uptime(),
    },
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || 'Cloud VPS CPU',
      usagePercent: Math.min(100, Math.round((os.loadavg()[0] / (cpus.length || 1)) * 100)),
    },
    memory: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: usedMem,
      usedPercent: Math.round((usedMem / totalMem) * 100),
    },
    processMemory: {
      rss: procMem.rss,
      heapTotal: procMem.heapTotal,
      heapUsed: procMem.heapUsed,
    },
    storage: {
      uploadsCount,
      uploadsSizeBytes,
    },
    activeStreamPid: null,
    serverTime: new Date().toISOString(),
  };
}

// GET /api/admin/overview - Aggregated dashboard metrics for Admin Panel
router.get('/overview', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const users = db.getUsers();
    const activeUsers = users.filter(u => u.status === 'ACTIVE').length;
    const totalVideos = db.getVideos().length;
    const totalPlaylists = users.reduce((acc, u) => acc + db.getPlaylists(u.id).length, 0);
    const activeStreams = streamingService.getActiveStreamsCount();
    const system = await getSystemDiagnostics();

    const storage: StorageStatusInfo = {
      provider: 'local',
      isConfigured: true,
      configured: true,
      apiKeyConfigured: false,
      locationConfigured: true,
      apiKeyMasked: '',
      location: '/uploads',
      locationType: 'folder',
      locationStatus: 'VALID',
      folderId: 'uploads',
      status: 'READY',
      statusMessage: 'Local Server Storage Active',
      cacheStats: {
        count: 0,
        totalSizeBytes: 0,
        cachedFiles: [],
      },
    };

    const stats: AdminOverviewStats = {
      totalUsers: users.length,
      activeUsers,
      totalVideos,
      activeStreams,
      totalPlaylists,
      system,
      storage,
    };

    return res.json(stats);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch admin overview' });
  }
});

// GET /api/admin/users - List all users
router.get('/users', (_req: AuthenticatedRequest, res: Response) => {
  const users = db.getUsers();
  return res.json({ users });
});

// PATCH /api/admin/users/:id/role - Update user role
router.patch('/users/:id/role', (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.body;
  if (role !== 'ADMIN' && role !== 'USER') {
    return res.status(400).json({ error: 'Role must be either ADMIN or USER.' });
  }

  // Prevent admin from demoting themselves if they are the only admin
  if (req.user!.id === req.params.id && role === 'USER') {
    const adminCount = db.getUsers().filter(u => u.role === 'ADMIN').length;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot demote the last remaining administrator.' });
    }
  }

  const updated = db.updateUserRole(req.params.id, role);
  if (!updated) {
    return res.status(404).json({ error: 'User not found.' });
  }

  return res.json({ message: 'User role updated successfully.', user: updated });
});

// PATCH /api/admin/users/:id/status - Update user status
router.patch('/users/:id/status', (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  if (status !== 'ACTIVE' && status !== 'DISABLED') {
    return res.status(400).json({ error: 'Status must be either ACTIVE or DISABLED.' });
  }

  if (req.user!.id === req.params.id && status === 'DISABLED') {
    return res.status(400).json({ error: 'You cannot deactivate your own admin account.' });
  }

  const updated = db.updateUserStatus(req.params.id, status);
  if (!updated) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // If user disabled, stop their active stream immediately
  if (status === 'DISABLED') {
    streamingService.stopUserStreamByAdmin(req.params.id);
  }

  return res.json({ message: 'User status updated successfully.', user: updated });
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.id === req.params.id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account.' });
  }

  await streamingService.stopUserStreamByAdmin(req.params.id);
  const deleted = db.deleteUser(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'User not found.' });
  }

  return res.json({ message: 'User account and associated data removed successfully.' });
});

// GET /api/admin/streams - Monitor all active streams
router.get('/streams', (_req: AuthenticatedRequest, res: Response) => {
  const streams = streamingService.getAllActiveStreams();
  return res.json({ streams, count: streams.length });
});

// POST /api/admin/streams/:userId/stop - Force stop a user's stream
router.post('/streams/:userId/stop', async (req: AuthenticatedRequest, res: Response) => {
  const result = await streamingService.stopUserStreamByAdmin(req.params.userId);
  return res.json({ message: result.message, success: result.success });
});

// GET /api/admin/system - Server system diagnostics
router.get('/system', async (_req: AuthenticatedRequest, res: Response) => {
  const info = await getSystemDiagnostics();
  return res.json({ system: info });
});

// GET /api/admin/settings - System settings
router.get('/settings', (_req: AuthenticatedRequest, res: Response) => {
  const settings = db.getSettings();
  return res.json({ settings });
});

// PUT /api/admin/settings - Update system settings
router.put('/settings', (req: AuthenticatedRequest, res: Response) => {
  const {
    maxConcurrentStreams,
    defaultRtmpUrl,
    defaultQuality,
    defaultBitrate,
    defaultFps,
    autoReconnect,
    reconnectDelay,
    maxUploadSizeMb,
    allowedExtensions,
    adminGoogleEmails,
  } = req.body;

  const updated = db.updateSettings({
    ...(maxConcurrentStreams !== undefined && { maxConcurrentStreams: Number(maxConcurrentStreams) }),
    ...(defaultRtmpUrl !== undefined && { defaultRtmpUrl: String(defaultRtmpUrl).trim() }),
    ...(defaultQuality !== undefined && { defaultQuality }),
    ...(defaultBitrate !== undefined && { defaultBitrate }),
    ...(defaultFps !== undefined && { defaultFps }),
    ...(autoReconnect !== undefined && { autoReconnect: Boolean(autoReconnect) }),
    ...(reconnectDelay !== undefined && { reconnectDelay: Number(reconnectDelay) }),
    ...(maxUploadSizeMb !== undefined && { maxUploadSizeMb: Number(maxUploadSizeMb) }),
    ...(allowedExtensions !== undefined && { allowedExtensions }),
    ...(adminGoogleEmails !== undefined && { adminGoogleEmails }),
  });

  return res.json({ message: 'Admin system settings updated successfully.', settings: updated });
});

// GET /api/admin/security - Security info & admin emails
router.get('/security', (_req: AuthenticatedRequest, res: Response) => {
  const settings = db.getSettings();
  return res.json({
    adminGoogleEmails: settings.adminGoogleEmails,
    jwtExpiry: '14 days',
    oauthProvider: 'Google Sign-In / Google OAuth 2.0',
    enforceManualStreamStart: true,
    dataIsolationModel: 'Per-user scoped entity access',
  });
});

// PUT /api/admin/security - Update admin emails
router.put('/security', (req: AuthenticatedRequest, res: Response) => {
  const { adminGoogleEmails } = req.body;
  if (!Array.isArray(adminGoogleEmails)) {
    return res.status(400).json({ error: 'adminGoogleEmails must be an array of email strings.' });
  }

  const cleanList = adminGoogleEmails
    .map((e: any) => String(e).trim().toLowerCase())
    .filter(Boolean);

  const updated = db.updateSettings({ adminGoogleEmails: cleanList });
  return res.json({
    message: 'Admin Google email allowlist updated.',
    adminGoogleEmails: updated.adminGoogleEmails,
  });
});

export default router;
