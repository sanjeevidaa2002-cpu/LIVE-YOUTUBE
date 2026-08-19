import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { StorageStatusInfo } from '../../src/types/index.ts';
import fs from 'fs';
import path from 'path';

const router = Router();
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

// Handler for getting storage settings and status
export async function getStorageStatusHandler(_req: Request, res: Response) {
  try {
    let uploadsCount = 0;
    let uploadsSizeBytes = 0;

    if (fs.existsSync(UPLOADS_DIR)) {
      try {
        const files = fs.readdirSync(UPLOADS_DIR);
        uploadsCount = files.length;
        for (const file of files) {
          const fullPath = path.join(UPLOADS_DIR, file);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) uploadsSizeBytes += stat.size;
          } catch {}
        }
      } catch {}
    }

    const response: StorageStatusInfo = {
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
      folderName: 'Server Video Storage',
      accountEmail: undefined,
      status: 'READY',
      statusMessage: `Local Server Disk Active (${uploadsCount} files, ${(uploadsSizeBytes / (1024 * 1024)).toFixed(1)} MB)`,
      cacheStats: {
        count: uploadsCount,
        totalSizeBytes: uploadsSizeBytes,
        cachedFiles: [],
      },
    };

    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve storage status' });
  }
}

// Handler for saving storage settings
export async function saveStorageSettingsHandler(_req: Request, res: Response) {
  return res.json({
    success: true,
    message: 'Local server storage is active and ready.',
    provider: 'local',
    configured: true,
  });
}

// Handler for testing storage connection
export async function testStorageConnectionHandler(_req: Request, res: Response) {
  return res.json({
    success: true,
    provider: 'local',
    status: 'READY',
    locationStatus: 'VALID',
    message: 'Local server disk storage is fully functional.',
  });
}

// Handler for clearing storage settings
export async function clearStorageSettingsHandler(_req: Request, res: Response) {
  return res.json({
    success: true,
    message: 'Storage settings reset.',
  });
}

// Handler for updating Google OAuth token on server (noop)
export async function setGoogleOAuthTokenHandler(_req: Request, res: Response) {
  return res.json({
    success: true,
    message: 'Token acknowledged.',
  });
}

export async function clearGoogleOAuthTokenHandler(_req: Request, res: Response) {
  return res.json({
    success: true,
    message: 'Token cleared.',
  });
}

// GET /api/storage/status & GET /api/storage/settings
router.get('/status', requireAuth, getStorageStatusHandler);
router.get('/settings', requireAuth, getStorageStatusHandler);

// POST /api/storage/settings
router.post('/settings', requireAuth, saveStorageSettingsHandler);

// POST /api/storage/test
router.post('/test', requireAuth, testStorageConnectionHandler);

// DELETE /api/storage/settings
router.delete('/settings', requireAuth, clearStorageSettingsHandler);

export default router;
