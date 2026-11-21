import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { createRateLimiter, requireAuth, verifyQrSignature, type AuthedRequest } from '../middleware/auth.ts';
import { createNotification } from './auth.ts';

const router = Router();
const qrLimiter = createRateLimiter(60_000, 30);

router.post('/verify', qrLimiter, requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    qrToken: z.string().trim().min(8).max(120),
    action: z.enum(['verify', 'check_in', 'check_out']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid QR code payload.' });
    return;
  }

  const { qrToken, action = 'verify' } = parsed.data;

  // Check inventory item first
  const item = db.prepare(`
    SELECT i.*, f.name as facility_name, u.unit_code, b.booking_code
    FROM inventory_items i
    LEFT JOIN facilities f ON i.facility_id = f.id
    LEFT JOIN units u ON i.unit_id = u.id
    LEFT JOIN bookings b ON i.booking_id = b.id
    WHERE i.qr_token = ? OR i.item_code = ?
  `).get(qrToken, qrToken) as Record<string, unknown> | undefined;

  if (item) {
    if (item.user_id !== req.user!.userId) {
      res.status(403).json({
        authorized: false,
        error: 'Access Denied: This inventory QR pass belongs to a different account.',
      });
      return;
    }

    const sigValid = verifyQrSignature(item.qr_token as string, 'item', item.id as string, item.user_id as string);
    if (!sigValid) {
      res.status(403).json({
        authorized: false,
        error: 'Cryptographic QR signature verification failed.',
      });
      return;
    }

    let nextStatus = item.movement_status as string;
    const now = new Date().toISOString();
    if (action === 'check_in' || action === 'check_out') {
      nextStatus = action === 'check_in' ? 'in_storage' : 'checked_out';
      db.transaction(() => {
        db.prepare('UPDATE inventory_items SET movement_status = ?, updated_at = ? WHERE id = ?')
          .run(nextStatus, now, item.id);
        db.prepare(`
          INSERT INTO inventory_logs (id, item_id, user_id, action, location_note, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          item.id,
          req.user!.userId,
          action === 'check_in' ? 'checked_in' : 'checked_out',
          `${item.facility_name || 'STOVRA Hub'} · QR Terminal`,
          now
        );
      })();

      createNotification(
        req.user!.userId,
        'inventory',
        action === 'check_in' ? 'Item Checked In via QR' : 'Item Checked Out via QR',
        `${item.name} (${item.item_code}) marked as ${nextStatus.replace('_', ' ')}.`,
        '/inventory'
      );
    } else {
      db.prepare(`
        INSERT INTO inventory_logs (id, item_id, user_id, action, location_note, timestamp)
        VALUES (?, ?, ?, 'verified', 'QR Scanner Verification', ?)
      `).run(crypto.randomUUID(), item.id, req.user!.userId, now);
    }

    const logs = db.prepare(`
      SELECT id, action, location_note as locationNote, timestamp
      FROM inventory_logs WHERE item_id = ? ORDER BY timestamp DESC LIMIT 10
    `).all(item.id);

    res.json({
      authorized: true,
      entityType: 'item',
      entity: {
        id: item.id,
        itemCode: item.item_code,
        name: item.name,
        category: item.category,
        quantity: Number(item.quantity),
        estimatedValue: Number(item.estimated_value),
        facilityName: item.facility_name || 'Unassigned',
        unitCode: item.unit_code || '-',
        bookingCode: item.booking_code || '-',
        movementStatus: nextStatus,
        qrToken: item.qr_token,
      },
      logs,
    });
    return;
  }

  // Check booking QR pass
  const booking = db.prepare(`
    SELECT b.*, f.name as facility_name, f.city as facility_city, u.unit_code, u.size_label
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    JOIN units u ON b.unit_id = u.id
    WHERE b.qr_token = ? OR b.booking_code = ?
  `).get(qrToken, qrToken) as Record<string, unknown> | undefined;

  if (!booking) {
    res.status(404).json({
      authorized: false,
      error: 'QR code not recognized in STOVRA registry.',
    });
    return;
  }

  if (booking.user_id !== req.user!.userId) {
    res.status(403).json({
      authorized: false,
      error: 'Access Denied: You are not authorized to access this storage unit pass.',
    });
    return;
  }

  const sigValid = verifyQrSignature(booking.qr_token as string, 'booking', booking.id as string, booking.user_id as string);
  if (!sigValid) {
    res.status(403).json({
      authorized: false,
      error: 'Booking QR signature verification failed.',
    });
    return;
  }

  if (booking.booking_status === 'cancelled') {
    res.status(403).json({
      authorized: false,
      error: 'This booking has been cancelled and its gate pass is revoked.',
    });
    return;
  }

  const now = new Date().toISOString();
  let updatedStatus = booking.booking_status as string;
  if (action === 'check_in' && (updatedStatus === 'confirmed' || updatedStatus === 'pending')) {
    updatedStatus = 'active';
    db.prepare('UPDATE bookings SET booking_status = ?, updated_at = ? WHERE id = ?')
      .run('active', now, booking.id);
    db.prepare("UPDATE units SET status = 'occupied' WHERE id = ?").run(booking.unit_id);
  }

  res.json({
    authorized: true,
    entityType: 'booking',
    entity: {
      id: booking.id,
      bookingCode: booking.booking_code,
      facilityName: booking.facility_name,
      facilityCity: booking.facility_city,
      unitCode: booking.unit_code,
      sizeLabel: booking.size_label,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      bookingStatus: updatedStatus,
      paymentStatus: booking.payment_status,
      qrToken: booking.qr_token,
    },
    logs: [],
  });
});

export default router;
