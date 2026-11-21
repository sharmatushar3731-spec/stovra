import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { createRateLimiter, requireAuth, type AuthedRequest } from '../middleware/auth.ts';
import { createNotification } from './auth.ts';

const router = Router();
const payLimiter = createRateLimiter(60_000, 25);

// Uses configured Razorpay test/live secret, or ephemeral HMAC key for Razorpay Test Mode verification flow.
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || crypto.randomBytes(32).toString('hex');

router.get('/config', requireAuth, (_req, res) => {
  res.json({
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_stovra_sandbox',
    mode: process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? 'razorpay_configured' : 'razorpay_test_sandbox',
    supportedMethods: ['upi', 'card', 'netbanking', 'wallet'],
  });
});

router.post('/create-order', payLimiter, requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    bookingId: z.string().min(1),
    paymentMode: z.enum(['advance', 'full']),
    method: z.enum(['upi', 'card', 'netbanking', 'wallet']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payment order request.' });
    return;
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?')
    .get(parsed.data.bookingId, req.user!.userId) as Record<string, unknown> | undefined;

  if (!booking) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }
  if (booking.booking_status === 'cancelled') {
    res.status(400).json({ error: 'Cannot pay for a cancelled booking.' });
    return;
  }

  const remaining = Math.max(0, Number(booking.total_amount) - Number(booking.paid_amount));
  if (remaining <= 0) {
    res.status(400).json({ error: 'This booking is already paid in full.' });
    return;
  }

  const payableAmount =
    parsed.data.paymentMode === 'advance' && Number(booking.paid_amount) === 0
      ? Math.max(500, Math.round(remaining * 0.25))
      : remaining;

  const id = crypto.randomUUID();
  const orderId = `order_${crypto.randomBytes(6).toString('hex')}`;
  const invoiceNumber = `INV-STV-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO payments (
      id, order_id, user_id, booking_id, amount, payment_mode, method, status, invoice_number, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'created', ?, ?)
  `).run(id, orderId, req.user!.userId, booking.id, payableAmount, parsed.data.paymentMode, parsed.data.method, invoiceNumber, now);

  // Server computes deterministic test-mode verification token only for sandbox verification demonstration
  const isLiveRazorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const sandboxPaymentId = !isLiveRazorpay ? `pay_${crypto.randomBytes(6).toString('hex')}` : undefined;
  const sandboxSignature = !isLiveRazorpay && sandboxPaymentId
    ? crypto.createHmac('sha256', RAZORPAY_SECRET).update(`${orderId}|${sandboxPaymentId}`).digest('hex')
    : undefined;

  res.status(201).json({
    order: {
      id,
      orderId,
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      amountInr: payableAmount,
      amountPaise: payableAmount * 100,
      currency: 'INR',
      paymentMode: parsed.data.paymentMode,
      method: parsed.data.method,
      invoiceNumber,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_stovra_sandbox',
      sandboxAuth: sandboxPaymentId ? { razorpay_payment_id: sandboxPaymentId, razorpay_signature: sandboxSignature } : null,
    },
  });
});

router.post('/verify', payLimiter, requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    orderId: z.string().min(1),
    razorpay_payment_id: z.string().min(4),
    razorpay_signature: z.string().min(16),
    simulateFailure: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payment verification payload.' });
    return;
  }

  const payment = db.prepare('SELECT * FROM payments WHERE order_id = ? AND user_id = ?')
    .get(parsed.data.orderId, req.user!.userId) as Record<string, unknown> | undefined;

  if (!payment) {
    res.status(404).json({ error: 'Payment order not found.' });
    return;
  }

  if (parsed.data.simulateFailure) {
    db.prepare("UPDATE payments SET status = 'failed' WHERE id = ?").run(payment.id);
    res.status(402).json({ error: 'Payment declined by bank gateway (Test Failure Simulation).' });
    return;
  }

  const expectedSig = crypto
    .createHmac('sha256', RAZORPAY_SECRET)
    .update(`${parsed.data.orderId}|${parsed.data.razorpay_payment_id}`)
    .digest('hex');

  let sigMatches = false;
  try {
    sigMatches = crypto.timingSafeEqual(Buffer.from(parsed.data.razorpay_signature), Buffer.from(expectedSig));
  } catch {
    sigMatches = false;
  }

  if (!sigMatches) {
    db.prepare("UPDATE payments SET status = 'failed' WHERE id = ?").run(payment.id);
    res.status(400).json({ error: 'Payment signature verification failed.' });
    return;
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(payment.booking_id) as Record<string, unknown>;
  const newPaid = Number(booking.paid_amount) + Number(payment.amount);
  const totalAmount = Number(booking.total_amount);
  const nextPaymentStatus = newPaid >= totalAmount ? 'paid' : 'advance_paid';
  const nextBookingStatus = booking.booking_status === 'pending' ? 'confirmed' : (booking.booking_status as string);
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      UPDATE payments SET
        payment_id = ?, status = 'captured', signature_verified = 1
      WHERE id = ?
    `).run(parsed.data.razorpay_payment_id, payment.id);

    db.prepare(`
      UPDATE bookings SET
        paid_amount = ?, payment_status = ?, booking_status = ?, updated_at = ?
      WHERE id = ?
    `).run(newPaid, nextPaymentStatus, nextBookingStatus, now, booking.id);
  })();

  createNotification(
    req.user!.userId,
    'payment',
    'Payment Confirmed',
    `₹${Number(payment.amount).toLocaleString('en-IN')} received for booking ${booking.booking_code} (${payment.invoice_number}).`,
    `/bookings/${booking.id}`
  );

  res.json({
    verified: true,
    paymentId: parsed.data.razorpay_payment_id,
    invoiceNumber: payment.invoice_number,
    bookingId: booking.id,
    paymentStatus: nextPaymentStatus,
    bookingStatus: nextBookingStatus,
  });
});

router.get('/history', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT p.*, b.booking_code, f.name as facility_name, u.unit_code
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN facilities f ON b.facility_id = f.id
    JOIN units u ON b.unit_id = u.id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `).all(req.user!.userId) as Record<string, unknown>[];

  res.json({
    transactions: rows.map((r) => ({
      id: r.id,
      orderId: r.order_id,
      paymentId: r.payment_id || '-',
      bookingId: r.booking_id,
      bookingCode: r.booking_code,
      facilityName: r.facility_name,
      unitCode: r.unit_code,
      amount: Number(r.amount),
      paymentMode: r.payment_mode,
      method: r.method,
      status: r.status,
      signatureVerified: Boolean(r.signature_verified),
      invoiceNumber: r.invoice_number,
      refundStatus: r.refund_status,
      createdAt: r.created_at,
    })),
  });
});

router.get('/invoice/:paymentId', requireAuth, (req: AuthedRequest, res) => {
  const row = db.prepare(`
    SELECT p.*, b.booking_code, b.check_in_date, b.check_out_date, b.duration_type, b.duration_count,
      b.subtotal, b.discount_amount, b.gst_amount, b.total_amount,
      f.name as facility_name, f.address as facility_address, u.unit_code, u.size_label,
      usr.full_name, usr.email, usr.mobile, usr.address as user_address
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN facilities f ON b.facility_id = f.id
    JOIN units u ON b.unit_id = u.id
    JOIN users usr ON p.user_id = usr.id
    WHERE (p.id = ? OR p.invoice_number = ?) AND p.user_id = ?
  `).get(req.params.paymentId, req.params.paymentId, req.user!.userId) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Invoice not found.' });
    return;
  }
  res.json({ invoice: row });
});

export default router;
