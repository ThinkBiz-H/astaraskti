const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const settingsService = require('../services/settings.service');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinary.service');
const { invalidate } = require('../services/cache.service');

// @desc    Public-safe subset of settings, for the storefront (branding,
//          currency, tax display, contact/social, maintenance banner).
//          Explicit allow-list, not a deny-list — anything not listed here
//          is admin-only by default, which is the safer failure mode.
// @route   GET /api/v1/settings
// @access  Public
const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings();
  const s = settings.toObject();

  const publicSettings = {
    general: s.general,
    currency: s.currency,
    tax: { defaultTaxPercent: s.tax.defaultTaxPercent, pricesIncludeTax: s.tax.pricesIncludeTax },
    seo: s.seo,
    social: s.social,
    contact: s.contact,
    integrations: s.integrations,
    featureFlags: Object.fromEntries(s.featureFlags || []),
    logo: s.logo,
    favicon: s.favicon,
    maintenanceMode: { enabled: s.maintenanceMode.enabled, message: s.maintenanceMode.message },
  };

  sendResponse(res, 200, { settings: publicSettings }, 'Settings fetched successfully');
});

// @desc    Full settings document (admin)
// @route   GET /api/v1/admin/settings
// @access  Private/Admin
const getAllSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings();
  sendResponse(res, 200, { settings }, 'Settings fetched successfully');
});

// @desc    Update settings — partial, section-by-section (deep-merged per section)
// @route   PUT /api/v1/admin/settings
// @access  Private/Admin
const updateSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body, req.user._id);
  await invalidate('settings:*');
  sendResponse(res, 200, { settings }, 'Settings updated successfully');
});

// @desc    Upload/replace the site logo
// @route   PUT /api/v1/admin/settings/logo
// @access  Private/Admin
const updateLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'An image file is required');

  const settings = await settingsService.getSettings({ bypassCache: true });
  if (settings.logo?.publicId) await deleteFromCloudinary(settings.logo.publicId);

  const result = await uploadToCloudinary(req.file.buffer, 'ecommerce/branding');
  settings.logo = { url: result.url, publicId: result.publicId };
  settings.updatedBy = req.user._id;
  await settings.save();

  await invalidate('settings:*');
  sendResponse(res, 200, { logo: settings.logo }, 'Logo updated successfully');
});

// @desc    Upload/replace the site favicon
// @route   PUT /api/v1/admin/settings/favicon
// @access  Private/Admin
const updateFavicon = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'An image file is required');

  const settings = await settingsService.getSettings({ bypassCache: true });
  if (settings.favicon?.publicId) await deleteFromCloudinary(settings.favicon.publicId);

  const result = await uploadToCloudinary(req.file.buffer, 'ecommerce/branding');
  settings.favicon = { url: result.url, publicId: result.publicId };
  settings.updatedBy = req.user._id;
  await settings.save();

  await invalidate('settings:*');
  sendResponse(res, 200, { favicon: settings.favicon }, 'Favicon updated successfully');
});

// @desc    Environment/credential readiness check — presence booleans only,
//          never the actual secret values.
// @route   GET /api/v1/admin/settings/environment-status
// @access  Private/Admin
const getEnvironmentStatus = asyncHandler(async (req, res) => {
  sendResponse(res, 200, { environment: settingsService.getEnvironmentStatus() }, 'Environment status fetched successfully');
});

module.exports = {
  getPublicSettings,
  getAllSettings,
  updateSettings,
  updateLogo,
  updateFavicon,
  getEnvironmentStatus,
};
