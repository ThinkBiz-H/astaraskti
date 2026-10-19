const ApiError = require('../utils/ApiError');

/**
 * The full catalog of grantable permissions. Not a separate collection —
 * deliberately just a fixed list, since these map 1:1 to admin-panel
 * feature areas and adding a new one is a code change anyway (a new route
 * group), not something an admin would define dynamically.
 */
const PERMISSIONS = [
  'manage_products',
  'manage_categories',
  'manage_orders',
  'manage_coupons',
  'manage_inventory',
  'manage_cms',
  'manage_blog',
  'manage_media',
  'manage_settings',
  'manage_users',
  'view_reports',
  'manage_notifications',
  'manage_consultations',
];

/**
 * Runs AFTER authorize('admin') (see routes/admin.routes.js) as an
 * additional, optional finer-grained check — it does not replace the role
 * check, it narrows it. An admin with no `permissions` set (every existing
 * admin, today) passes every check here, same as before this middleware
 * existed. Only an admin explicitly restricted to a specific permission
 * list can be blocked by this.
 */
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authenticated'));
  if (req.user.role !== 'admin') return next(new ApiError(403, 'Admin access required'));

  const hasRestrictions = Array.isArray(req.user.permissions) && req.user.permissions.length > 0;
  if (!hasRestrictions) return next(); // unrestricted admin — full access, unchanged from before this feature

  if (!req.user.permissions.includes(permission)) {
    return next(new ApiError(403, `Missing required permission: ${permission}`));
  }
  next();
};

module.exports = { PERMISSIONS, requirePermission };
