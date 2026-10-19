# Changelog — Phase 15 (Settings)

Status: **Complete and load-verified.**

## Added
- `models/Settings.js` — singleton document: `general`, `store`, `currency`,
  `tax`, `invoice`, `integrations` (non-secret enable/disable toggles),
  `seo`, `social`, `contact`, `maintenanceMode`, `featureFlags` (dynamic
  Map), `logo`, `favicon`
- `services/settings.service.js` — singleton get/create-on-first-use,
  section-aware deep-merge update, 10s in-process cache, environment
  presence-check (`getEnvironmentStatus()`)
- `middlewares/maintenance.middleware.js` — real, wired 503 gate for
  storefront routes when `maintenanceMode.enabled` is true; IP allow-list
- `GET /settings` (public, explicit allow-list response),
  `GET/PUT /admin/settings`, `PUT /admin/settings/logo`,
  `PUT /admin/settings/favicon`, `GET /admin/settings/environment-status`
- `seed/settingsSeeder.js`

## Security design decision (not a gap — deliberate)
Actual credentials (SMTP password, Razorpay/Shiprocket/Cloudinary secrets,
JWT secrets) are **not** stored in Settings and are **not** admin-editable
via any API — they remain env-only. An admin-editable secrets API is a
strictly larger attack surface than an env var that requires a deploy to
rotate. `environment-status` reports presence only (booleans), never values.

## routes/index.js — reordered (behavior-preserving)
`/auth`, `/admin`, `/webhooks`, `/warehouses`, `/inventory` are now mounted
*before* the new maintenance-mode gate; every other route group is mounted
*after* it. This is a reordering of existing `router.use()` calls, not a
change to any of their internal logic — verified structurally (see
verification log) that every previously-existing route still resolves to
the same handler it did before.

## Not a conflict with existing behavior
`integrations.shiprocketEnabled` (new, DB-stored) is intentionally separate
from `SHIPROCKET_ENABLED` (existing, env-based, checked inside
`shiprocket.service.js`) — the new toggle does not read, write, or
override the existing one.

---

## Phase 16 (Notifications), 17 (Reports), 18 (Security) — status, not attempted this pass

Checked against the actual codebase before writing anything (same
discipline as the Phase 7–9/14 discovery):

- **Phase 16 blocked on a real dependency:** the spec requires wiring
  notifications into the Blog module, which does not exist (Phase 11 was
  never actually built — see the correction given at the start of this
  turn). Email/SMS/OTP/order notifications already exist from earlier
  phases; only the Blog-specific wiring is blocked.
- **Phase 17 partially exists:** `report.controller.js` already has Sales,
  Revenue, Orders, Customers, and Products CSV reports with date filters.
  Missing: Inventory reports, Coupon reports, Tax reports, and Excel export
  (no `xlsx`/`exceljs` dependency present).
- **Phase 18 substantially exists:** Helmet and rate limiting are already
  wired in `app.js`; `LoginHistory` (Phase 7) already covers login-attempt
  auditing. Missing: a general admin-action audit log (broader than login),
  and granular role/permission middleware (today's authorization is a
  binary `admin`/`user` role check, not per-permission).
