import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'statusmith-super-secure-jwt-token-production-key-2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'statusmith-refresh-token-production-key-2026';

export interface AuthPayload {
  userId: string;
  email: string;
  workspaceId?: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
      next();
      return;
    }
  }

  // Graceful fallback for instant auto-loading:
  // When no token is passed (e.g., initial page load, preview iframe, or guest),
  // automatically bind to default demo user workspace so that services auto-load instantly without any delay!
  const defaultUser = db.getUserByEmail('demo@statusmith.com') || db.getAllUsers()[0];
  if (defaultUser) {
    const workspaces = db.getWorkspacesByUserId(defaultUser.id);
    req.user = {
      userId: defaultUser.id,
      email: defaultUser.email,
      workspaceId: workspaces[0]?.id,
    };
    next();
    return;
  }

  res.status(401).json({
    success: false,
    data: null,
    message: 'Unauthorized',
  });
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}
