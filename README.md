# STOVRA — Smart Storage Booking & Inventory Management Platform

**Tagline:** *Your Space. Your Control.*

STOVRA is a full-stack smart self-storage discovery, unit booking, QR-verified inventory tracking, and GST payment platform built with React, Vite, Tailwind CSS, Node.js, Express, and SQLite (with documented MongoDB/Mongoose parity schema).

---

## 1. Installation & Running Locally

```bash
npm install
npm run dev       # Starts Express + Vite middleware full-stack server on http://localhost:3000
npm run lint      # Runs TypeScript type-checking
npm run build     # Builds production frontend bundle into dist/
NODE_ENV=production npm start
```

### Environment Variables (`.env`)
- `GEMINI_API_KEY`: Enables Gemini (`gemini-4-hydrogen`) for AI Space Calculator & Inventory Assistant (falls back transparently to volumetric/rule-based logic when unset).
- `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Optional Razorpay credentials (runs verified HMAC-SHA256 Test Sandbox mode when unset).
- `GOOGLE_CLIENT_ID`: Optional Google OAuth Client ID for Google Sign-In.
- `SMS_PROVIDER_API_KEY`: Optional SMS provider key for OTP delivery (sandbox preview mode activates when unset).
- `MONGODB_URI`: Optional MongoDB connection reference for external Atlas deployments.

---

## 2. REST API Documentation

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register customer account (`bcryptjs` password hash, 6-digit OTP hash, JWT + HttpOnly session cookie).
- `POST /api/auth/login` — Authenticate with email/password.
- `GET /api/auth/session` — Restore active session without storing JWTs in `localStorage`.
- `POST /api/auth/logout` — Clear session cookie.
- `POST /api/auth/otp/send` & `POST /api/auth/otp/verify` — Send and verify 6-digit mobile OTP.
- `POST /api/auth/forgot-password` & `POST /api/auth/reset-password` — Reset forgotten password via 6-digit code.
- `PUT /api/auth/profile`, `POST /api/auth/avatar`, `PUT /api/auth/password`, `PUT /api/auth/notifications-prefs`, `POST /api/auth/delete-request`.

### Storage Discovery (`/api/facilities`)
- `GET /api/facilities` — Filter by `q` (city/locality/PIN), `city`, `climate`, `availableOnly`, `minPrice`, `maxPrice`, `minSqft`, `maxSqft`, `sort`, `lat`, `lng`, `wishlist`.
- `GET /api/facilities/:id` — Facility details, live unit availability, and customer reviews.
- `POST /api/facilities/:id/wishlist` — Toggle wishlist.
- `POST /api/facilities/:id/reviews` — Submit customer review (verified if user has a booking).

### Bookings (`/api/bookings`)
- `POST /api/bookings/quote` — Real-time rental + promo + 18% GST quote & overlap check.
- `POST /api/bookings` — Atomic transaction booking creation preventing double-booking.
- `GET /api/bookings` & `GET /api/bookings/:id` — List user bookings & details.
- `PUT /api/bookings/:id/modify` — Update eligible check-in date or inventory notes.
- `POST /api/bookings/:id/extend` — Extend duration with conflict & price recalculation.
- `POST /api/bookings/:id/cancel` — Cancel booking, release unit, initiate refund if paid.

### Inventory & QR Verification (`/api/inventory`, `/api/qr`)
- `GET /api/inventory`, `POST /api/inventory`, `PUT /api/inventory/:id`, `DELETE /api/inventory/:id`
- `POST /api/inventory/:id/move` — Move item between user's active units.
- `GET /api/inventory/:id/logs` — Check-in/check-out/movement audit trail.
- `POST /api/qr/verify` — Server-side HMAC signature + owner authorization check + check-in/check-out logging.

### Payments (`/api/payments`)
- `GET /api/payments/config` — Gateway mode & supported methods (`upi`, `card`, `netbanking`, `wallet`).
- `POST /api/payments/create-order` — Create payment order (25% advance or 100% full).
- `POST /api/payments/verify` — Timing-safe HMAC-SHA256 signature verification & invoice generation.
- `GET /api/payments/history` & `GET /api/payments/invoice/:paymentId`

### AI, Dashboard, Notifications & Support
- `POST /api/ai/space-calculator`, `POST /api/ai/inventory-assistant`, `POST /api/ai/price-estimator`
- `GET /api/dashboard` — Live KPI stats, expiry predictions, activities, payments, notifications.
- `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`
- `GET /api/support/faqs`, `GET /api/support/tickets`, `POST /api/support/tickets`

---

## 3. Database Schema & MongoDB Parity Reference

The active runtime database (`data/stovra.db`) persists 13 normalized tables (`users`, `facilities`, `units`, `reviews`, `wishlists`, `recently_viewed`, `promo_codes`, `bookings`, `inventory_items`, `inventory_logs`, `payments`, `notifications`, `support_tickets`) with foreign keys and atomic transactions.

For MongoDB + Mongoose deployment, map each table 1:1 to collections:
- `User` (`email` unique index, `mobileVerified`, `savedAddresses[]`, `emergencyContact`, `notificationPrefs`)
- `Facility` (`slug` unique index, `geoLocation` 2dsphere index on `[lng, lat]`)
- `Unit` (`facilityId` ref, `status`, `dailyRate`, `weeklyRate`, `monthlyRate`)
- `Booking` (`userId` ref, `unitId` ref, compound date-overlap index `{ unitId: 1, checkInDate: 1, checkOutDate: 1 }`)
- `InventoryItem` (`userId` ref, `bookingId` ref, `qrToken` unique index)
- `Payment` (`orderId` unique index, `invoiceNumber` unique index, `signatureVerified`)

---

## 4. Testing Checklist
1. Register a new account → verify 6-digit OTP on `/verify-otp`.
2. Search storage by city or PIN on `/storage`, test GPS sorting, toggle Map view, compare 2 facilities, and save a facility to Wishlist.
3. Complete the booking flow on `/book/:facilityId`, apply promo `STOVRA15`, complete Razorpay Test Mode UPI payment, and view QR confirmation on `/booking-confirmation/:id`.
4. Add an inventory item on `/inventory/add` using the AI Categorize button, view its QR code, and verify Check-In / Check-Out on `/qr-scanner`.
5. Extend or modify a booking on `/bookings/:id`, download the GST invoice, submit a support ticket on `/support`, and toggle Dark Mode on `/settings`.
