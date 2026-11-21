import { Router } from 'express';
import { db } from '../db/database.ts';
import { requireAuth, type AuthedRequest } from '../middleware/auth.ts';

const router = Router();

router.get('/', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.userId;
  const user = db.prepare('SELECT full_name, wallet_balance, mobile_verified, referral_code FROM users WHERE id = ?')
    .get(userId) as Record<string, unknown>;

  const activeBookings = db.prepare(`
    SELECT COUNT(*) as cnt FROM bookings WHERE user_id = ? AND booking_status IN ('active', 'confirmed')
  `).get(userId) as { cnt: number };

  const upcomingBookings = db.prepare(`
    SELECT COUNT(*) as cnt FROM bookings
    WHERE user_id = ? AND booking_status IN ('pending', 'confirmed') AND check_in_date >= date('now')
  `).get(userId) as { cnt: number };

  const storedItems = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as totalQty, COUNT(*) as uniqueItems, COALESCE(SUM(estimated_value), 0) as totalValue
    FROM inventory_items WHERE user_id = ?
  `).get(userId) as { totalQty: number; uniqueItems: number; totalValue: number };

  const bookings = db.prepare(`
    SELECT b.id, b.booking_code as bookingCode, b.check_in_date as checkInDate, b.check_out_date as checkOutDate,
      b.booking_status as bookingStatus, b.payment_status as paymentStatus, b.total_amount as totalAmount,
      b.paid_amount as paidAmount, f.name as facilityName, f.city as facilityCity, u.unit_code as unitCode,
      u.area_sqft as areaSqft
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    JOIN units u ON b.unit_id = u.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
    LIMIT 6
  `).all(userId) as Array<Record<string, unknown>>;

  const nowMs = Date.now();
  const expiryPredictions = bookings
    .filter((b) => b.bookingStatus === 'active' || b.bookingStatus === 'confirmed')
    .map((b) => {
      const daysRemaining = Math.ceil(
        (new Date(`${b.checkOutDate as string}T00:00:00Z`).getTime() - nowMs) / 86_400_000
      );
      return {
        bookingId: b.id,
        bookingCode: b.bookingCode,
        facilityName: b.facilityName,
        checkOutDate: b.checkOutDate,
        daysRemaining,
        urgency: daysRemaining <= 3 ? 'critical' : daysRemaining <= 10 ? 'upcoming' : 'healthy',
      };
    })
    .filter((p) => p.daysRemaining <= 14);

  const recentLogs = db.prepare(`
    SELECT l.id, l.action, l.location_note as locationNote, l.timestamp, i.name as itemName, i.item_code as itemCode
    FROM inventory_logs l
    JOIN inventory_items i ON l.item_id = i.id
    WHERE l.user_id = ?
    ORDER BY l.timestamp DESC
    LIMIT 8
  `).all(userId);

  const recentPayments = db.prepare(`
    SELECT p.id, p.order_id as orderId, p.amount, p.method, p.status, p.invoice_number as invoiceNumber, p.created_at as createdAt, b.booking_code as bookingCode
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
    LIMIT 5
  `).all(userId);

  const notifications = db.prepare(`
    SELECT id, type, title, message, read_at as readAt, link, created_at as createdAt
    FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(userId);

  const unreadCount = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND read_at IS NULL')
    .get(userId) as { cnt: number };

  const totalSqftBooked = bookings
    .filter((b) => b.bookingStatus === 'active' || b.bookingStatus === 'confirmed')
    .reduce((acc, b) => acc + Number(b.areaSqft || 0), 0);

  res.json({
    stats: {
      activeBookings: activeBookings.cnt,
      upcomingBookings: upcomingBookings.cnt,
      storedItemsCount: storedItems.totalQty,
      uniqueItemEntries: storedItems.uniqueItems,
      insuredEstimatedValue: storedItems.totalValue,
      availableStorageBalance: Number(user.wallet_balance || 0),
      totalSqftBooked,
      mobileVerified: Boolean(user.mobile_verified),
      unreadNotifications: unreadCount.cnt,
    },
    bookings,
    expiryPredictions,
    recentActivities: recentLogs,
    paymentHistory: recentPayments,
    notifications,
  });
});

export default router;
