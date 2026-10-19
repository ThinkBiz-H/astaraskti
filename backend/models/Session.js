const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * One document per active login (device/browser). Previously this codebase
 * stored a single `refreshToken` string directly on User — logging in on a
 * second device silently invalidated the first. This is what makes
 * "device sessions" / "active sessions" / "logout this device only" /
 * "logout everywhere" real rather than cosmetic.
 *
 * The refresh token itself is never stored in plaintext — only its SHA-256
 * hash, same hashing approach already used elsewhere in this codebase for
 * OTPs and password-reset tokens (see User.generateOtpCode /
 * generateResetPasswordToken), so a database read alone can't be used to
 * impersonate a session.
 */
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshTokenHash: { type: String, required: true, select: false },

    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    deviceLabel: { type: String, default: '' }, // e.g. "Chrome on Windows" — best-effort, parsed from userAgent

    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Mongo TTL — auto-cleans expired sessions
sessionSchema.index({ user: 1, revokedAt: 1 });

sessionSchema.statics.hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = mongoose.model('Session', sessionSchema);
