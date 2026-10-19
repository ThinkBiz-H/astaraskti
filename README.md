# Astro Sanatan Shakti — Storefront + Admin Panel

Two independent React 19 + Vite apps, both consuming the existing backend's
REST API with **zero backend modifications**. Every endpoint call was
verified against the actual backend source (routes/controllers/validators),
not guessed from the spec.

- `/frontend` — the customer-facing storefront (port 5173)
- `/admin` — the internal admin panel (port 5174)

Both build cleanly with `npm install && npm run build` (verified in this
session — zero errors, full production bundles).

## Setup

```bash
cd frontend && cp .env.example .env   # set VITE_API_BASE_URL + VITE_RAZORPAY_KEY_ID
npm install && npm run dev

cd admin && cp .env.example .env      # set VITE_API_BASE_URL
npm install && npm run dev
```

Both `.npmrc` files set `legacy-peer-deps=true` — `react-helmet-async`'s
published peer-dependency range doesn't yet list React 19 even though it
works fine with it; this is a peer-range formality, not a real
incompatibility.

## What's fully built

**Storefront**: Home, Shop/Category/Search (shared filterable product
listing), Product Details (gallery+zoom, variants, reviews, related
products), Cart, Wishlist, Checkout with working Razorpay integration,
Register→OTP→complete, Login (password + mobile-OTP modes), Forgot Password
(mobile-OTP flow), full Account dashboard (Profile, Orders, Addresses,
Change Password, Consultations, Kundli Reports), the **complete Consultation
booking flow** (Kundli Reading / Horoscope Matching / Gemstone Consultation
/ Vastu Consultation — one shared, service-type-aware form and booking
pipeline, immediately followed by Razorpay checkout as the spec required),
Blog, CMS policy pages, About, Contact, 404.

**Admin Panel**: Login, Dashboard (real KPI widgets + a live sales chart via
Recharts, wired to the actual aggregation the backend returns), Products
(list + full add/edit form with category-driven attribute hints), Categories
CRUD, Orders (list + detail with status/tracking updates), **Consultation
Bookings management including a dedicated Kundli Requests screen** showing
full birth details per request, Consultation Services CRUD, Coupons CRUD,
Blog CRUD, Home Sections/Banners CRUD, FAQ CRUD, Users (block/unblock/
delete), Settings (general/contact/social/tax/currency/SEO/branding/
environment-status tabs).

## Backend gaps found during integration (not silently worked around)

Every one of these is marked with a `TODO(backend)` comment at its exact
usage site in the code, not just listed here:

1. **No Kundli PDF generation.** The backend never generates a PDF report
   or stores a report URL on a `ConsultationBooking`. The Kundli Reports
   page shows a "report pending" state instead of a fake download link.
2. **No astrologer assignment, WhatsApp send, or admin email-send actions**
   on consultation bookings — the "Upload Report" button in the Kundli
   Requests admin screen is present but disabled with an explanatory tooltip,
   since there's no endpoint for it yet.
3. **No Contact Enquiry model/endpoints.** The storefront's Contact page
   form has nowhere real to submit to; the admin's Contact Enquiries page is
   an honest "not available yet" placeholder rather than fabricated data.
4. **No Newsletter Subscriber model/endpoints.** Same treatment — placeholder
   page, not fake subscriber rows.
5. **No in-app Razorpay/SMTP/WhatsApp key management.** The Settings page's
   "Environment" tab can only show presence/absence of each credential
   (that's all the backend's `/admin/settings/environment-status` exposes) —
   actual key values are set via the server's `.env`, and there's no
   endpoint to change that from the UI.
6. **"Current City" / "Language" fields on the Kundli/consultation booking
   form** aren't stored as first-class fields anywhere in
   `ConsultationBooking` — they're folded into `customerNotes` as free text
   so nothing the user types is silently dropped, but they're not
   individually queryable/reportable on the backend today.
7. **`getSalesChart` only accepts `range=7` or `range=30`**, not an arbitrary
   month count — the admin dashboard's monthly-revenue widget uses
   `GET /admin/dashboard/monthly-revenue` for longer trends instead.

## Bugs caught by cross-checking real backend responses (fixed before delivery)

- Product form used `isFeatured`/`isTrending` — the real schema field is
  `featured` (Boolean), and "trending" isn't admin-settable at all; it's
  computed from view counts. Fixed to match reality.
- Admin dashboard's sales chart assumed a `{ data: [{ date, total }] }`
  shape; the backend actually returns `{ range, salesData: [{ _id,
  totalSales, orderCount }] }`. Fixed the mapping rather than the backend.

## Architecture notes

- Both apps share the same auth pattern: Axios instance with automatic
  refresh-token retry via the backend's httpOnly cookie rotation
  (`POST /auth/refresh-token`), Redux Toolkit for the access token + user
  (persisted to `localStorage`; the refresh token itself never touches JS),
  React Query for all server state.
- Every API call lives in `src/api/endpoints/*.js`, one file per backend
  module, with a comment above each function naming the exact backend route
  it calls — use these as the map back to `API_DOCUMENTATION.md` from the
  earlier documentation pass.
- Lazy-loaded routes throughout (`React.lazy` + `Suspense`) for code-splitting.
