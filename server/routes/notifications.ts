import { Router } from 'express';
import { db } from '../db/database.ts';
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts';
import { createNotification } from './auth.ts';

const router = Router();

router.get('/', requireAuth, (req: AuthedRequest, res) => {
  // Check for bookings expiring within 7 days and ensure reminder notification exists
  const activeSoon = db.prepare(`
    SELECT id, booking_code, check_out_date FROM bookings
    WHERE user_id = ? AND booking_status IN ('confirmed', 'active')
  `).all(req.user!.userId) as Array<{ id: string; booking_code: string; check_out_date: string }>;

  const nowMs = Date.now();
  for (const bk of activeSoon) {
    const diffDays = Math.ceil((new Date(`${bk.check_out_date}T00:00:00Z`).getTime() - nowMs) / 86_400_000);
    if (diffDays >= 0 && diffDays <= 7) {
      const exists = db.prepare(`
        SELECT 1 FROM notifications WHERE user_id = ? AND type = 'expiry' AND link = ?
      `).get(req.user!.userId, `/bookings/${bk.id}`);
      if (!exists) {
        createNotification(
          req.user!.userId,
          'expiry',
          'Storage Expiry Reminder',
          `Booking ${bk.booking_code} ends in ${diffDays} day(s) on ${bk.check_out_date}. Extend now to keep your unit uninterrupted.`,
          `/bookings/${bk.id}`
        );
      }
    }
  }

  const rows = db.prepare(`
    SELECT id, type, title, message, read_at as readAt, link, created_at as createdAt
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user!.userId);

  const unreadCount = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND read_at IS NULL')
    .get(req.user!.userId) as { cnt: number };

  res.json({ notifications: rows, unreadCount: unreadCount.cnt });
});

router.post('/:id/read', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?')
    .run(new Date().toISOString(), req.params.id, req.user!.userId);
  res.json({ ok: true });
});

router.post('/read-all', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
    .run(new Date().toISOString(), req.user!.userId);
  res.json({ ok: true });
});

export default router;
