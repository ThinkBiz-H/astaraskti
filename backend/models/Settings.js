const mongoose = require('mongoose');

/**
 * Singleton document — exactly one Settings row ever exists (enforced by
 * services/settings.service.js always operating on the same fixed id, not
 * by a unique index on a real field). Use SettingsService.getSettings() /
 * updateSettings(), not the model directly, so that invariant holds.
 *
 * IMPORTANT — what does NOT live here: actual API credentials (SMTP
 * password, Razorpay key secret, Shiprocket password, Cloudinary secret,
 * JWT secrets). Those remain env-only, matching how every other phase in
 * this codebase already treats credentials ("MUST remain server-side",
 * never hardcoded, never admin-editable over an API — an admin-editable
 * secrets API is a strictly bigger attack surface than an env var that
 * needs a deploy to change). What DOES live here: business-configurable,
 * non-secret settings, and boolean feature/integration toggles the admin
 * can flip without a deploy. `GET /admin/settings/environment-status`
 * (see settings.service.js) reports whether the underlying env credentials
 * are PRESENT, as booleans only, never their values.
 */
const settingsSchema = new mongoose.Schema(
  {
    general: {
      siteName: { type: String, default: 'My Store' },
      siteTagline: { type: String, default: '' },
      supportEmail: { type: String, default: '' },
      supportPhone: { type: String, default: '' },
      timezone: { type: String, default: 'Asia/Kolkata' },
    },

    store: {
      legalName: { type: String, default: '' },
      gstNumber: { type: String, default: '' },
      address: {
        line1: { type: String, default: '' },
        line2: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        country: { type: String, default: 'India' },
        pincode: { type: String, default: '' },
      },
    },

    currency: {
      code: { type: String, default: 'INR' },
      symbol: { type: String, default: '₹' },
      position: { type: String, enum: ['before', 'after'], default: 'before' },
    },

    tax: {
      gstEnabled: { type: Boolean, default: true },
      defaultTaxPercent: { type: Number, default: 0, min: 0, max: 100 },
      pricesIncludeTax: { type: Boolean, default: true },
    },

    invoice: {
      prefix: { type: String, default: 'INV-' },
      startingNumber: { type: Number, default: 1001 },
      termsAndConditions: { type: String, default: '' },
      footerNote: { type: String, default: '' },
    },

    inventory: {
      lowStockThreshold: { type: Number, default: 10, min: 0 },
      criticalStockThreshold: { type: Number, default: 3, min: 0 },
    },

    // Non-secret, admin-facing toggles for each integration — independent
    // of (and does not override) the existing env-based gates already used
    // inside e.g. shiprocket.service.js (SHIPROCKET_ENABLED). This lets an
    // admin communicate "we're not taking online payments today" to the
    // storefront without touching env vars/redeploying, while the actual
    // service-level gate remains authoritative for whether the integration
    // code path itself runs.
    integrations: {
      emailEnabled: { type: Boolean, default: true },
      smsEnabled: { type: Boolean, default: true },
      razorpayEnabled: { type: Boolean, default: true },
      shiprocketEnabled: { type: Boolean, default: true },
    },

    seo: {
      defaultMetaTitle: { type: String, default: '' },
      defaultMetaDescription: { type: String, default: '' },
      defaultOgImage: { type: String, default: '' },
      googleAnalyticsId: { type: String, default: '' },
      googleSiteVerification: { type: String, default: '' },
      facebookPixelId: { type: String, default: '' },
    },

    social: {
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      twitter: { type: String, default: '' },
      youtube: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      pinterest: { type: String, default: '' },
      whatsapp: { type: String, default: '' },
    },

    contact: {
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      whatsapp: { type: String, default: '' },
      address: { type: String, default: '' },
    },

    maintenanceMode: {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: 'We are currently performing scheduled maintenance. Please check back soon.' },
      allowedIPs: [{ type: String }], // IPs that bypass the block (e.g. office/admin IP)
    },

    // Arbitrary admin-controlled on/off flags for features not otherwise
    // modeled (e.g. "reviewsEnabled", "wishlistEnabled") — a Map so new
    // flags never require a schema change.
    featureFlags: { type: Map, of: Boolean, default: {} },

    logo: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
    favicon: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
