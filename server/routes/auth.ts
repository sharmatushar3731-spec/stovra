import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import {
  clearSessionCookie,
  createRateLimiter,
  requireAuth,
  saveBase64Image,
  setSessionCookie,
  signAccessToken,
  verifyAccessToken,
  type AuthedRequest,
} from '../middleware/auth.ts';

const router = Router();
const authLimiter = createRateLimiter(60_000, 20);

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  referralCode: z.string().trim().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const otpVerifySchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit OTP code'),
});

const forgotSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
});

const resetSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  token: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit reset code'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

export function serializeUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    mobile: row.mobile,
    mobileVerified: Boolean(row.mobile_verified),
    address: row.address || '',
    pincode: row.pincode || '',
    savedAddresses: safeJsonParse(row.saved_addresses_json as string, []),
    emergencyContact: safeJsonParse(row.emergency_contact_json as string, { name: '', relation: '', phone: '' }),
    notificationPrefs: safeJsonParse(row.notification_prefs_json as string, {
      booking: true,
      payment: true,
      expiry: true,
      inventory: true,
      promotional: false,
    }),
    avatarUrl: row.avatar_url || '',
    referralCode: row.referral_code,
    walletBalance: Number(row.wallet_balance || 0),
    role: row.role || 'customer',
    deletionRequestedAt: row.deletion_requested_at || null,
    createdAt: row.created_at,
  };
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function createNotification(userId: string, type: string, title: string, message: string, link = '') {
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, link, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), userId, type, title, message, link, new Date().toISOString());
}

function generateSixDigitOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

router.get('/providers', (_req, res) => {
  res.json({
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    smsGatewayConfigured: Boolean(process.env.SMS_PROVIDER_API_KEY),
  });
});

router.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration fields' });
    return;
  }
  const { fullName, email, mobile, password, referralCode } = parsed.data;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const otp = generateSixDigitOtp();
  const otpHash = await bcrypt.hash(otp, 8);
  const otpExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const myReferralCode = `STV${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const bonusBalance = referralCode && referralCode.startsWith('STV') ? 750 : 500;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (
      id, full_name, email, password_hash, mobile, mobile_verified,
      otp_code_hash, otp_expires_at, referral_code, wallet_balance, created_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `).run(id, fullName, email, passwordHash, mobile, otpHash, otpExpiresAt, myReferralCode, bonusBalance, now);

  createNotification(
    id,
    'booking',
    'Welcome to STOVRA',
    `Your account is ready with ₹${bonusBalance} storage credit. Verify your mobile number to activate biometric & QR gate access.`,
    '/verify-otp'
  );

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
  const accessToken = signAccessToken({ userId: id, email, role: 'customer' });
  setSessionCookie(req, res, accessToken);

  const smsConfigured = Boolean(process.env.SMS_PROVIDER_API_KEY);
  res.status(201).json({
    accessToken,
    user: serializeUser(userRow),
    otpDelivery: smsConfigured
      ? { channel: 'sms', maskedMobile: `******${mobile.slice(-4)}` }
      : { channel: 'sandbox_preview', maskedMobile: `******${mobile.slice(-4)}`, previewOtp: otp },
  });
});

router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid credentials' });
    return;
  }
  const { email, password } = parsed.data;

  const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
  if (!userRow) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const valid = await bcrypt.compare(password, userRow.password_hash as string);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const accessToken = signAccessToken({
    userId: userRow.id as string,
    email: userRow.email as string,
    role: (userRow.role as string) || 'customer',
  });
  setSessionCookie(req, res, accessToken);

  res.json({
    accessToken,
    user: serializeUser(userRow),
  });
});

