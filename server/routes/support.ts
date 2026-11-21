import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database.ts';
import { requireAuth, saveBase64Image, type AuthedRequest } from '../middleware/auth.ts';
import { createNotification } from './auth.ts';

const router = Router();

const FAQS = [
  {
    id: 'faq-1',
    category: 'Booking & Pricing',
    question: 'How does STOVRA calculate storage pricing and GST?',
    answer: 'Each unit displays transparent daily, weekly, and monthly base rates. Discounts from promo codes apply before 18% GST. You can pay 25% advance to lock a unit or 100% upfront via UPI, cards, net banking, or wallets.',
  },
  {
    id: 'faq-2',
    category: 'Security & QR Access',
    question: 'How does QR code verification work at the facility?',
    answer: 'Every booking and stored item receives a cryptographically signed QR pass. Facility turnstiles and our in-app scanner verify both the signature and your authenticated account ownership on the backend before logging check-in or check-out.',
  },
  {
    id: 'faq-3',
    category: 'Cancellations & Extensions',
    question: 'Can I extend or cancel an active storage booking?',
    answer: 'Yes. From My Bookings or Booking Details, you can extend your duration by days, weeks, or months (subject to unit availability) or cancel eligible bookings. Paid amounts are queued for refund automatically upon cancellation.',
  },
  {
    id: 'faq-4',
    category: 'Climate & Safety',
    question: 'What items are restricted from STOVRA units?',
    answer: 'Perishable food, flammable fuels, hazardous chemicals, live plants/animals, illegal goods, and unsealed liquids are prohibited. Climate-controlled vaults maintain 20–24°C and <50% relative humidity for electronics, wood furniture, and documents.',
  },
  {
    id: 'faq-5',
    category: 'Inventory Management',
    question: 'Can I move stored items between different units or cities?',
    answer: 'Yes. Open My Inventory, select an item, and choose Move Unit to reassign it to another active booking in your account while preserving its full audit trail.',
  },
];

router.get('/faqs', (_req, res) => {
  res.json({ faqs: FAQS });
});

router.get('/tickets', requireAuth, (req: AuthedRequest, res) => {
  const tickets = db.prepare(`
    SELECT id, ticket_code as ticketCode, category, subject, description, screenshot_url as screenshotUrl,
      status, created_at as createdAt, updated_at as updatedAt
    FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.user!.userId);
  res.json({ tickets });
});

router.post('/upload-screenshot', requireAuth, (req: AuthedRequest, res) => {
  const imageData = req.body?.imageData;
  if (typeof imageData !== 'string') {
    res.status(400).json({ error: 'Screenshot image data required.' });
    return;
  }
  try {
    const url = saveBase64Image(imageData, 'ticket');
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

router.post('/tickets', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    category: z.enum(['Booking Issue', 'Payment & Refund', 'QR & Gate Access', 'Inventory & Damage', 'Feedback & Complaint', 'Account & Profile']),
    subject: z.string().trim().min(4, 'Subject is too short').max(140),
    description: z.string().trim().min(12, 'Please describe the issue in at least 12 characters').max(2000),
    screenshotUrl: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid support ticket details' });
    return;
  }

  const id = crypto.randomUUID();
  const ticketCode = `TKT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO support_tickets (id, ticket_code, user_id, category, subject, description, screenshot_url, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
  `).run(
    id, ticketCode, req.user!.userId, parsed.data.category,
    parsed.data.subject, parsed.data.description, parsed.data.screenshotUrl || '', now, now
  );

  createNotification(
    req.user!.userId,
    'booking',
    'Support Ticket Created',
    `Ticket ${ticketCode} ("${parsed.data.subject}") has been logged with STOVRA Support.`,
    '/support'
  );

  const ticket = db.prepare(`
    SELECT id, ticket_code as ticketCode, category, subject, description, screenshot_url as screenshotUrl,
      status, created_at as createdAt, updated_at as updatedAt
    FROM support_tickets WHERE id = ?
  `).get(id);

  res.status(201).json({ ticket });
});

export default router;
