const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { ORDER_STATUSES } = require("../utils/orderStatusMachine");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      default: null,
    },
    title: { type: String, required: true },
    sku: { type: String },
    unitValue: {
      type: String,
    },
    thumbnail: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    color: { type: String },
    size: { type: String },
  },
  { _id: false },
);

// Shipment-level statuses reported by the courier / Shiprocket, tracked
// separately from the high-level `orderStatus` shown to the customer.
const SHIPMENT_STATUSES = [
  "Not Shipped",
  "Shipment Created",
  "AWB Assigned",
  "Pickup Scheduled",
  "Pickup Generated",
  "In Transit",
  "Out For Delivery",
  "Delivered",
  "Delivery Failed",
  "RTO Initiated",
  "RTO Delivered",
  "Cancelled",
];

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: { type: String },
  },
  { _id: false },
);

const returnSchema = new mongoose.Schema(
  {
    requestedAt: { type: Date, default: Date.now },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, min: 1 },
      },
    ],
    reason: { type: String, required: true },
    comment: { type: String },
    images: [{ url: String, publicId: String }],
    status: {
      type: String,
      enum: [
        "Requested",
        "Approved",
        "Rejected",
        "Picked Up",
        "Received",
        "Completed",
      ],
      default: "Requested",
    },
    adminComment: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    // Reverse-pickup shipment created via Shiprocket once the return is approved.
    shiprocket: {
      shipmentId: { type: String, default: null },
      awbCode: { type: String, default: null },
    },
    refund: {
      status: {
        type: String,
        enum: [
          "Not Applicable",
          "Pending",
          "Processing",
          "Completed",
          "Failed",
        ],
        default: "Not Applicable",
      },
      method: {
        type: String,
        enum: ["Original Payment Method", "Bank Transfer", "Store Credit"],
        default: null,
      },
      amount: { type: Number, default: 0 },
      razorpayRefundId: { type: String },
      processedAt: { type: Date },
      history: [
        {
          status: String,
          amount: Number,
          note: String,
          at: { type: Date, default: Date.now },
        },
      ],
    },
  },
  { timestamps: true },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      default: () => `ORD-${uuidv4().split("-")[0].toUpperCase()}`,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],

    shippingAddress: {
      fullName: {
        type: String,
        required: true,
      },
      email: {
        type: String,
      },
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      country: String,
      pincode: String,
      mobile: String,
    },
    coupon: {
      code: { type: String, default: null },
      discountAmount: { type: Number, default: 0 },
    },

    subTotal: { type: Number, required: true },
    shippingCharge: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },

    // Physical package details, used both for manual courier bookings and
    // for the Shiprocket shipment payload.
    packageDetails: {
      weightKg: { type: Number, default: 0.5 },
      lengthCm: { type: Number, default: 10 },
      breadthCm: { type: Number, default: 10 },
      heightCm: { type: Number, default: 10 },
    },

    paymentMethod: { type: String, enum: ["razorpay", "cod"], required: true },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded", "Partially Refunded"],
      default: "Pending",
    },
    paymentInfo: {
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      razorpaySignature: { type: String },
      paidAt: { type: Date },
    },

    orderStatus: { type: String, enum: ORDER_STATUSES, default: "Pending" },
    statusHistory: [statusHistorySchema],

    // -------- Shipping / courier (generic, provider-agnostic) --------
    courier: {
      partner: { type: String, default: null }, // e.g. "Shiprocket", "Delhivery", "Manual"
      courierId: { type: String, default: null },
      courierName: { type: String, default: null },
    },
    tracking: {
      number: { type: String, default: null },
      url: { type: String, default: null },
      estimatedDeliveryDate: { type: Date, default: null },
      shipmentStatus: {
        type: String,
        enum: SHIPMENT_STATUSES,
        default: "Not Shipped",
      },
      deliveryAttempts: { type: Number, default: 0 },
      lastAttemptAt: { type: Date, default: null },
      lastAttemptNote: { type: String, default: null },
    },
    shippingNotes: { type: String, default: null }, // customer-facing note e.g. "Leave at gate"
    adminNotes: { type: String, default: null }, // internal-only note, never exposed to customers

    // -------- Shiprocket-specific identifiers (only populated when enabled) --------
    shiprocket: {
      orderId: { type: String, default: null },
      shipmentId: { type: String, default: null },
      awbCode: { type: String, default: null },
      courierCompanyId: { type: String, default: null },
      labelUrl: { type: String, default: null },
      manifestUrl: { type: String, default: null },
      invoiceUrl: { type: String, default: null },
      pickupScheduledAt: { type: Date, default: null },
      pickupTokenNumber: { type: String, default: null },
    },

    // -------- Returns / Refunds --------
    returnRequest: { type: returnSchema, default: null },

    // Backward-compat: kept in sync with `tracking.number` via pre-save hook
    // so any existing client code reading `order.trackingNumber` keeps working.
    trackingNumber: { type: String, default: null },

    invoiceNumber: {
      type: String,
      default: () => `INV-${uuidv4().split("-")[0].toUpperCase()}`,
    },

    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ "tracking.number": 1 });
orderSchema.index({ "shiprocket.awbCode": 1 });

// Keep the legacy top-level `trackingNumber` field mirrored to
// `tracking.number` in both directions so old and new code stay in sync.
orderSchema.pre("save", function () {
  if (this.isModified("tracking.number") && this.tracking?.number) {
    this.trackingNumber = this.tracking.number;
  } else if (this.isModified("trackingNumber") && this.trackingNumber) {
    if (!this.tracking) {
      this.tracking = {};
    }
    this.tracking.number = this.trackingNumber;
  }
});

module.exports = mongoose.model("Order", orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.SHIPMENT_STATUSES = SHIPMENT_STATUSES;
