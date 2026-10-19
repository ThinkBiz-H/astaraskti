const rateLimit = require("express-rate-limit");

const globalLimiter =
  process.env.NODE_ENV === "development"
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
      });

const authLimiter =
  process.env.NODE_ENV === "development"
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
      });

// Phase 7 — stricter IP-based backstop for OTP request/resend endpoints,
// on top of (not instead of) the per-account DB-tracked cooldown in
// services/otp.service.js. This limits OTP-bombing a single IP across many
// different mobile numbers, which the per-account cooldown alone can't.
const otpLimiter =
  process.env.NODE_ENV === "development"
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 8,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: "Too many OTP requests from this device. Try again later.", data: null },
      });

module.exports = { globalLimiter, authLimiter, otpLimiter };
