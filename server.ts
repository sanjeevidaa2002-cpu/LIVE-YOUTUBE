import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

import authRoutes from './server/routes/auth.ts';
import videoRoutes from './server/routes/videos.ts';
import playlistRoutes from './server/routes/playlists.ts';
import streamRoutes from './server/routes/stream.ts';
import settingsRoutes from './server/routes/settings.ts';
import systemRoutes from './server/routes/system.ts';
import storageRoutes from './server/routes/storage.ts';
import adminRoutes from './server/routes/admin.ts';
import supabaseConfigRoutes from './server/routes/supabaseConfig.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);

  // Middleware
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Google-Access-Token', 'Range', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  }));
  app.options('*', cors());
  app.use(express.json({ limit: '1000mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1000mb' }));

  // Ensure uploads directory exists
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/videos', videoRoutes);
  app.use('/api/playlists', playlistRoutes);
  app.use('/api/stream', streamRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/storage', storageRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/supabase', supabaseConfigRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'StreamLoop 24x7 Engine',
      timestamp: new Date().toISOString(),
    });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server Error]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 StreamLoop 24x7 Multi-User RTMP Engine is running!`);
    console.log(`📡 URL: http://0.0.0.0:${PORT}`);
    console.log(`🔒 Authentication: Google Sign-In Only`);
    console.log(`🛡️ Architecture: Separated User Panel + Admin Panel`);
    console.log(`====================================================`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
