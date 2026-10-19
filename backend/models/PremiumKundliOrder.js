const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// `paymentStatus` is owned entirely by the Razorpay verify step (mirrors
// ConsultationBooking.PAYMENT_STATUSES' Pending/Paid/Failed exactly).
// `kundliStatus` is the separate lifecycle the placeholder generation
// service (and, later, the real external API) drives forward — this is
// "the future API will update this status" field from the spec.
const PAYMENT_STATUSES = ["Pending", "Paid", "Failed"];
const KUNDLI_STATUSES = ["Pending", "Processing", "Generated", "Failed"];

const premiumKundliOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      default: () => `PKO-${uuidv4().split("-")[0].toUpperCase()}`,
    },
    // Optional — this is a full guest-checkout flow (no login/OTP required
    // at all). When the buyer happens to be logged in, this is set so it
    // shows up in their "My Premium Kundli" dashboard; for a true guest
    // it stays null and the order is identified purely by fullName/email/
    // mobile below, exactly like a guest e-commerce order.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Intake form (PART 3)
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    birthTime: { type: String, required: true }, // "HH:mm"
    birthPlace: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },

    // Payment (PART 4/6) — same gateway abstraction as every other payment flow.
    amount: { type: Number, required: true, min: 0 },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "Pending" },

    // Generation lifecycle (PART 5/7) — driven by services/kundliGeneration.service.js
    kundliStatus: { type: String, enum: KUNDLI_STATUSES, default: "Pending" },
    pdfUrl: { type: String, default: null },
    pdfPublicId: { type: String, default: null },
    // Raw response from AstrologyAPI — the "JSON path" the spec describes:
    // stored as-is so a PDF renderer can be built against it later without
    // ever needing to change the checkout flow or re-call the API.
    apiResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    // Resolved server-side from `birthPlace` via geocoding.service.js — the
    // customer never enters these directly (keeps the intake form/checkout
    // flow unchanged), but a real astrology API needs them alongside DOB/time.
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    timezoneOffset: { type: Number, default: null }, // decimal UTC offset, e.g. 5.5 for IST
    generationError: { type: String, default: null },

    statusHistory: [
      {
        status: { type: String },
        note: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],

    adminNotes: { type: String, default: "" },
  },
  { timestamps: true },
);

premiumKundliOrderSchema.index({ user: 1, createdAt: -1 });
premiumKundliOrderSchema.index({ paymentStatus: 1 });
premiumKundliOrderSchema.index({ kundliStatus: 1 });

module.exports = mongoose.model("PremiumKundliOrder", premiumKundliOrderSchema);
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
module.exports.KUNDLI_STATUSES = KUNDLI_STATUSES;
