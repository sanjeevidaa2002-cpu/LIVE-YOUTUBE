import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { db } from '../database/db.ts';

const router = Router();
router.use(requireAuth);

// GET /api/playlists - List current user's playlists
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const playlists = db.getPlaylists(req.user!.id);
  return res.json({ playlists });
});

// POST /api/playlists - Create new playlist
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  const { name, videoIds } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Playlist name is required.' });
  }

  const validVideoIds = Array.isArray(videoIds) ? videoIds : [];
  const playlist = db.createPlaylist(req.user!.id, name.trim(), validVideoIds);

  return res.status(201).json({
    message: 'Playlist created successfully',
    playlist,
  });
});

// GET /api/playlists/:id - Get playlist by ID
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const playlist = db.getPlaylistById(req.params.id, req.user!.id);
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found.' });
  }
  return res.json({ playlist });
});

// PUT /api/playlists/:id - Update playlist
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const { name, videoIds } = req.body;
  const updated = db.updatePlaylist(req.params.id, req.user!.id, {
    ...(name !== undefined && { name }),
    ...(videoIds !== undefined && { videoIds }),
  });

  if (!updated) {
    return res.status(404).json({ error: 'Playlist not found.' });
  }

  return res.json({ message: 'Playlist updated successfully', playlist: updated });
});

// DELETE /api/playlists/:id - Delete playlist
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const deleted = db.deletePlaylist(req.params.id, req.user!.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Playlist not found.' });
  }
  return res.json({ message: 'Playlist deleted successfully' });
});

export default router;
