const mongoose = require("mongoose");
const slugify = require("slugify");

/**
 * Consultation Services module (astrology add-on).
 *
 * `type` drives which detail form the storefront shows at booking time and
 * which sub-document the booking stores (see models/ConsultationBooking.js).
 * `general` covers any future custom service an admin adds that doesn't need
 * one of the four specialised detail forms.
 */
const SERVICE_TYPES = [
  "kundli",
  // "horoscope" is the Premium Horoscope instant-report module (own
  // purchase flow, redirects to /horoscope) — distinct from
  // "horoscope_matching" (an appointment-based compatibility-matching
  // consultation). Keep these two apart; they are not interchangeable.
  "horoscope",
  "horoscope_matching",
  "gemstone",
  "vastu",
  "general",
];

// The consultation modes a service can be booked through — separate from
// ConsultationBooking.MEETING_MODES (the specific mode a customer picks
// for one booking); this is what the service declares it *supports*.
const CONSULTATION_MODES = ["phone", "video", "chat", "whatsapp", "email"];

const consultationServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },
    // Doubles as "Category" in the admin UI — deliberately not a second
    // category taxonomy alongside the one that already exists for products.
    type: {
      type: String,
      enum: SERVICE_TYPES,
      default: "general",
    },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, min: 0, default: null },
    gstPercent: { type: Number, min: 0, max: 100, default: 0 },
    // Duration of a single consultation slot, in minutes.
    duration: { type: Number, required: true, min: 1, default: 30 },
    modes: { type: [{ type: String, enum: CONSULTATION_MODES }], default: ["phone"] },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    banner: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    benefits: [{ type: String, trim: true }],
    preparationInstructions: { type: String, default: "" },
    faq: [
      {
        question: { type: String, trim: true, required: true },
        answer: { type: String, trim: true, required: true },
      },
    ],
    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      canonicalUrl: { type: String, default: "" },
    },
    featured: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    sortOrder: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Callback-style (`next`) middleware was removed in Mongoose 9 — this
// pattern made every validate() throw "next is not a function" (see
// PaymentTransaction.js for the same fix and full explanation).
consultationServiceSchema.pre("validate", function () {
  if (!this.slug && this.name) {
    this.slug = `${slugify(this.name, { lower: true, strict: true })}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
  }
});

consultationServiceSchema.index({ status: 1 });
consultationServiceSchema.index({ type: 1 });
consultationServiceSchema.index({ featured: 1 });
consultationServiceSchema.index({ trending: 1 });

consultationServiceSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isDeleted: false });
};

module.exports = mongoose.model("ConsultationService", consultationServiceSchema);
module.exports.SERVICE_TYPES = SERVICE_TYPES;
module.exports.CONSULTATION_MODES = CONSULTATION_MODES;
