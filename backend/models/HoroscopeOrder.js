const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// Mirrors models/PremiumKundliOrder.js's shape exactly — see that file for
// the full rationale on each field. This is a separate collection (not a
// shared one) so Horoscope orders/report lifecycle never touch Kundli data.
const PAYMENT_STATUSES = ["Pending", "Paid", "Failed"];
const REPORT_STATUSES = ["Pending", "Processing", "Generated", "Failed"];

const horoscopeOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      default: () => `PHO-${uuidv4().split("-")[0].toUpperCase()}`,
    },
    // Optional — guest checkout, same as Premium Kundli. Set only when the
    // buyer happens to be logged in.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Intake form
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    birthTime: { type: String, required: true }, // "HH:mm"
    birthPlace: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },

    // Payment — same Razorpay gateway abstraction as every other payment flow.
    amount: { type: Number, required: true, min: 0 },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "Pending" },

    // Generation lifecycle — driven by services/horoscope.service.js
    reportStatus: { type: String, enum: REPORT_STATUSES, default: "Pending" },
    pdfUrl: { type: String, default: null },
    pdfPublicId: { type: String, default: null },
    apiResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    // Resolved server-side from `birthPlace` via geocoding.service.js (or
    // supplied pre-resolved by the frontend's pre-payment place check).
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

horoscopeOrderSchema.index({ user: 1, createdAt: -1 });
horoscopeOrderSchema.index({ paymentStatus: 1 });
horoscopeOrderSchema.index({ reportStatus: 1 });

module.exports = mongoose.model("HoroscopeOrder", horoscopeOrderSchema);
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
module.exports.REPORT_STATUSES = REPORT_STATUSES;