router.post('/google', authLimiter, async (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    res.status(501).json({
      error: 'Google Sign-In is not configured on this server. Set GOOGLE_CLIENT_ID in environment secrets or sign in with email & password.',
    });
    return;
  }
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
  if (!idToken) {
    res.status(400).json({ error: 'Google ID token is required.' });
    return;
  }

  try {
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!verifyRes.ok) {
      res.status(401).json({ error: 'Invalid Google credential.' });
      return;
    }
    const payload = (await verifyRes.json()) as { aud?: string; email?: string; name?: string; email_verified?: string };
    if (payload.aud !== googleClientId || !payload.email || payload.email_verified !== 'true') {
      res.status(401).json({ error: 'Google token audience or email verification mismatch.' });
      return;
    }

    const email = payload.email.toLowerCase();
    let userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
    if (!userRow) {
      const id = crypto.randomUUID();
      const randomPassHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      const myReferralCode = `STV${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      db.prepare(`
        INSERT INTO users (id, full_name, email, password_hash, mobile, mobile_verified, referral_code, wallet_balance, created_at)
        VALUES (?, ?, ?, ?, '', 0, ?, 500, ?)
      `).run(id, payload.name || email.split('@')[0], email, randomPassHash, myReferralCode, new Date().toISOString());
      userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
    }

    const accessToken = signAccessToken({
      userId: userRow.id as string,
      email: userRow.email as string,
      role: (userRow.role as string) || 'customer',
    });
    setSessionCookie(req, res, accessToken);
    res.json({ accessToken, user: serializeUser(userRow) });
  } catch {
    res.status(502).json({ error: 'Could not verify Google credential at this time.' });
  }
});

router.get('/session', (req, res) => {
  const cookieToken = req.cookies?.stovra_session;
  const authHeader = req.headers.authorization;
  const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : cookieToken;

  if (!rawToken || typeof rawToken !== 'string') {
    res.json({ authenticated: false, user: null, accessToken: null });
    return;
  }

  const payload = verifyAccessToken(rawToken);
  if (!payload) {
    res.json({ authenticated: false, user: null, accessToken: null });
    return;
  }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as Record<string, unknown> | undefined;
  if (!userRow) {
    res.json({ authenticated: false, user: null, accessToken: null });
    return;
  }

  res.json({
    authenticated: true,
    accessToken: rawToken,
    user: serializeUser(userRow),
  });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

router.post('/otp/send', authLimiter, requireAuth, async (req: AuthedRequest, res) => {
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown> | undefined;
  if (!userRow) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const newMobile = typeof req.body?.mobile === 'string' && /^[6-9]\d{9}$/.test(req.body.mobile.trim())
    ? req.body.mobile.trim()
    : (userRow.mobile as string);

  if (!newMobile || !/^[6-9]\d{9}$/.test(newMobile)) {
    res.status(400).json({ error: 'Please provide a valid 10-digit Indian mobile number.' });
    return;
  }

  const otp = generateSixDigitOtp();
  const otpHash = await bcrypt.hash(otp, 8);
  const otpExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  db.prepare('UPDATE users SET mobile = ?, otp_code_hash = ?, otp_expires_at = ? WHERE id = ?')
    .run(newMobile, otpHash, otpExpiresAt, req.user!.userId);

  const smsConfigured = Boolean(process.env.SMS_PROVIDER_API_KEY);
  res.json({
    ok: true,
    delivery: smsConfigured
      ? { channel: 'sms', maskedMobile: `******${newMobile.slice(-4)}` }
      : { channel: 'sandbox_preview', maskedMobile: `******${newMobile.slice(-4)}`, previewOtp: otp },
  });
});

router.post('/otp/verify', authLimiter, requireAuth, async (req: AuthedRequest, res) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid OTP format' });
    return;
  }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown> | undefined;
  if (!userRow || !userRow.otp_code_hash || !userRow.otp_expires_at) {
    res.status(400).json({ error: 'No active OTP found. Request a new code.' });
    return;
  }

  if (new Date(userRow.otp_expires_at as string).getTime() < Date.now()) {
    res.status(400).json({ error: 'OTP has expired. Please request a fresh code.' });
    return;
  }

  const matches = await bcrypt.compare(parsed.data.otp, userRow.otp_code_hash as string);
  if (!matches) {
    res.status(400).json({ error: 'Incorrect OTP code. Please try again.' });
    return;
  }

  db.prepare('UPDATE users SET mobile_verified = 1, otp_code_hash = NULL, otp_expires_at = NULL WHERE id = ?')
    .run(req.user!.userId);

  createNotification(
    req.user!.userId,
    'inventory',
    'Mobile Number Verified',
    'Your mobile number is verified. Biometric & QR gate access is now enabled for your bookings.',
    '/profile'
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown>;
  res.json({ ok: true, user: serializeUser(updated) });
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid email' });
    return;
  }

  const userRow = db.prepare('SELECT id, email FROM users WHERE email = ?').get(parsed.data.email) as { id: string; email: string } | undefined;
  if (!userRow) {
    res.json({ ok: true, message: 'If an account matches this email, a 6-digit reset code has been issued.' });
    return;
  }

  const resetCode = generateSixDigitOtp();
  const resetHash = await bcrypt.hash(resetCode, 8);
  const resetExpiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

  db.prepare('UPDATE users SET reset_token_hash = ?, reset_expires_at = ? WHERE id = ?')
    .run(resetHash, resetExpiresAt, userRow.id);

  res.json({
    ok: true,
    message: 'Reset code generated and valid for 15 minutes.',
    delivery: process.env.SMS_PROVIDER_API_KEY
      ? { channel: 'email_sms' }
      : { channel: 'sandbox_preview', previewResetCode: resetCode },
  });
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reset parameters' });
    return;
  }

  const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email) as Record<string, unknown> | undefined;
  if (!userRow || !userRow.reset_token_hash || !userRow.reset_expires_at) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  if (new Date(userRow.reset_expires_at as string).getTime() < Date.now()) {
    res.status(400).json({ error: 'Reset code has expired. Request a new one.' });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.token, userRow.reset_token_hash as string);
  if (!valid) {
    res.status(400).json({ error: 'Incorrect reset code.' });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_expires_at = NULL WHERE id = ?')
    .run(passwordHash, userRow.id);

  res.json({ ok: true, message: 'Password updated successfully. You can now log in.' });
});

router.get('/me', requireAuth, (req: AuthedRequest, res) => {
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown> | undefined;
  if (!userRow) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }
  res.json({ user: serializeUser(userRow) });
});

router.put('/profile', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    fullName: z.string().trim().min(2).max(100),
    mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian mobile required'),
    address: z.string().trim().max(300).optional(),
    pincode: z.string().trim().regex(/^(\d{6})?$/, 'PIN code must be 6 digits').optional(),
    savedAddresses: z.array(z.object({
      id: z.string(),
      label: z.string().min(1).max(40),
      line: z.string().min(3).max(250),
      pincode: z.string().regex(/^\d{6}$/),
    })).max(6).optional(),
    emergencyContact: z.object({
      name: z.string().max(80),
      relation: z.string().max(40),
      phone: z.string().max(15),
    }).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile data' });
    return;
  }

  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown>;
  const mobileChanged = current.mobile !== parsed.data.mobile;

  db.prepare(`
    UPDATE users SET
      full_name = ?,
      mobile = ?,
      mobile_verified = ?,
      address = ?,
      pincode = ?,
      saved_addresses_json = ?,
      emergency_contact_json = ?
    WHERE id = ?
  `).run(
    parsed.data.fullName,
    parsed.data.mobile,
    mobileChanged ? 0 : current.mobile_verified,
    parsed.data.address ?? current.address,
    parsed.data.pincode ?? current.pincode,
    parsed.data.savedAddresses ? JSON.stringify(parsed.data.savedAddresses) : current.saved_addresses_json,
    parsed.data.emergencyContact ? JSON.stringify(parsed.data.emergencyContact) : current.emergency_contact_json,
    req.user!.userId
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown>;
  res.json({ user: serializeUser(updated) });
});

router.post('/avatar', requireAuth, (req: AuthedRequest, res) => {
  const imageData = req.body?.imageData;
  if (typeof imageData !== 'string') {
    res.status(400).json({ error: 'Image payload required.' });
    return;
  }
  try {
    const url = saveBase64Image(imageData, 'avatar');
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, req.user!.userId);
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown>;
    res.json({ avatarUrl: url, user: serializeUser(updated) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

router.put('/password', requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid password input' });
    return;
  }

  const userRow = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.userId) as { password_hash: string };
  const valid = await bcrypt.compare(parsed.data.currentPassword, userRow.password_hash);
  if (!valid) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  const nextHash = await bcrypt.hash(parsed.data.newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(nextHash, req.user!.userId);
  res.json({ ok: true, message: 'Password updated successfully.' });
});

router.put('/notifications-prefs', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    booking: z.boolean(),
    payment: z.boolean(),
    expiry: z.boolean(),
    inventory: z.boolean(),
    promotional: z.boolean(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid notification preferences.' });
    return;
  }
  db.prepare('UPDATE users SET notification_prefs_json = ? WHERE id = ?')
    .run(JSON.stringify(parsed.data), req.user!.userId);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown>;
  res.json({ user: serializeUser(updated) });
});

router.post('/delete-request', requireAuth, (req: AuthedRequest, res) => {
  const activeBookings = db.prepare(`
    SELECT COUNT(*) as cnt FROM bookings
    WHERE user_id = ? AND booking_status IN ('confirmed', 'active')
  `).get(req.user!.userId) as { cnt: number };

  if (activeBookings.cnt > 0) {
    res.status(400).json({
      error: 'You have active or confirmed bookings. Please complete or cancel them before requesting account deletion.',
    });
    return;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE users SET deletion_requested_at = ? WHERE id = ?').run(now, req.user!.userId);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown>;
  res.json({ ok: true, user: serializeUser(updated) });
});

export default router;
