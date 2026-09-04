import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { db } from '../database/db.ts';
import { CookiesService } from '../services/cookiesService.ts';
import { YouTubeDownloadService } from '../services/youtubeDownloadService.ts';
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

// YouTube Cookies & Bot Protection endpoints
router.get('/cookies', requireAuth, (_req, res) => {
  const info = CookiesService.getCookiesInfo();
  return res.json({ cookies: info });
});

router.post('/cookies', requireAuth, (req, res) => {
  try {
    const { cookiesContent } = req.body;
    if (!cookiesContent || typeof cookiesContent !== 'string') {
      return res.status(400).json({ error: 'Please provide valid cookies text content.' });
    }

    const result = CookiesService.saveCookies(cookiesContent);
    return res.json({
      success: true,
      message: result.message,
      cookies: CookiesService.getCookiesInfo(),
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to save cookies' });
  }
});

router.delete('/cookies', requireAuth, (_req, res) => {
  const cleared = CookiesService.clearCookies();
  return res.json({
    success: cleared,
    message: 'YouTube cookies removed successfully.',
    cookies: CookiesService.getCookiesInfo(),
  });
});

router.post('/cookies/test', requireAuth, async (_req, res) => {
  try {
    const info = CookiesService.getCookiesInfo();
    if (!info.configured) {
      return res.status(400).json({
        success: false,
        message: 'No cookies are configured. Please paste cookies.txt content first.',
      });
    }

    // Test authenticated extraction using dedicated cookie tester
    const testResult = await YouTubeDownloadService.testCookiesWithYouTube();
    return res.json({
      success: true,
      message: `Cookies verified successfully! yt-dlp authenticated with YouTube for: "${testResult.title}".`,
      video: testResult,
      cookies: info,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: `Cookies test failed: ${err.message || err}`,
    });
  }
});

// Storage sub-routes under /api/settings/storage
router.get('/storage', requireAuth, getStorageStatusHandler);
router.post('/storage', requireAuth, saveStorageSettingsHandler);
router.post('/storage/test', requireAuth, testStorageConnectionHandler);
router.delete('/storage', requireAuth, clearStorageSettingsHandler);
router.post('/storage/google-token', requireAuth, setGoogleOAuthTokenHandler);
router.delete('/storage/google-token', requireAuth, clearGoogleOAuthTokenHandler);

export default router;

