import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { requireAuth, saveBase64Image, signQrPayload, type AuthedRequest } from '../middleware/auth.ts';
import { createNotification } from './auth.ts';

const router = Router();

function computeCheckoutDate(checkInDate: string, durationType: 'daily' | 'weekly' | 'monthly', durationCount: number): string {
  const start = new Date(`${checkInDate}T00:00:00Z`);
  if (durationType === 'daily') {
    start.setUTCDate(start.getUTCDate() + durationCount);
  } else if (durationType === 'weekly') {
    start.setUTCDate(start.getUTCDate() + durationCount * 7);
  } else {
    start.setUTCMonth(start.getUTCMonth() + durationCount);
  }
  return start.toISOString().slice(0, 10);
}

function calculateBookingPricing(unit: Record<string, unknown>, durationType: 'daily' | 'weekly' | 'monthly', durationCount: number, promoCode?: string) {
  const rate =
    durationType === 'daily'
      ? Number(unit.daily_rate)
      : durationType === 'weekly'
        ? Number(unit.weekly_rate)
        : Number(unit.monthly_rate);

  const subtotal = Math.round(rate * durationCount);
  let discountAmount = 0;
  let appliedPromo = '';
  let promoError = '';

  if (promoCode && promoCode.trim()) {
    const code = promoCode.trim().toUpperCase();
    const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ? AND active = 1').get(code) as Record<string, unknown> | undefined;
    if (!promo) {
      promoError = 'Promo code is invalid or expired.';
    } else if (subtotal < Number(promo.min_amount)) {
      promoError = `Minimum booking subtotal of ₹${promo.min_amount} required for ${code}.`;
    } else {
      discountAmount = Math.min(
        Math.round((subtotal * Number(promo.discount_percent)) / 100),
        Number(promo.max_discount)
      );
      appliedPromo = code;
    }
  }

  const taxable = Math.max(0, subtotal - discountAmount);
  const gstAmount = Math.round(taxable * 0.18);
  const totalAmount = taxable + gstAmount;

  return { rate, subtotal, discountAmount, appliedPromo, promoError, gstAmount, totalAmount };
}

function hasOverlappingBooking(unitId: string, checkIn: string, checkOut: string, excludeBookingId?: string): boolean {
  const query = `
    SELECT id FROM bookings
    WHERE unit_id = ?
      AND booking_status IN ('pending', 'confirmed', 'active')
      AND id != ?
      AND NOT (check_out_date <= ? OR check_in_date >= ?)
    LIMIT 1
  `;
  const conflict = db.prepare(query).get(unitId, excludeBookingId || '', checkIn, checkOut);
  return Boolean(conflict);
}

function hydrateBooking(row: Record<string, unknown>) {
  return {
    id: row.id,
    bookingCode: row.booking_code,
    userId: row.user_id,
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    facilityCity: row.facility_city,
    facilityLocality: row.facility_locality,
    facilityAddress: row.facility_address,
    facilityImage: row.facility_image,
    unitId: row.unit_id,
    unitCode: row.unit_code,
    unitSizeLabel: row.unit_size_label,
    unitAreaSqft: Number(row.unit_area_sqft),
    unitDimensions: row.unit_dimensions,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    durationType: row.duration_type,
    durationCount: Number(row.duration_count),
    inventorySummary: row.inventory_summary || '',
    itemImages: JSON.parse((row.item_images_json as string) || '[]') as string[],
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    promoCode: row.promo_code || '',
    gstAmount: Number(row.gst_amount),
    totalAmount: Number(row.total_amount),
    paidAmount: Number(row.paid_amount),
    paymentStatus: row.payment_status,
    bookingStatus: row.booking_status,
    qrToken: row.qr_token,
    cancellationReason: row.cancellation_reason || '',
    cancelledAt: row.cancelled_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.post('/quote', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    unitId: z.string().min(1),
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    durationType: z.enum(['daily', 'weekly', 'monthly']),
    durationCount: z.number().int().min(1).max(36),
    promoCode: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid quote inputs' });
    return;
  }

  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(parsed.data.unitId) as Record<string, unknown> | undefined;
  if (!unit) {
    res.status(404).json({ error: 'Selected storage unit not found.' });
    return;
  }

  const checkOutDate = computeCheckoutDate(parsed.data.checkInDate, parsed.data.durationType, parsed.data.durationCount);
  const available = unit.status !== 'maintenance' && !hasOverlappingBooking(parsed.data.unitId, parsed.data.checkInDate, checkOutDate);
  const pricing = calculateBookingPricing(unit, parsed.data.durationType, parsed.data.durationCount, parsed.data.promoCode);

  res.json({
    available,
    checkOutDate,
    ...pricing,
  });
});

