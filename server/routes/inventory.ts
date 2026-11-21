import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { requireAuth, saveBase64Image, signQrPayload, type AuthedRequest } from '../middleware/auth.ts';
import { createNotification } from './auth.ts';

const router = Router();

const CATEGORIES = [
  'Furniture',
  'Electronics',
  'Documents',
  'Household goods',
  'Business inventory',
  'Clothing',
  'Other',
] as const;

const itemSchema = z.object({
  name: z.string().trim().min(2, 'Item name is required').max(120),
  category: z.enum(CATEGORIES),
  description: z.string().trim().max(500).optional(),
  quantity: z.number().int().min(1).max(1000),
  estimatedValue: z.number().min(0).max(100000000),
  dimensions: z.string().trim().max(80).optional(),
  bookingId: z.string().optional().nullable(),
  images: z.array(z.string()).max(4).optional(),
});

function hydrateItem(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    itemCode: String(row.item_code),
    userId: String(row.user_id),
    bookingId: row.booking_id ? String(row.booking_id) : null,
    bookingCode: row.booking_code ? String(row.booking_code) : null,
    facilityId: row.facility_id ? String(row.facility_id) : null,
    facilityName: row.facility_name ? String(row.facility_name) : 'Personal / Unassigned',
    unitId: row.unit_id ? String(row.unit_id) : null,
    unitCode: row.unit_code ? String(row.unit_code) : null,
    name: String(row.name),
    category: String(row.category),
    description: row.description ? String(row.description) : '',
    quantity: Number(row.quantity),
    estimatedValue: Number(row.estimated_value),
    dimensions: row.dimensions ? String(row.dimensions) : '',
    images: JSON.parse((row.images_json as string) || '[]') as string[],
    qrToken: String(row.qr_token),
    movementStatus: String(row.movement_status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

router.get('/', requireAuth, (req: AuthedRequest, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';

  const rows = db.prepare(`
    SELECT i.*, b.booking_code, f.name as facility_name, u.unit_code
    FROM inventory_items i
    LEFT JOIN bookings b ON i.booking_id = b.id
    LEFT JOIN facilities f ON i.facility_id = f.id
    LEFT JOIN units u ON i.unit_id = u.id
    WHERE i.user_id = ?
    ORDER BY i.updated_at DESC
  `).all(req.user!.userId) as Record<string, unknown>[];

  let items = rows.map(hydrateItem);
  if (q) {
    items = items.filter((it) =>
      it.name.toLowerCase().includes(q) ||
      it.itemCode.toLowerCase().includes(q) ||
      it.description.toLowerCase().includes(q) ||
      it.facilityName.toLowerCase().includes(q)
    );
  }
  if (category && category !== 'All') {
    items = items.filter((it) => it.category === category);
  }

  res.json({ items });
});

router.post('/upload-image', requireAuth, (req: AuthedRequest, res) => {
  const imageData = req.body?.imageData;
  if (typeof imageData !== 'string') {
    res.status(400).json({ error: 'Image data is required.' });
    return;
  }
  try {
    const url = saveBase64Image(imageData, 'inv');
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Image upload failed' });
  }
});

router.post('/', requireAuth, (req: AuthedRequest, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid inventory item' });
    return;
  }

  let facilityId: string | null = null;
  let unitId: string | null = null;
  let bookingId: string | null = null;
  let locationLabel = 'Personal Archive';

  if (parsed.data.bookingId) {
    const booking = db.prepare(`
      SELECT b.id, b.facility_id, b.unit_id, f.name as facility_name, u.unit_code
      FROM bookings b
      JOIN facilities f ON b.facility_id = f.id
      JOIN units u ON b.unit_id = u.id
      WHERE b.id = ? AND b.user_id = ? AND b.booking_status IN ('pending', 'confirmed', 'active')
    `).get(parsed.data.bookingId, req.user!.userId) as Record<string, unknown> | undefined;

    if (!booking) {
      res.status(400).json({ error: 'Selected booking is not eligible for storing items.' });
      return;
    }
    bookingId = booking.id as string;
    facilityId = booking.facility_id as string;
    unitId = booking.unit_id as string;
    locationLabel = `${booking.facility_name} · Unit ${booking.unit_code}`;
  }

  const id = crypto.randomUUID();
  const itemCode = `ITM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const qrToken = signQrPayload('item', id, req.user!.userId);
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO inventory_items (
        id, item_code, user_id, booking_id, facility_id, unit_id,
        name, category, description, quantity, estimated_value, dimensions,
        images_json, qr_token, movement_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_storage', ?, ?)
    `).run(
      id, itemCode, req.user!.userId, bookingId, facilityId, unitId,
      parsed.data.name, parsed.data.category, parsed.data.description || '',
      parsed.data.quantity, parsed.data.estimatedValue, parsed.data.dimensions || '',
      JSON.stringify(parsed.data.images || []), qrToken, now, now
    );

    db.prepare(`
      INSERT INTO inventory_logs (id, item_id, user_id, action, location_note, timestamp)
      VALUES (?, ?, ?, 'checked_in', ?, ?)
    `).run(crypto.randomUUID(), id, req.user!.userId, locationLabel, now);
  })();

  createNotification(
    req.user!.userId,
    'inventory',
    'Inventory Item Logged',
    `${parsed.data.name} (${itemCode}) added with unique QR tracking.`,
    '/inventory'
  );

  const row = db.prepare(`
    SELECT i.*, b.booking_code, f.name as facility_name, u.unit_code
    FROM inventory_items i
    LEFT JOIN bookings b ON i.booking_id = b.id
    LEFT JOIN facilities f ON i.facility_id = f.id
    LEFT JOIN units u ON i.unit_id = u.id
    WHERE i.id = ?
  `).get(id) as Record<string, unknown>;

  res.status(201).json({ item: hydrateItem(row) });
});

