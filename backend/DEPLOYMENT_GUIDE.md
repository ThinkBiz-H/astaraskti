# Deployment Guide

## 1. Requirements

**Required:**
- Node.js 18+
- MongoDB — a **replica set** (MongoDB Atlas is one by default; self-hosted needs `mongod --replSet`) for the transactional stock operations in `services/inventory.service.js` to be atomic. A standalone MongoDB works — it just falls back to non-atomic sequential writes with a logged warning, which is fine for low-concurrency/dev use, not recommended for production.

**Optional (the app runs correctly without every one of these — see the fallback behavior for each):**
| Service | Used for | Fallback without it |
|---|---|---|
| Redis | API response caching (Phase 19) | Every cache read is a safe miss; app works identically, just without the speedup |
| SMTP (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`) | Order/account emails | `sendEmail` calls will fail — required for a real launch |
| SMS provider (`SMS_PROVIDER`) | OTP delivery, SMS notifications | Logs the OTP/message instead of sending — **fine for dev, not for production** (see below) |
| Push provider (`PUSH_PROVIDER`) | Push notifications | Logs instead of sending |
| Cloudinary | Image/media uploads | Uploads will fail — required for a real launch |
| Razorpay | Online payments | COD still works; online payment endpoints will fail without credentials |
| Shiprocket (`SHIPROCKET_ENABLED=true` + credentials) | Shipment creation/tracking | Manage shipping manually; `SHIPROCKET_ENABLED=false` is the safe default |

**Before going live**, confirm `SMS_PROVIDER` is actually configured — the
console-fallback (logging the OTP instead of sending it) is a development
convenience, not something to ship. Same for `PUSH_PROVIDER` if push
notifications matter to you at launch.

## 2. Install & configure

```bash
npm install
cp .env.example .env
# fill in .env — see .env.example's comments for every variable
```

Required `.env` values with no safe default: `MONGO_URI`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET` (generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
— use two DIFFERENT random values, not the same secret for both).

## 3. Seed initial data (first deploy only)

```bash
npm run seed
```

Creates: an admin user (from `ADMIN_*` env vars), sample categories/units/
brands/products, a default warehouse (with matching `WarehouseStock`
records so Phase 6 doesn't zero out seeded stock), standard CMS pages,
starter FAQs/home-sections, and default Settings. Safe to re-run — every
seeder checks for existing data first and skips if already present.

**Existing database, not a fresh one?** See `DATABASE_MIGRATION_NOTES.md`
— sections 1–7 cover Phases 1–7, section 8 confirms Phases 16–20 need no
backfill, but **Phase 6 (Inventory) does** if you're migrating a database
that predates it.

## 4. Run

```bash
npm start          # production
npm run dev         # development (nodemon auto-reload)
```

On boot: connects to MongoDB, starts the HTTP server, then starts the
in-process scheduler (notification queue processing every 30s, scheduled
blog publishing every 60s, retention cleanup every 6h/24h). Stops cleanly
on `SIGINT`.

## 5. Verify it's actually running correctly

```bash
curl http://localhost:5000/health    # liveness — memory, DB status, cache status
curl http://localhost:5000/ready     # readiness — 503 until MongoDB is connected
curl http://localhost:5000/metrics   # request counts, error rate, avg response time
```

Visit `/api-docs` for interactive API documentation (core flows); `docs/API.md`
for the complete reference.

## 6. Scaling beyond one instance

Two things in this codebase are explicitly single-instance-appropriate,
documented rather than hidden:

1. **The scheduler** (`services/scheduler.service.js`) — in-process
   `setInterval` timers. Multiple instances would each run their own timer
   and could double-process the same job. Move to a real broker (Bull/BullMQ
   + the Redis you'd already be running for caching) before running more
   than one instance.
2. **The notification queue processor** (`services/notificationQueue.service.js`)
   — same reasoning; it does atomically claim jobs within a single
   process (`findOneAndUpdate`), but that doesn't protect against a
   *second* process polling the same collection concurrently.

Everything else (the API itself) is stateless and horizontally scalable
as-is behind a load balancer.

## 7. Production checklist

- [ ] `NODE_ENV=production`
- [ ] MongoDB is a replica set (for atomic inventory transactions)
- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are distinct, random, and not the `.env.example` placeholders
- [ ] `SMS_PROVIDER` configured (or OTP delivery is just going to your server logs)
- [ ] `SMTP_*` configured (order confirmation / password reset emails)
- [ ] `REDIS_URL` set if you want caching to actually do anything
- [ ] `SHIPROCKET_ENABLED` + credentials set, or deliberately left `false` for manual shipping
- [ ] Reviewed `GET /admin/settings/environment-status` after deploy — confirms which integrations have credentials present, without exposing values
- [ ] `MAX_LOGIN_ATTEMPTS` / `LOCKOUT_DURATION_MINUTES` reviewed for your threat model
- [ ] Addressed (or consciously accepted) the pre-existing `nodemailer` vulnerabilities flagged in `npm audit` — see `CHANGELOG_FINAL.md`
- [ ] Log retention (`LOG_RETENTION_DAYS`, `AUDIT_LOG_RETENTION_DAYS`, `LOGIN_HISTORY_RETENTION_DAYS`) matches your compliance requirements
