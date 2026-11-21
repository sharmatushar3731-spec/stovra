import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UPLOADS_DIR } from '../db/database.ts';

// Runtime-safe JWT secret: uses process.env.JWT_SECRET when provided, otherwise an ephemeral process secret.
const JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16
  ? process.env.JWT_SECRET
  : crypto.randomBytes(32).toString('hex');

const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET && process.env.QR_HMAC_SECRET.length >= 16
  ? process.env.QR_HMAC_SECRET
  : crypto.createHash('sha256').update(JWT_SECRET + ':stovra-qr').digest('hex');

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthedRequest extends Request {
  user?: AuthPayload;
}

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function signQrPayload(entityType: 'booking' | 'item', entityId: string, ownerId: string): string {
  const nonce = crypto.randomBytes(8).toString('hex');
  const raw = `${entityType}:${entityId}:${ownerId}:${nonce}`;
  const sig = crypto.createHmac('sha256', QR_HMAC_SECRET).update(raw).digest('hex').slice(0, 24);
  return `STV-${entityType === 'booking' ? 'BK' : 'IT'}-${entityId.slice(0, 8).toUpperCase()}-${nonce}-${sig}`;
}

export function verifyQrSignature(qrToken: string, entityType: 'booking' | 'item', entityId: string, ownerId: string): boolean {
  const parts = qrToken.split('-');
  if (parts.length !== 5) return false;
  const nonce = parts[3];
  const sig = parts[4];
  const raw = `${entityType}:${entityId}:${ownerId}:${nonce}`;
  const expected = crypto.createHmac('sha256', QR_HMAC_SECRET).update(raw).digest('hex').slice(0, 24);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `stovra_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${7 * 24 * 60 * 60}`,
  ];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = ['stovra_session=', 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function extractToken(req: Request): { token: string | null; viaCookie: boolean } {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return { token: authHeader.slice(7).trim(), viaCookie: false };
  }
  const cookieToken = req.cookies?.stovra_session;
  if (cookieToken && typeof cookieToken === 'string') {
    return { token: cookieToken, viaCookie: true };
  }
  return { token: null, viaCookie: false };
}

function verifyCsrfIfCookie(req: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  if (req.headers['x-requested-with'] === 'STOVRA-App') return true;
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const { token, viaCookie } = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  if (viaCookie && !verifyCsrfIfCookie(req)) {
    res.status(403).json({ error: 'Request origin verification failed.' });
    return;
  }
  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  req.user = payload;
  next();
}

export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const { token } = extractToken(req);
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) req.user = payload;
  }
  next();
}

export function createRateLimiter(windowMs: number, maxRequests: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const valid = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
    if (valid.length >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }
    valid.push(now);
    hits.set(key, valid);
    next();
  };
}

export function saveBase64Image(dataUrl: string, prefix = 'img'): string {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid image format. Only JPEG, PNG, and WebP images are supported.');
  }
  const mime = match[1];
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 3 * 1024 * 1024) {
    throw new Error('Image exceeds maximum allowed size of 3 MB.');
  }
  const safeName = `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const resolvedPath = path.resolve(UPLOADS_DIR, safeName);
  if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error('Invalid upload path.');
  }
  fs.writeFileSync(resolvedPath, buffer);
  return `/uploads/${safeName}`;
}
