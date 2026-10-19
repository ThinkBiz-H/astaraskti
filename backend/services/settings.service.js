const Settings = require('../models/Settings');

let cache = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 10_000; // maintenance-mode / general reads happen on every request path that uses them — a short cache avoids a DB round-trip per request without meaningfully delaying a config change taking effect

/** Always returns the single Settings document, creating it with defaults on first use. */
const getSettings = async ({ bypassCache = false } = {}) => {
  if (!bypassCache && cache && Date.now() < cacheExpiresAt) return cache;

  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }

  cache = settings;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return settings;
};

const updateSettings = async (patch, userId) => {
  const settings = await getSettings({ bypassCache: true });

  // Deep-merge one level into each known sub-object so a partial update
  // (e.g. just { general: { siteName: "New Name" } }) doesn't wipe out the
  // rest of that section's fields.
  Object.keys(patch).forEach((key) => {
    if (key === 'featureFlags' && patch.featureFlags) {
      Object.entries(patch.featureFlags).forEach(([flag, value]) => settings.featureFlags.set(flag, !!value));
    } else if (settings[key] && typeof settings[key] === 'object' && !Array.isArray(settings[key]) && typeof patch[key] === 'object') {
      settings[key] = { ...settings[key].toObject?.() ?? settings[key], ...patch[key] };
    } else {
      settings[key] = patch[key];
    }
  });

  settings.updatedBy = userId;
  await settings.save();

  cache = settings;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return settings;
};

/**
 * Reports whether each integration's underlying env credentials are
 * PRESENT — booleans only, values are never read into the response. This
 * is the "Environment Validation" feature: lets an admin see at a glance
 * "SMTP: not configured" without exposing what's actually in .env.
 */
const getEnvironmentStatus = () => ({
  jwt: {
    configured: !!(process.env.JWT_ACCESS_SECRET && process.env.JWT_REFRESH_SECRET),
  },
  database: { configured: !!process.env.MONGO_URI },
  email: {
    configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  },
  sms: {
    configured: !!process.env.SMS_PROVIDER,
    provider: process.env.SMS_PROVIDER || null, // provider NAME is not a secret, safe to expose
  },
  cloudinary: {
    configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
  },
  razorpay: {
    configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  },
  shiprocket: {
    configured: !!(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD),
    enabled: process.env.SHIPROCKET_ENABLED === 'true',
  },
});

const isMaintenanceModeActive = async () => {
  const settings = await getSettings();
  return !!settings.maintenanceMode?.enabled;
};

module.exports = { getSettings, updateSettings, getEnvironmentStatus, isMaintenanceModeActive };
