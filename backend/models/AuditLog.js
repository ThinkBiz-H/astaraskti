const mongoose = require('mongoose');

/**
 * Broader than LoginHistory (Phase 7, login attempts only) — this captures
 * every mutating admin action: who, what route, what method, what
 * params/body was sent, the resulting status code, from where, and when.
 * Populated by middlewares/auditLog.middleware.js automatically for every
 * /admin write request, not by hand-instrumenting each controller.
 */
const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, default: '' }, // snapshot — readable even if the user is later deleted
    method: { type: String, required: true },
    route: { type: String, required: true },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    body: { type: mongoose.Schema.Types.Mixed, default: {} }, // sanitized — see the middleware for the redaction list
    statusCode: { type: Number },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ route: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
