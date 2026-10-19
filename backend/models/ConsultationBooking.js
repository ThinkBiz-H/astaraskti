const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { BOOKING_STATUSES } = require("../utils/consultationStatusMachine");

const MEETING_MODES = ["Phone Call", "WhatsApp", "Google Meet", "Zoom"];
const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded"];
const DELIVERABLE_TYPES = ["pdf", "image", "audio", "video"];

// -------- Kundli Reading --------
const kundliDetailsSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    dob: { type: Date, required: true },
    birthTime: { type: String, required: true }, // "HH:mm"
    birthPlace: { type: String, required: true, trim: true },
    // Optional — admin-facing triage fields for the Kundli Requests queue.
    language: { type: String, default: "" },
    priority: { type: String, enum: ["Normal", "High", "Urgent"], default: "Normal" },
  },
  { _id: false },
);

// -------- Horoscope Matching --------
const matchPersonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    birthTime: { type: String, required: true },
    birthPlace: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const horoscopeDetailsSchema = new mongoose.Schema(
  {
    bride: { type: matchPersonSchema, required: true },
    groom: { type: matchPersonSchema, required: true },
  },
  { _id: false },
);

// -------- Gemstone Consultation --------
const gemstoneDetailsSchema = new mongoose.Schema(
  {
    dob: { type: Date, required: true },
    birthTime: { type: String, required: true },
    birthPlace: { type: String, required: true, trim: true },
  },
  { _id: false },
);

// -------- Vastu Consultation --------
const vastuDetailsSchema = new mongoose.Schema(
  {
    fullAddress: { type: String, required: true, trim: true },
    propertyType: {
      type: String,
      enum: ["Residential", "Commercial", "Plot", "Other"],
      required: true,
    },
    problemDescription: { type: String, required: true, trim: true },
    images: [
      {
        url: { type: String },
        publicId: { type: String },
      },
    ],
  },
  { _id: false },
);

const consultationBookingSchema = new mongoose.Schema(
  {
    bookingNumber: {
      type: String,
      unique: true,
      default: () => `BKG-${uuidv4().split("-")[0].toUpperCase()}`,
    },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConsultationService",
      required: true,
    },
    // Snapshot of the service at booking time, so later admin edits to the
    // service catalog (price/name changes) never rewrite historical bookings.
    serviceSnapshot: {
      name: { type: String, required: true },
      type: { type: String, required: true },
      price: { type: Number, required: true },
      duration: { type: Number, required: true },
    },

    amount: { type: Number, required: true, min: 0 },
    coupon: {
      code: { type: String, default: null },
      discountAmount: { type: Number, default: 0 },
    },

    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "Pending",
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "stripe", "phonepe", "cashfree", "wallet", "cod"],
      default: null,
    },
    paymentInfo: {
      gateway: { type: String, default: null },
      gatewayOrderId: { type: String, default: null },
      gatewayPaymentId: { type: String, default: null },
      paidAt: { type: Date, default: null },
    },

    bookingStatus: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "Pending",
    },
    statusHistory: [
      {
        status: { type: String, enum: BOOKING_STATUSES },
        note: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],

    appointmentDate: { type: Date, required: true },
    appointmentTime: { type: String, required: true }, // "HH:mm"
    meetingMode: { type: String, enum: MEETING_MODES, required: true },
    meetingLink: { type: String, default: null }, // filled in by admin for Google Meet/Zoom

    contactMobile: { type: String, required: true },
    contactEmail: { type: String, default: null },

    // Exactly one of these is populated, matching serviceSnapshot.type.
    kundliDetails: { type: kundliDetailsSchema, default: undefined },
    horoscopeDetails: { type: horoscopeDetailsSchema, default: undefined },
    gemstoneDetails: { type: gemstoneDetailsSchema, default: undefined },
    vastuDetails: { type: vastuDetailsSchema, default: undefined },

    customerNotes: { type: String, default: null },
    adminNotes: { type: String, default: null }, // internal-only, never exposed to customers

    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
    completedAt: { type: Date, default: null },

    // Admin-managed profile record (models/Astrologer.js) — assignment
    // only, no astrologer login/portal exists.
    assignedAstrologer: { type: mongoose.Schema.Types.ObjectId, ref: "Astrologer", default: null },
    assignmentHistory: [
      {
        astrologer: { type: mongoose.Schema.Types.ObjectId, ref: "Astrologer" },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        assignedAt: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],

    // Kundli report / consultation output delivered by admin — a PDF,
    // image, audio or video file uploaded after the consultation.
    deliverables: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        type: { type: String, enum: DELIVERABLE_TYPES, required: true },
        label: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    review: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String },
      images: [{ url: String, publicId: String }],
      status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
      isFeatured: { type: Boolean, default: false },
      createdAt: { type: Date },
    },
  },
  { timestamps: true },
);

consultationBookingSchema.index({ user: 1, createdAt: -1 });
consultationBookingSchema.index({ bookingStatus: 1 });
consultationBookingSchema.index({ service: 1 });
consultationBookingSchema.index({ appointmentDate: 1 });
consultationBookingSchema.index({ assignedAstrologer: 1 });

module.exports = mongoose.model("ConsultationBooking", consultationBookingSchema);
module.exports.MEETING_MODES = MEETING_MODES;
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
module.exports.DELIVERABLE_TYPES = DELIVERABLE_TYPES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
