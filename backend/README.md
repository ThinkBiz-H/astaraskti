# E-Commerce Backend API

A production-ready, scalable, and secure E-Commerce backend REST API built with **Node.js**, **Express.js**, and **MongoDB (Mongoose)**.

## Features

- **Authentication**: Register/login via email+password OR mobile OTP, JWT access tokens + rotating refresh tokens, per-device sessions with login history, logout single/all devices, forgot/reset/change password, secure httpOnly cookies
- **User Management**: Profile updates, profile image upload (Cloudinary), multiple addresses, account deletion
- **Catalog**: Unlimited-depth nested Categories with per-category dynamic attribute templates (inherited down the tree), Brands, dynamic Units of measure (admin-managed, decimal-capable), Products (multi-image upload, soft delete/restore, SEO fields, dynamic attributes, related/cross-sell/up-sell, weight/dimensions/shipping class), and a full Variant engine (own SKU/price/stock/images per variant)
- **Discovery**: Full-text search, filtering (price/rating/category — including all subcategories/brand/availability), sorting, pagination, related products, featured products, new arrivals, best sellers, trending, top rated
- **Shopping**: Wishlist, Cart (variant-aware add/update/remove/clear), Coupons (percentage/flat, usage limits, expiry)
- **Orders**: Full order lifecycle with enforced status transitions (Pending → Confirmed → Packed → Shipped → Out For Delivery → Delivered, plus Cancelled/Returned/Refunded), PDF invoices, courier tracking, delivery attempt tracking, variant-aware stock management
- **Inventory**: Multi-warehouse stock (available/reserved/damaged/incoming per product-or-variant per warehouse), purchase/adjust/transfer/reserve/release operations, an immutable stock-movement audit ledger, low-stock/out-of-stock detection with admin notifications, Product/Variant stock kept as a synced aggregate for full backward compatibility with Cart/Checkout
- **Shipping**: Optional Shiprocket integration (shipment creation, AWB assignment, pickup requests, label generation, live tracking, webhook sync) — falls back to manual courier fields when disabled
- **Payments**: Razorpay integration (order creation + signature verification) and Cash on Delivery
- **Reviews**: Verified-purchase-only reviews with ratings and images
- **Content**: Full CMS (dynamic pages, homepage sections, FAQs), a Blog module (categories, tags, SEO, draft/scheduled/published with auto-publish, related posts), and a Media Manager (folders, bulk upload, replace-in-place, Cloudinary optimization)
- **SEO**: Dynamic sitemap.xml and robots.txt, per-product/page meta fields
- **Settings**: Store-wide configuration (currency, tax, invoice, SEO defaults, social/contact, integration toggles) with a working maintenance-mode gate — credentials always stay env-only, never admin-editable
- **Notifications**: Multi-channel (in-app/email/SMS/push) with an admin-editable template manager, a retrying delivery queue, and admin broadcast
- **Reports**: Sales/revenue/orders/customers/products/inventory/coupons/tax/profit, exportable as CSV or Excel
- **Admin Panel APIs**: Dashboard statistics, sales charts, top products, low-stock alerts (product- and variant-level), warehouse/inventory management, user management
- **Security**: Helmet (explicit hardened config), rate limiting, account lockout after repeated failed logins, an admin-action audit log, granular per-admin permissions (opt-in, backward compatible), Mongo sanitize, XSS protection, HPP, bcrypt password hashing + policy, role-based authorization
- **Performance**: Optional Redis-backed API caching with real invalidation (graceful no-op fallback without Redis), in-memory request/error metrics at `/metrics`, scheduled background jobs (queue processing, scheduled publishing, retention cleanup)
- **API Docs**: Interactive Swagger UI at `/api-docs` for core flows; `docs/API.md` for the complete reference
- **Quality**: Centralized error handling with request-id correlation, structured logging, consistent response format, MVC + service-layer architecture, MongoDB transactions for atomic stock operations (replica-set deployments)

## Tech Stack

Node.js, Express.js, MongoDB, Mongoose, JWT, bcryptjs, Multer, Cloudinary, Nodemailer, Razorpay, Shiprocket (optional), pdfkit, axios, express-validator, Helmet, CORS, Morgan, compression, cookie-parser, dotenv, uuid, slugify

