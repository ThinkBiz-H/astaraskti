const { getSettings } = require('../services/settings.service');
const { sendResponse } = require('../utils/ApiResponse');

/**
 * Mounted only on the public-facing router (see routes/index.js) — auth,
 * admin, and webhook routes are registered separately and untouched by
 * this, so an admin can always still log in and flip maintenanceMode back
 * off, and payment/Shiprocket webhooks are never dropped mid-maintenance.
 */
const maintenanceMode = async (req, res, next) => {
  try {
    const settings = await getSettings();
    if (!settings.maintenanceMode?.enabled) return next();

    const ip = req.ip || req.connection?.remoteAddress;
    if (settings.maintenanceMode.allowedIPs?.includes(ip)) return next();

    return sendResponse(res, 503, { maintenance: true }, settings.maintenanceMode.message || 'Service temporarily unavailable for maintenance.');
  } catch (err) {
    // Never let a settings-lookup failure take the whole storefront down.
    return next();
  }
};

module.exports = maintenanceMode;
