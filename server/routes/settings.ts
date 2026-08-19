import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { db } from '../database/db.ts';
import {
  getStorageStatusHandler,
  saveStorageSettingsHandler,
  testStorageConnectionHandler,
  clearStorageSettingsHandler,
  setGoogleOAuthTokenHandler,
  clearGoogleOAuthTokenHandler,
} from './storage.ts';

const router = Router();

// GET /api/settings - Fetch current settings
router.get('/', requireAuth, (_req, res) => {
  const settings = db.getSettings();
  return res.json({ settings });
});

// PUT /api/settings - Update settings
router.put('/', requireAuth, (req, res) => {
  const {
    defaultRtmpUrl,
    defaultQuality,
    defaultBitrate,
    defaultFps,
    autoReconnect,
    reconnectDelay,
    maxUploadSizeMb,
    allowedExtensions,
    autoRecoverOnBoot,
  } = req.body;

  const updated = db.updateSettings({
    ...(defaultRtmpUrl !== undefined && { defaultRtmpUrl }),
    ...(defaultQuality !== undefined && { defaultQuality }),
    ...(defaultBitrate !== undefined && { defaultBitrate }),
    ...(defaultFps !== undefined && { defaultFps }),
    ...(autoReconnect !== undefined && { autoReconnect: Boolean(autoReconnect) }),
    ...(reconnectDelay !== undefined && { reconnectDelay: Number(reconnectDelay) }),
    ...(maxUploadSizeMb !== undefined && { maxUploadSizeMb: Number(maxUploadSizeMb) }),
    ...(allowedExtensions !== undefined && { allowedExtensions }),
    ...(autoRecoverOnBoot !== undefined && { autoRecoverOnBoot: Boolean(autoRecoverOnBoot) }),
  });

  return res.json({
    message: 'Settings updated successfully.',
    settings: updated,
  });
});

// Storage sub-routes under /api/settings/storage
router.get('/storage', requireAuth, getStorageStatusHandler);
router.post('/storage', requireAuth, saveStorageSettingsHandler);
router.post('/storage/test', requireAuth, testStorageConnectionHandler);
router.delete('/storage', requireAuth, clearStorageSettingsHandler);
router.post('/storage/google-token', requireAuth, setGoogleOAuthTokenHandler);
router.delete('/storage/google-token', requireAuth, clearGoogleOAuthTokenHandler);

export default router;