## Project Structure

```
backend/
├── config/          # DB, Cloudinary, Razorpay, Mailer configuration
├── controllers/      # Route handler logic
├── middlewares/       # Auth, error handling, validation, upload, rate limiting
├── models/           # Mongoose schemas
├── routes/           # Express route definitions
├── services/          # Business logic (cloudinary, order calculations, category tree/attribute inheritance, inventory/warehouse ledger)
├── utils/             # Helpers (logger, ApiError, ApiResponse, tokens, email, etc.)
├── validators/        # express-validator chains
├── uploads/           # Local upload scratch directory
├── public/            # Static assets
├── logs/              # Log files (combined.log, error.log)
├── seed/              # Database seeders
├── docs/               # API documentation
├── app.js             # Express app configuration
├── server.js           # Entry point
├── package.json
└── .env.example
```

## Getting Started

### Prerequisites

- Node.js >= 18
- MongoDB (local or Atlas)
- Cloudinary account (for image uploads)
- SMTP credentials (Gmail app password or any SMTP provider)
- Razorpay account (test mode keys are fine for development)

### Installation

```bash
# 1. Extract the project and move into it
cd backend

# 2. Install dependencies
npm install

# 3. Copy the example environment file and fill in your values
cp .env.example .env

# 4. (Optional) Seed the database with an admin user, categories, brands, and sample products
npm run seed

# 5. Start the development server (auto-restarts on changes)
npm run dev

# Or start in production mode
npm start
```

The API will be available at `http://localhost:5000` (or whatever `PORT` you set in `.env`).

### Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Secrets for signing JWTs |
| `CLOUDINARY_*` | Cloudinary credentials for image storage |
| `SMTP_*` | Email provider credentials for OTP/notification emails |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay API credentials |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credentials used by the admin seeder |

## Response Format

Every endpoint returns a consistent JSON shape:

```json
{
  "success": true,
  "message": "Descriptive message",
  "data": {},
  "error": null
}
```

## Authentication Flow

Two independent flows coexist — neither changes how the other works.

**Email + password** (existing):
1. `POST /api/v1/auth/register` → creates account, sends OTP email
2. `POST /api/v1/auth/verify-otp` → verifies account with OTP
3. `POST /api/v1/auth/login` → returns `accessToken` (in response body) + sets `refreshToken` httpOnly cookie
4. Send `Authorization: Bearer <accessToken>` header on subsequent requests
5. `POST /api/v1/auth/refresh-token` → rotates and returns a new access token (Phase 7: the refresh token itself also rotates)

**Mobile OTP** (Phase 7, no password):
1. `POST /api/v1/auth/mobile/register` (new account) or `POST /api/v1/auth/mobile/login` (existing account) → sends OTP to the mobile number
2. `POST /api/v1/auth/mobile/verify` → same response shape as step 3 above (`accessToken` + refresh cookie)
3. Same as steps 4–5 above from here on — both flows produce identical tokens/sessions

Every login, on either flow, creates a `Session` document (Phase 7) —
`GET /api/v1/auth/sessions` lists a user's active devices,
`DELETE /api/v1/auth/sessions/:id` or `POST /api/v1/auth/logout-all` revoke
them.

See `docs/API.md` for the full endpoint reference with example requests/responses.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start server with nodemon (auto-reload) |
| `npm start` | Start server in production mode |
| `npm run seed` | Seed admin user, category hierarchy, brands, units, default warehouse, and sample products (with variants) |
| `npm run build` | No-op (plain Node.js project, nothing to compile) |

## Security Notes

- Passwords are hashed with bcrypt before storage.
- Access tokens are short-lived (15m default); refresh tokens are long-lived (30d default) and stored as httpOnly cookies.
- All admin-only routes are protected by role-based authorization middleware.
- Input is sanitized against NoSQL injection and XSS on every request.
- Sensitive fields (`password`, `refreshToken`, OTP hashes, reset tokens) are excluded from query results by default (`select: false`) and never returned in API responses.

## License

MIT
