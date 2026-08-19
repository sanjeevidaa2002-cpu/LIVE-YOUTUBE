import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../database/db.ts';
import { User } from '../../src/types/index.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'streamloop-super-secure-jwt-secret-key-change-in-prod';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      googleId: user.googleId,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '14d' }
  );
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in with Google.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = db.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User account not found or removed.' });
    }

    if (user.status === 'DISABLED') {
      return res.status(403).json({
        error: 'Your account has been deactivated by the administrator. Please contact support.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in to the Admin Portal.' });
  }

  // Strictly enforce that the user has the ADMIN role AND matches the authorized Light Gaming 4M identity
  const isAuthorized = req.user.role === 'ADMIN' && db.isUserAdmin(req.user);

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'Access denied: You are not authorized to access the Admin Panel. Only Light Gaming 4M is authorized.',
    });
  }

  next();
}
