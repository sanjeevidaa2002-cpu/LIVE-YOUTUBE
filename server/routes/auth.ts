import { Router } from 'express';
import { db, AUTHORIZED_ADMIN_IDENTITY } from '../database/db.ts';
import { generateToken, requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

// POST /api/auth/supabase-login - Authenticate user with Supabase session data
router.post('/supabase-login', async (req, res) => {
  try {
    const { supabaseId, email, name, avatar } = req.body;

    if (!supabaseId || !email) {
      return res.status(400).json({ error: 'Supabase ID and email are required for authentication.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const shouldBeAdmin = db.isEmailAdmin(cleanEmail) || (name && name.toUpperCase().includes('LIGHT GAMING 4M'));

    let user = db.findUserByGoogleId(supabaseId) || db.findUserByEmail(cleanEmail);

    if (user) {
      user.googleId = supabaseId; // Mapping supabaseId to googleId field for persistent database storage compatibility
      user.email = cleanEmail;
      user.name = name || user.name || cleanEmail.split('@')[0];
      user.avatar = avatar || user.avatar || '';
      user.lastLogin = new Date().toISOString();
      user.role = shouldBeAdmin ? 'ADMIN' : 'USER';
    } else {
      user = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        googleId: supabaseId,
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        avatar: avatar || '',
        role: shouldBeAdmin ? 'ADMIN' : 'USER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      db.addUser(user);
    }

    if (user.status === 'DISABLED') {
      return res.status(403).json({
        error: 'Your account has been deactivated by the administrator. Access denied.',
      });
    }

    const token = generateToken(user);

    return res.json({
      message: 'Authentication successful',
      token,
      user,
    });
  } catch (err: any) {
    console.error('[Auth Error] Supabase login sync failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to authenticate with Supabase' });
  }
});

// GET /api/auth/me - Get current user profile
router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = db.findUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'User account not found' });
  }

  if (user.status === 'DISABLED') {
    return res.status(403).json({ error: 'Account has been disabled' });
  }

  return res.json({ user });
});

// POST /api/auth/logout - Logout session
router.post('/logout', requireAuth, (_req: AuthenticatedRequest, res) => {
  return res.json({ message: 'Signed out successfully' });
});

export default router;
