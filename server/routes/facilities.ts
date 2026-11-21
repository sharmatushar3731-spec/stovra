import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { optionalAuth, requireAuth, type AuthedRequest } from '../middleware/auth.ts';

const router = Router();

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function hydrateFacility(row: Record<string, unknown>, userLat?: number, userLng?: number, userId?: string) {
  const units = db.prepare('SELECT * FROM units WHERE facility_id = ? ORDER BY area_sqft ASC').all(row.id) as Record<string, unknown>[];
  const availableUnitsCount = units.filter((u) => u.status === 'available').length;
  const distanceKm =
    typeof userLat === 'number' && typeof userLng === 'number' && !Number.isNaN(userLat) && !Number.isNaN(userLng)
      ? haversineKm(userLat, userLng, Number(row.lat), Number(row.lng))
      : null;

  let isWishlisted = false;
  if (userId) {
    const wish = db.prepare('SELECT 1 FROM wishlists WHERE user_id = ? AND facility_id = ?').get(userId, row.id);
    isWishlisted = Boolean(wish);
  }

  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    city: String(row.city),
    locality: String(row.locality),
    pincode: String(row.pincode),
    address: String(row.address),
    lat: Number(row.lat),
    lng: Number(row.lng),
    description: String(row.description),
    imageUrl: String(row.image_url),
    gallery: JSON.parse((row.gallery_json as string) || '[]') as string[],
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    amenities: JSON.parse((row.amenities_json as string) || '[]') as string[],
    securityFeatures: JSON.parse((row.security_features_json as string) || '[]') as string[],
    climateControlled: Boolean(row.climate_controlled),
    operatingHours: String(row.operating_hours),
    baseDailyRate: Number(row.base_daily_rate),
    baseWeeklyRate: Number(row.base_weekly_rate),
    baseMonthlyRate: Number(row.base_monthly_rate),
    totalUnits: units.length,
    availableUnits: availableUnitsCount,
    minUnitSqft: units.length ? Math.min(...units.map((u) => Number(u.area_sqft))) : 0,
    maxUnitSqft: units.length ? Math.max(...units.map((u) => Number(u.area_sqft))) : 0,
    distanceKm,
    isWishlisted,
    units: units.map((u) => ({
      id: String(u.id),
      facilityId: String(u.facility_id),
      unitCode: String(u.unit_code),
      sizeLabel: String(u.size_label),
      areaSqft: Number(u.area_sqft),
      dimensions: String(u.dimensions),
      storageType: String(u.storage_type),
      climateControlled: Boolean(u.climate_controlled),
      floorLevel: String(u.floor_level),
      dailyRate: Number(u.daily_rate),
      weeklyRate: Number(u.weekly_rate),
      monthlyRate: Number(u.monthly_rate),
      status: String(u.status),
    })),
  };
}

router.get('/', optionalAuth, (req: AuthedRequest, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  const climateOnly = req.query.climate === 'true';
  const availableOnly = req.query.availableOnly === 'true';
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : 0;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : 999999;
  const minSqft = req.query.minSqft ? Number(req.query.minSqft) : 0;
  const maxSqft = req.query.maxSqft ? Number(req.query.maxSqft) : 9999;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'rating';
  const userLat = req.query.lat ? Number(req.query.lat) : undefined;
  const userLng = req.query.lng ? Number(req.query.lng) : undefined;
  const wishlistedOnly = req.query.wishlist === 'true';

  const rows = db.prepare('SELECT * FROM facilities').all() as Record<string, unknown>[];
  let items = rows.map((r) => hydrateFacility(r, userLat, userLng, req.user?.userId));

  if (q) {
    items = items.filter((f) =>
      f.name.toLowerCase().includes(q) ||
      f.city.toLowerCase().includes(q) ||
      f.locality.toLowerCase().includes(q) ||
      f.pincode.includes(q) ||
      f.address.toLowerCase().includes(q)
    );
  }
  if (city && city !== 'All') {
    if (city.toLowerCase() === 'uttar pradesh') {
      items = items.filter(
        (f) =>
          f.address.toLowerCase().includes('uttar pradesh') ||
          ['meerut', 'agra', 'noida', 'lucknow'].includes(f.city.toLowerCase())
      );
    } else {
      items = items.filter((f) => f.city.toLowerCase() === city.toLowerCase());
    }
  }
  if (climateOnly) {
    items = items.filter((f) => f.climateControlled);
  }
  if (availableOnly) {
    items = items.filter((f) => f.availableUnits > 0);
  }
  if (wishlistedOnly) {
    items = items.filter((f) => f.isWishlisted);
  }
  items = items.filter((f) => {
    const matchingUnits = f.units.filter(
      (u) => u.monthlyRate >= minPrice && u.monthlyRate <= maxPrice && u.areaSqft >= minSqft && u.areaSqft <= maxSqft
    );
    return matchingUnits.length > 0;
  });

  items.sort((a, b) => {
    if (sort === 'price_asc') return a.baseMonthlyRate - b.baseMonthlyRate;
    if (sort === 'price_desc') return b.baseMonthlyRate - a.baseMonthlyRate;
    if (sort === 'distance' && a.distanceKm !== null && b.distanceKm !== null) {
      return a.distanceKm - b.distanceKm;
    }
    return b.rating - a.rating;
  });

  res.json({ facilities: items });
});