router.post('/upload-image', requireAuth, (req: AuthedRequest, res) => {
  const imageData = req.body?.imageData;
  if (typeof imageData !== 'string') {
    res.status(400).json({ error: 'Image data is required.' });
    return;
  }
  try {
    const url = saveBase64Image(imageData, 'booking');
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Image upload failed' });
  }
});

router.get('/', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT b.*,
      f.name as facility_name, f.city as facility_city, f.locality as facility_locality,
      f.address as facility_address, f.image_url as facility_image,
      u.unit_code, u.size_label as unit_size_label, u.area_sqft as unit_area_sqft, u.dimensions as unit_dimensions
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    JOIN units u ON b.unit_id = u.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `).all(req.user!.userId) as Record<string, unknown>[];

  res.json({ bookings: rows.map(hydrateBooking) });
});

router.post('/', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    facilityId: z.string().min(1),
    unitId: z.string().min(1),
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    durationType: z.enum(['daily', 'weekly', 'monthly']),
    durationCount: z.number().int().min(1).max(36),
    inventorySummary: z.string().trim().max(800).optional(),
    itemImages: z.array(z.string()).max(6).optional(),
    promoCode: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid booking request' });
    return;
  }

  const { facilityId, unitId, checkInDate, durationType, durationCount, inventorySummary, itemImages, promoCode } = parsed.data;
  const checkOutDate = computeCheckoutDate(checkInDate, durationType, durationCount);

  try {
    const createdId = db.transaction(() => {
      const unit = db.prepare('SELECT * FROM units WHERE id = ? AND facility_id = ?').get(unitId, facilityId) as Record<string, unknown> | undefined;
      if (!unit) throw new Error('UNIT_NOT_FOUND');
      if (unit.status === 'maintenance') throw new Error('UNIT_MAINTENANCE');
      if (hasOverlappingBooking(unitId, checkInDate, checkOutDate)) throw new Error('UNIT_DOUBLE_BOOKED');

      const pricing = calculateBookingPricing(unit, durationType, durationCount, promoCode);
      const id = crypto.randomUUID();
      const bookingCode = `STV-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const qrToken = signQrPayload('booking', id, req.user!.userId);
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO bookings (
          id, booking_code, user_id, facility_id, unit_id, check_in_date, check_out_date,
          duration_type, duration_count, inventory_summary, item_images_json,
          subtotal, discount_amount, promo_code, gst_amount, total_amount, paid_amount,
          payment_status, booking_status, qr_token, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', 'pending', ?, ?, ?)
      `).run(
        id, bookingCode, req.user!.userId, facilityId, unitId, checkInDate, checkOutDate,
        durationType, durationCount, inventorySummary || '', JSON.stringify(itemImages || []),
        pricing.subtotal, pricing.discountAmount, pricing.appliedPromo, pricing.gstAmount, pricing.totalAmount,
        qrToken, now, now
      );

      return id;
    })();

    const row = db.prepare(`
      SELECT b.*,
        f.name as facility_name, f.city as facility_city, f.locality as facility_locality,
        f.address as facility_address, f.image_url as facility_image,
        u.unit_code, u.size_label as unit_size_label, u.area_sqft as unit_area_sqft, u.dimensions as unit_dimensions
      FROM bookings b
      JOIN facilities f ON b.facility_id = f.id
      JOIN units u ON b.unit_id = u.id
      WHERE b.id = ?
    `).get(createdId) as Record<string, unknown>;

    res.status(201).json({ booking: hydrateBooking(row) });
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'UNIT_NOT_FOUND') {
      res.status(404).json({ error: 'Selected unit does not belong to this facility.' });
      return;
    }
    if (code === 'UNIT_DOUBLE_BOOKED' || code === 'UNIT_MAINTENANCE') {
      res.status(409).json({ error: 'This unit is already reserved for the selected dates. Please pick another unit or date range.' });
      return;
    }
    res.status(500).json({ error: 'Could not create booking.' });
  }
});

router.get('/:id', requireAuth, (req: AuthedRequest, res) => {
  const row = db.prepare(`
    SELECT b.*,
      f.name as facility_name, f.city as facility_city, f.locality as facility_locality,
      f.address as facility_address, f.image_url as facility_image,
      u.unit_code, u.size_label as unit_size_label, u.area_sqft as unit_area_sqft, u.dimensions as unit_dimensions
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    JOIN units u ON b.unit_id = u.id
    WHERE b.id = ? AND b.user_id = ?
  `).get(req.params.id, req.user!.userId) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }

  const linkedItems = db.prepare(`
    SELECT id, item_code as itemCode, name, category, quantity, estimated_value as estimatedValue, movement_status as movementStatus, qr_token as qrToken
    FROM inventory_items WHERE booking_id = ? AND user_id = ?
  `).all(req.params.id, req.user!.userId);

  const payments = db.prepare(`
    SELECT id, order_id as orderId, payment_id as paymentId, amount, payment_mode as paymentMode, method, status, invoice_number as invoiceNumber, refund_status as refundStatus, created_at as createdAt
    FROM payments WHERE booking_id = ? AND user_id = ? ORDER BY created_at DESC
  `).all(req.params.id, req.user!.userId);

  res.json({ booking: hydrateBooking(row), linkedItems, payments });
});

router.put('/:id/modify', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    inventorySummary: z.string().trim().max(800).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid modification payload.' });
    return;
  }

  const existing = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.userId) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }
  if (['cancelled', 'completed'].includes(existing.booking_status as string)) {
    res.status(400).json({ error: 'Completed or cancelled bookings cannot be modified.' });
    return;
  }

  const nextCheckIn = parsed.data.checkInDate || (existing.check_in_date as string);
  const nextCheckOut = computeCheckoutDate(
    nextCheckIn,
    existing.duration_type as 'daily' | 'weekly' | 'monthly',
    Number(existing.duration_count)
  );

  if (hasOverlappingBooking(existing.unit_id as string, nextCheckIn, nextCheckOut, existing.id as string)) {
    res.status(409).json({ error: 'Unit is unavailable for the updated check-in date.' });
    return;
  }

  db.prepare(`
    UPDATE bookings SET check_in_date = ?, check_out_date = ?, inventory_summary = ?, updated_at = ?
    WHERE id = ?
  `).run(nextCheckIn, nextCheckOut, parsed.data.inventorySummary ?? existing.inventory_summary, new Date().toISOString(), existing.id);

  const row = db.prepare(`
    SELECT b.*,
      f.name as facility_name, f.city as facility_city, f.locality as facility_locality,
      f.address as facility_address, f.image_url as facility_image,
      u.unit_code, u.size_label as unit_size_label, u.area_sqft as unit_area_sqft, u.dimensions as unit_dimensions
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    JOIN units u ON b.unit_id = u.id
    WHERE b.id = ?
  `).get(existing.id) as Record<string, unknown>;

  res.json({ booking: hydrateBooking(row) });
});

router.post('/:id/extend', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    extraCount: z.number().int().min(1).max(24),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Specify between 1 and 24 additional periods.' });
    return;
  }

  const existing = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.userId) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }
  if (['cancelled', 'completed'].includes(existing.booking_status as string)) {
    res.status(400).json({ error: 'Only active or confirmed bookings can be extended.' });
    return;
  }

  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(existing.unit_id) as Record<string, unknown>;
  const newCount = Number(existing.duration_count) + parsed.data.extraCount;
  const newCheckOut = computeCheckoutDate(
    existing.check_in_date as string,
    existing.duration_type as 'daily' | 'weekly' | 'monthly',
    newCount
  );

  if (hasOverlappingBooking(existing.unit_id as string, existing.check_in_date as string, newCheckOut, existing.id as string)) {
    res.status(409).json({ error: 'Unit already has an upcoming reservation after your current checkout date.' });
    return;
  }

  const pricing = calculateBookingPricing(
    unit,
    existing.duration_type as 'daily' | 'weekly' | 'monthly',
    newCount,
    (existing.promo_code as string) || undefined
  );
  const paid = Number(existing.paid_amount);
  const nextPayStatus = paid >= pricing.totalAmount ? 'paid' : paid > 0 ? 'advance_paid' : 'pending';

  db.prepare(`
    UPDATE bookings SET
      duration_count = ?, check_out_date = ?, subtotal = ?, discount_amount = ?,
      gst_amount = ?, total_amount = ?, payment_status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    newCount, newCheckOut, pricing.subtotal, pricing.discountAmount,
    pricing.gstAmount, pricing.totalAmount, nextPayStatus, new Date().toISOString(), existing.id
  );

  createNotification(
    req.user!.userId,
    'extension',
    'Booking Extended',
    `Booking ${existing.booking_code} extended until ${newCheckOut}.`,
    `/bookings/${existing.id}`
  );

  const row = db.prepare(`
    SELECT b.*,
      f.name as facility_name, f.city as facility_city, f.locality as facility_locality,
      f.address as facility_address, f.image_url as facility_image,
      u.unit_code, u.size_label as unit_size_label, u.area_sqft as unit_area_sqft, u.dimensions as unit_dimensions
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    JOIN units u ON b.unit_id = u.id
    WHERE b.id = ?
  `).get(existing.id) as Record<string, unknown>;

  res.json({ booking: hydrateBooking(row) });
});

