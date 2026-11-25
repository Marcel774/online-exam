import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { User } from '../models/User.ts';
import type { IUser, UserRole } from '../models/User.ts';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

interface TokenPayload {
  id: string;
  role: UserRole;
}

export const SESSION_COOKIE_NAME = 'exampro_session';

export function signJwtToken(userId: string, role: UserRole): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign({ id: userId, role }, env.jwtSecret, options);
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    partitioned: isHttps,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    partitioned: isHttps,
    path: '/',
  });
}

function extractCookieToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.trim().split('=');
    if (rawKey === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export async function protect(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | null = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      token = extractCookieToken(req);
    }

    if (!token) {
      res.status(401).json({ message: 'Authentication required. Please sign in.' });
      return;
    }

    const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401).json({ message: 'Account no longer exists.' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ message: 'Your account has been deactivated. Contact an administrator.' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Session invalid or expired. Please sign in again.' });
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
  if (!mutating) {
    next();
    return;
  }
  const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
  const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
  if (hasBearer || hasRequestedWith) {
    next();
    return;
  }
  const cookieToken = extractCookieToken(req);
  if (!cookieToken) {
    next();
    return;
  }
  res.status(403).json({ message: 'Missing request verification header.' });
}
