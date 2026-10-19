const mongoose = require('mongoose');

/**
 * Historical audit trail of login attempts — distinct from Session (which
 * only tracks currently-active logins and gets deleted on logout/expiry).
 * This is intentionally append-only and never modified after creation.
 */
const loginHistorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // null when the attempt failed before identifying a real user (e.g. unknown mobile)
    method: { type: String, enum: ['password', 'mobile_otp', 'email_otp'], required: true },
    success: { type: Boolean, required: true },
    reason: { type: String, default: '' }, // e.g. "invalid_otp", "account_deactivated" — only set on failure
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

loginHistorySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('LoginHistory', loginHistorySchema);