router.put('/:id', requireAuth, (req: AuthedRequest, res) => {
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid update fields' });
    return;
  }

  const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.userId) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Inventory item not found.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE inventory_items SET
      name = ?, category = ?, description = ?, quantity = ?, estimated_value = ?,
      dimensions = ?, images_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    parsed.data.name ?? existing.name,
    parsed.data.category ?? existing.category,
    parsed.data.description ?? existing.description,
    parsed.data.quantity ?? existing.quantity,
    parsed.data.estimatedValue ?? existing.estimated_value,
    parsed.data.dimensions ?? existing.dimensions,
    parsed.data.images ? JSON.stringify(parsed.data.images) : existing.images_json,
    now,
    existing.id
  );

  const row = db.prepare(`
    SELECT i.*, b.booking_code, f.name as facility_name, u.unit_code
    FROM inventory_items i
    LEFT JOIN bookings b ON i.booking_id = b.id
    LEFT JOIN facilities f ON i.facility_id = f.id
    LEFT JOIN units u ON i.unit_id = u.id
    WHERE i.id = ?
  `).get(existing.id) as Record<string, unknown>;

  res.json({ item: hydrateItem(row) });
});

router.post('/:id/move', requireAuth, (req: AuthedRequest, res) => {
  const bookingId = typeof req.body?.bookingId === 'string' ? req.body.bookingId : '';
  const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.userId) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Inventory item not found.' });
    return;
  }

  const targetBooking = db.prepare(`
    SELECT b.id, b.facility_id, b.unit_id, f.name as facility_name, u.unit_code
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    JOIN units u ON b.unit_id = u.id
    WHERE b.id = ? AND b.user_id = ? AND b.booking_status IN ('pending', 'confirmed', 'active')
  `).get(bookingId, req.user!.userId) as Record<string, unknown> | undefined;

  if (!targetBooking) {
    res.status(400).json({ error: 'Destination booking/unit is not eligible.' });
    return;
  }

  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`
      UPDATE inventory_items SET booking_id = ?, facility_id = ?, unit_id = ?, updated_at = ?
      WHERE id = ?
    `).run(targetBooking.id, targetBooking.facility_id, targetBooking.unit_id, now, existing.id);

    db.prepare(`
      INSERT INTO inventory_logs (id, item_id, user_id, action, location_note, timestamp)
      VALUES (?, ?, ?, 'moved', ?, ?)
    `).run(crypto.randomUUID(), existing.id, req.user!.userId, `Moved to ${targetBooking.facility_name} · Unit ${targetBooking.unit_code}`, now);
  })();

  const row = db.prepare(`
    SELECT i.*, b.booking_code, f.name as facility_name, u.unit_code
    FROM inventory_items i
    LEFT JOIN bookings b ON i.booking_id = b.id
    LEFT JOIN facilities f ON i.facility_id = f.id
    LEFT JOIN units u ON i.unit_id = u.id
    WHERE i.id = ?
  `).get(existing.id) as Record<string, unknown>;

  res.json({ item: hydrateItem(row) });
});

router.get('/:id/logs', requireAuth, (req: AuthedRequest, res) => {
  const existing = db.prepare('SELECT id FROM inventory_items WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.userId);
  if (!existing) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }

  const logs = db.prepare(`
    SELECT id, action, location_note as locationNote, timestamp
    FROM inventory_logs WHERE item_id = ? ORDER BY timestamp DESC
  `).all(req.params.id);

  res.json({ logs });
});

router.delete('/:id', requireAuth, (req: AuthedRequest, res) => {
  const result = db.prepare('DELETE FROM inventory_items WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user!.userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Inventory item not found.' });
    return;
  }
  res.json({ ok: true });
});

export default router;
