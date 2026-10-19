# Astrology Consultation Module — Changes in this Session

Everything below is **additive** to the existing e-commerce backend. No existing
routes, models, or controllers were removed or renamed. Only `models/Coupon.js`
and `models/PaymentTransaction.js` were modified in place, and both changes are
backward compatible (new optional fields with safe defaults — see inline
comments in each file).

## 1. Unified mobile-OTP-only auth

- `POST /api/v1/auth/otp/request` — body: `{ mobile }`. Sends an OTP. If the
  mobile number has never been seen before, the account is created silently
  (no separate registration step).
- `POST /api/v1/auth/otp/verify` — body: `{ mobile, otp }`. Verifies the OTP
  and logs the user in, returning `{ user, accessToken }` and setting the
  refresh-token cookie exactly like every other login flow in this codebase.

These sit alongside the existing `/auth/mobile/register` + `/auth/mobile/login`
+ `/auth/mobile/verify` endpoints (kept for backward compatibility) and the
original email/password flow (kept for admin login). Files touched:
`controllers/auth.controller.js`, `routes/auth.routes.js`,
`validators/auth.validator.js`.

## 2. Consultation Services catalog

New files:
- `models/ConsultationService.js` — name, `type` (`kundli` |
  `horoscope_matching` | `gemstone` | `vastu` | `general`), price, duration
  (minutes), image, status (active/inactive).
- `controllers/consultationService.controller.js`
- `routes/consultationService.routes.js` — mounted at
  `/api/v1/consultations/services`.
- `validators/consultation.validator.js` (shared with bookings, below).

Public: `GET /` (list, filterable/paginated via the existing `ApiFeatures`
helper), `GET /:idOrSlug`.
Admin: `POST /`, `PUT /:id`, `PATCH /:id/status` (enable/disable),
`DELETE /:id` — all `protect + authorize('admin')`.

## 3. Consultation Bookings

New files:
- `models/ConsultationBooking.js` — kept entirely separate from `models/Order.js`.
  Has a `serviceSnapshot` (so later price/name edits never rewrite historical
  bookings), `amount`, `coupon`, `paymentStatus`, `paymentMethod`,
  `paymentInfo`, `bookingStatus` + `statusHistory`, `appointmentDate/Time`,
  `meetingMode`, `meetingLink`, and exactly one of `kundliDetails` /
  `horoscopeDetails` (bride+groom) / `gemstoneDetails` / `vastuDetails`
  (matching the service's `type`), plus a post-completion `review`.
- `controllers/consultationBooking.controller.js`
- `routes/consultationBooking.routes.js` — mounted at
  `/api/v1/consultations/bookings`.
- `middlewares/parseJsonFields.middleware.js` — parses nested detail objects
  back out of `multipart/form-data` string fields (needed for the Vastu
  optional photo upload case).

Customer (all `protect`):
- `POST /` — create a booking. Body must include `serviceId`,
  `appointmentDate`, `appointmentTime`, `meetingMode`, `contactMobile`, and
  the one detail object matching the service's type. Vastu bookings may also
  attach up to 6 photos (`images` field, multipart).
- `GET /my` — the logged-in user's bookings (paginated/filterable).
- `GET /:id` — single booking (owner or admin only).
- `POST /:id/cancel` — cancel before completion.
- `POST /:id/review` — review a completed booking.

Admin (added into the existing `routes/admin.routes.js`, so it inherits that
file's `protect + authorize('admin')` gate):
- `GET /admin/consultation-bookings`
- `PUT /admin/consultation-bookings/:id/status`
- `PUT /admin/consultation-bookings/:id/payment`

## 4. Payments — gateway abstraction

New `services/paymentGateways/` folder implementing the "support Razorpay now,
Stripe/PhonePe/Cashfree later" requirement as a real abstraction rather than a
single hard-coded integration:

- `index.js` — registry + `getGateway(name)`. Documents the common interface
  every adapter implements: `createOrder`, `verifyPayment`,
  `verifyWebhookSignature`.
- `razorpay.gateway.js` — real, working implementation, wrapping the existing
  `config/razorpay.js` instance and `services/payment.service.js` signature
  helpers (nothing there was duplicated, just reused).
- `notImplemented.gateway.js` — factory used for `stripe`, `phonepe`,
  `cashfree`: they're registered and reachable through the same interface, but
  clearly refuse to process anything (`501`) until someone writes the real
  adapter file. Adding a gateway later is exactly one new file plus one line
  in `index.js` — no other code changes.

`controllers/consultationPayment.controller.js` (routes added into
`consultationBooking.routes.js`):
- `POST /api/v1/consultations/bookings/:id/pay/create-order` — body:
  `{ gateway? }` (defaults to `razorpay`).
- `POST /api/v1/consultations/bookings/:id/pay/verify` — body:
  `{ gatewayOrderId, gatewayPaymentId, signature }`.

`models/PaymentTransaction.js` gained an optional `consultationBooking` ref
(alongside the existing `order` ref) so the same audit-log collection covers
both product-order and consultation-booking payments; a `pre('validate')`
hook requires exactly one of the two to be set. Every existing product-order
payment call site is unaffected — it always set `order` and never will set
`consultationBooking`.

## 5. Coupons on consultations

`models/Coupon.js` gained `appliesTo: ['product' | 'consultation']`
(default `['product']`). Booking creation checks
`coupon.appliesTo.includes('consultation')` before allowing redemption.
Existing coupons and the product-order checkout flow are unaffected — they
never read this field.

## 6. Admin dashboard

`controllers/dashboard.controller.js`'s `getStats` now additionally returns
`totalConsultationBookings`, `consultationRevenue`, `todayConsultationRevenue`,
and folds consultation revenue into the top-level `revenue` figure
(`totalSales` still means product-order revenue alone, unchanged). A new
`getRecentConsultationBookings` mirrors the existing `getRecentOrders`, wired
to `GET /api/v1/admin/dashboard/recent-consultation-bookings`.

## 7. Seed data

`seed/consultationServiceSeeder.js` creates the four services named in the
spec (Kundli Reading, Horoscope Matching, Gemstone Consultation, Vastu
Consultation) if they don't already exist. Wired into `seed/index.js`, so
`node seed/index.js` (or however you invoke the existing seeder) now also
seeds these — it's additive and idempotent, so re-running it is safe.

## Verified in this session

- Every new/modified file passes `node --check` (syntax).
- `npm install` succeeds cleanly against the existing `package.json` (no new
  dependencies were needed — uuid, express-validator, multer, mongoose, etc.
  were all already present).
- The entire route tree (`routes/index.js`, all 25 top-level mounts) requires
  successfully end-to-end with stub env vars, with no DB connection — this
  catches missing exports, circular requires, and wiring mistakes, though it
  does **not** exercise actual request handling.

## Not done in this session (flagged, not silently skipped)

- No live MongoDB was available in this sandbox, so nothing here was
  exercised with real HTTP requests / a real database. Please run your own
  integration pass (Postman/Insomnia collection or a test suite) before
  relying on this in production.
- Banners, testimonials, CMS page extensions, and global search across
  consultation services are not yet touched.
- The "future-ready" items (live chat, video calling, Kundli PDF generation,
  AI horoscope reports, subscriptions, wallet, referrals, loyalty points) are
  intentionally out of scope for this pass — the module's structure (separate
  models/controllers/routes per concern) should make each of them additive
  when you're ready.