router.get('/recently-viewed', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT f.* FROM recently_viewed rv
    JOIN facilities f ON rv.facility_id = f.id
    WHERE rv.user_id = ?
    ORDER BY rv.viewed_at DESC
    LIMIT 6
  `).all(req.user!.userId) as Record<string, unknown>[];

  res.json({
    facilities: rows.map((r) => hydrateFacility(r, undefined, undefined, req.user!.userId)),
  });
});

router.get('/wishlist/all', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT f.* FROM wishlists w
    JOIN facilities f ON w.facility_id = f.id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `).all(req.user!.userId) as Record<string, unknown>[];

  res.json({
    facilities: rows.map((r) => hydrateFacility(r, undefined, undefined, req.user!.userId)),
  });
});

router.post('/:id/wishlist', requireAuth, (req: AuthedRequest, res) => {
  const fac = db.prepare('SELECT id FROM facilities WHERE id = ?').get(req.params.id);
  if (!fac) {
    res.status(404).json({ error: 'Facility not found.' });
    return;
  }

  const existing = db.prepare('SELECT 1 FROM wishlists WHERE user_id = ? AND facility_id = ?')
    .get(req.user!.userId, req.params.id);

  if (existing) {
    db.prepare('DELETE FROM wishlists WHERE user_id = ? AND facility_id = ?').run(req.user!.userId, req.params.id);
    res.json({ wishlisted: false });
  } else {
    db.prepare('INSERT INTO wishlists (user_id, facility_id, created_at) VALUES (?, ?, ?)')
      .run(req.user!.userId, req.params.id, new Date().toISOString());
    res.json({ wishlisted: true });
  }
});

router.get('/:id', optionalAuth, (req: AuthedRequest, res) => {
  const row = db.prepare('SELECT * FROM facilities WHERE id = ? OR slug = ?').get(req.params.id, req.params.id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Storage facility not found.' });
    return;
  }

  if (req.user) {
    db.prepare(`
      INSERT INTO recently_viewed (user_id, facility_id, viewed_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, facility_id) DO UPDATE SET viewed_at = excluded.viewed_at
    `).run(req.user.userId, row.id, new Date().toISOString());
  }

  const userLat = req.query.lat ? Number(req.query.lat) : undefined;
  const userLng = req.query.lng ? Number(req.query.lng) : undefined;
  const facility = hydrateFacility(row, userLat, userLng, req.user?.userId);

  const reviews = db.prepare(`
    SELECT id, user_name as userName, rating, comment, verified_booking as verifiedBooking, created_at as createdAt
    FROM reviews WHERE facility_id = ? ORDER BY created_at DESC
  `).all(row.id);

  res.json({ facility, reviews });
});

router.post('/:id/reviews', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(8, 'Please write at least 8 characters').max(600),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid review input' });
    return;
  }

  const fac = db.prepare('SELECT id FROM facilities WHERE id = ?').get(req.params.id) as { id: string } | undefined;
  if (!fac) {
    res.status(404).json({ error: 'Facility not found.' });
    return;
  }

  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.user!.userId) as { full_name: string };
  const hasBooking = db.prepare('SELECT 1 FROM bookings WHERE user_id = ? AND facility_id = ? LIMIT 1')
    .get(req.user!.userId, fac.id);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO reviews (id, facility_id, user_id, user_name, rating, comment, verified_booking, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, fac.id, req.user!.userId, user.full_name, parsed.data.rating, parsed.data.comment, hasBooking ? 1 : 0, now);

  const stats = db.prepare('SELECT AVG(rating) as avgRating, COUNT(*) as cnt FROM reviews WHERE facility_id = ?')
    .get(fac.id) as { avgRating: number; cnt: number };

  db.prepare('UPDATE facilities SET rating = ?, review_count = ? WHERE id = ?')
    .run(Math.round(stats.avgRating * 10) / 10, stats.cnt, fac.id);

  res.status(201).json({
    review: {
      id,
      userName: user.full_name,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      verifiedBooking: Boolean(hasBooking),
      createdAt: now,
    },
  });
});

export default router;
