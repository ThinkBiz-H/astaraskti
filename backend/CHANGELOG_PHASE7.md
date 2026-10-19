# Changelog — Phase 7 (OTP Authentication)

Status: **Complete.** The OTP generation/hashing/expiry/cooldown/attempt-limit
logic and JWT/session mechanics are fully real and load-verified; actual SMS
delivery is unverified against a live provider (none reachable from this
environment) — see `services/sms.service.js`.

## Added
- `models/Session.js` — per-device session (hashed refresh token, device
  label, IP, expiry, revocation) — **replaces** the old single
  `User.refreshToken` field as the source of truth for refresh-token
  validation (field left in the schema, unused, for now)
- `models/LoginHistory.js` — append-only login attempt audit trail
- `services/sms.service.js` — pluggable SMS provider abstraction (console
  fallback when `SMS_PROVIDER` is unset)
- `services/otp.service.js` — mobile OTP send (with cooldown) / verify
  (with attempt lockout)
- `services/session.service.js` — create/validate/rotate/revoke sessions,
  login history
- `User` model: `isMobileVerified`, `mobileOtp`, `mobileOtpExpire`,
  `mobileOtpAttempts`, `mobileOtpLastSentAt`, `generateMobileOtpCode()`
- 9 new auth endpoints: `POST /auth/mobile/{register,login,verify,resend-otp}`,
  `POST /auth/logout-all`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`,
  `GET /auth/login-history`
- `otpLimiter` — dedicated, stricter rate limiter for OTP request/resend
  endpoints (`middlewares/rateLimiter.middleware.js`)
- `OTP_EXPIRY_MINUTES`, `OTP_RESEND_COOLDOWN_SECONDS`, `OTP_MAX_ATTEMPTS`,
  `SMS_PROVIDER` env vars

## Changed (backward compatible)
- `login`/`logout`/`refresh-token` now operate on `Session` documents
  instead of the single `user.refreshToken` field — **request/response
  shapes are unchanged**, this is purely internal
- `refresh-token` now **rotates** the refresh token on every use (previously
  reused the same one until expiry)
- `reset-password` now revokes every active session for the account
- Fixed a pre-existing bug: `.env.example` documented separate
  `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, but the code only ever read a
  single `JWT_SECRET`. Now uses the split secrets when set, falling back to
  `JWT_SECRET` — any deployment that only has `JWT_SECRET` configured keeps
  working exactly as before.
- `protect` middleware now also sets `req.sessionId` (from the JWT's `sid`
  claim) — additive, existing usage of `req.user` unaffected

## Breaking changes
- `User.mobile` is now `unique` (previously unindexed) — see
  `DATABASE_MIGRATION_NOTES.md` for a required pre-migration duplicate check
- `User.email` is now optional (was required) — enables mobile-only
  accounts; existing email/password registration still requires it via
  `registerValidator`, unchanged
- `User.password` is no longer required at the schema level (was required)
  — same reasoning; existing register/login validators are unchanged

## Explicitly not done
- Existing email/password + email-OTP-verification flow was **not**
  removed, per "do not unnecessarily break existing auth" — both
  mechanisms coexist
- SMS delivery is not connected to a live provider (no credentials
  available in this environment) — see `services/sms.service.js` for how
  to wire one up
