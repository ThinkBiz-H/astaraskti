const mongoose = require("mongoose");

/**
 * Singleton document — exactly one row ever exists, same pattern as
 * models/Settings.js (enforced by services/premiumKundliSettings.service.js
 * always operating on the same document, not a unique index on a real
 * field). Price/content shown on the home page card and purchase flow is
 * read from here only — never hardcoded.
 */
const premiumKundliSettingsSchema = new mongoose.Schema(
  {
    isActive: { type: Boolean, default: true }, // on by default — the /kundli page must never show "not available" out of the box
    title: { type: String, default: "Premium AI Kundli" },
    subtitle: { type: String, default: "" },
    description: { type: String, default: "" },
    banner: { url: { type: String, default: "" }, publicId: { type: String, default: "" } },
    thumbnail: { url: { type: String, default: "" }, publicId: { type: String, default: "" } },
    features: [{ type: String, trim: true }],
    originalPrice: { type: Number, min: 0, default: 999 }, // placeholder — an admin should set the real price via Admin > Premium Kundli Settings
    salePrice: { type: Number, min: 0, default: null },
    gstPercent: { type: Number, min: 0, max: 100, default: 0 },
    deliveryText: { type: String, default: "" },
    buttonText: { type: String, default: "Get Premium Kundli" },
    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      canonicalUrl: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PremiumKundliSettings", premiumKundliSettingsSchema);