router.post('/:id/cancel', requireAuth, (req: AuthedRequest, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : 'Cancelled by customer';
  const existing = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.userId) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }
  if (existing.booking_status === 'cancelled') {
    res.status(400).json({ error: 'Booking is already cancelled.' });
    return;
  }

  const now = new Date().toISOString();
  const hasPaid = Number(existing.paid_amount) > 0;

  db.transaction(() => {
    db.prepare(`
      UPDATE bookings SET
        booking_status = 'cancelled',
        payment_status = ?,
        cancellation_reason = ?,
        cancelled_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(hasPaid ? 'refunded' : 'pending', reason, now, now, existing.id);

    db.prepare("UPDATE units SET status = 'available' WHERE id = ?").run(existing.unit_id);

    if (hasPaid) {
      db.prepare(`
        UPDATE payments SET refund_status = 'initiated', status = 'refunded'
        WHERE booking_id = ? AND status = 'captured'
      `).run(existing.id);
    }
  })();

  createNotification(
    req.user!.userId,
    'cancellation',
    'Booking Cancelled',
    `Booking ${existing.booking_code} has been cancelled.${hasPaid ? ' Refund has been initiated to your original payment method.' : ''}`,
    `/bookings/${existing.id}`
  );

  const row = db.prepare(`
    SELECT b.*,
      f.name as facility_name, f.city as facility_city, f.locality as facility_locality,
      f.address as facility_address, f.image_url as facility_image,
      u.unit_code, u.size_label as unit_size_label, u.area_sqft as unit_area_sqft, u.dimensions as unit_dimensions
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    JOIN units u ON b.unit_id = u.id
    WHERE b.id = ?
  `).get(existing.id) as Record<string, unknown>;

  res.json({ booking: hydrateBooking(row) });
});

export default router;
