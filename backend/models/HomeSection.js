const mongoose = require('mongoose');

/**
 * A flexible, unordered-count homepage building block. `type` is a free
 * string (not a fixed enum) — "hero", "banner", "featured_products",
 * "categories", "promo", "text", "image", "cta", or anything else the admin
 * (and frontend) agree on later, without a backend code change. `config`
 * carries whatever section-type-specific extra data the frontend needs
 * (e.g. a list of slides for a carousel-type hero, a category id for a
 * "featured category" block) without needing a new field/model per type.
 */
const homeSectionSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    content: { type: String, default: '' },
    image: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    // Optional separate crop/asset for small viewports — falls back to
    // `image` on the frontend when not set.
    mobileImage: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    backgroundColor: { type: String, default: '' },
    textColor: { type: String, default: '' },
    button: {
      label: { type: String, default: '' },
      link: { type: String, default: '' },
    },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

homeSectionSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('HomeSection', homeSectionSchema);
