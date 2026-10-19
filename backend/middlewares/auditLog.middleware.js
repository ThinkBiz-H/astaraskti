const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

const REDACTED_FIELDS = ['password', 'newPassword', 'currentPassword', 'token', 'accessToken', 'refreshToken', 'otp', 'secret'];

const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return {};
  const clean = { ...body };
  REDACTED_FIELDS.forEach((field) => {
    if (field in clean) clean[field] = '[REDACTED]';
  });
  return clean;
};

/**
 * Mounted once on the admin router (see routes/admin.routes.js), applies
 * to every request that reaches it. Only WRITES are logged (GET requests —
 * dashboard views, report pulls, list screens — would drown the log in
 * noise for no security value); this is what actually changed something.
 * Logging happens after the response is sent (via res.on('finish')) so it
 * never adds latency to the admin's request, and a logging failure can
 * never break the request it's describing.
 */
const auditLog = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  res.on('finish', () => {
    if (!req.user) return; // shouldn't happen on an authenticated admin route, but never let this throw
    AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      method: req.method,
      route: req.originalUrl,
      params: req.params,
      body: sanitizeBody(req.body),
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
    }).catch((err) => logger.error(`Audit log write failed (non-fatal): ${err.message}`));
  });

  next();
};

module.exports = auditLog;
