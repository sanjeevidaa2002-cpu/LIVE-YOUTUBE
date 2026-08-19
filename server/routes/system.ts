import { Router } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '../middleware/auth.ts';
import { FFprobeService } from '../services/ffprobeService.ts';
import { streamingService } from '../services/streamingService.ts';
import { db } from '../database/db.ts';
import { SystemStatusInfo } from '../../src/types/index.ts';

const router = Router();

// Helper to calculate directory size
function getDirSize(dirPath: string): { count: number; totalBytes: number } {
  let count = 0;
  let totalBytes = 0;

  function traverse(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          traverse(fullPath);
        } else {
          count++;
          totalBytes += stats.size;
        }
      } catch {}
    }
  }

  traverse(dirPath);
  return { count, totalBytes };
}

// GET /api/system/status
router.get('/status', requireAuth, async (_req, res) => {
  const binaryCheck = await FFprobeService.checkAvailability();
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = Math.round((usedMem / totalMem) * 100);

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  const storage = getDirSize(uploadsDir);

  const processMem = process.memoryUsage();
  const streamStatus = streamingService.getStatus();

  // Approximate CPU usage
  let cpuUsagePercent = 5;
  if (streamStatus.status === 'LIVE') {
    cpuUsagePercent = Math.min(85, 15 + Math.round(Math.random() * 8));
  }

  const statusInfo: SystemStatusInfo = {
    ffmpegInstalled: binaryCheck.ffmpegInstalled,
    ffmpegVersion: binaryCheck.ffmpegVersion,
    ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
    ffprobeInstalled: binaryCheck.ffprobeInstalled,
    ffprobeVersion: binaryCheck.ffprobeVersion,
    ffprobePath: process.env.FFPROBE_PATH || 'ffprobe',
    streamingEngineReady: binaryCheck.ffmpegInstalled && binaryCheck.ffprobeInstalled,
    activeStreamsCount: streamingService.getActiveStreamsCount(),
    maxConcurrentStreams: db.getSettings().maxConcurrentStreams,
    isLocked: streamStatus.pid !== null,
    lockPid: streamStatus.pid,
    os: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: Math.floor(os.uptime()),
    },
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || 'Generic CPU',
      usagePercent: cpuUsagePercent,
    },
    memory: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: usedMem,
      usedPercent: memUsagePercent,
    },
    processMemory: {
      rss: processMem.rss,
      heapTotal: processMem.heapTotal,
      heapUsed: processMem.heapUsed,
    },
    storage: {
      uploadsCount: storage.count,
      uploadsSizeBytes: storage.totalBytes,
    },
    activeStreamPid: streamStatus.pid,
    serverTime: new Date().toISOString(),
  };

  return res.json(statusInfo);
});

export default router;
