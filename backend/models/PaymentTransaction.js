const mongoose = require("mongoose");

/**
 * Append-only audit log of every payment-related event (attempt, success,
 * failure, retry, refund). Nothing here is ever mutated after creation —
 * new events get new documents — so this doubles as the payment audit trail
 * required by Phase 2 item 8.
 */
const paymentTransactionSchema = new mongoose.Schema(
  {
    // Exactly one of `order` / `consultationBooking` is set per transaction.
    // `order` is no longer schema-required (it was, pre-Phase-17) — every
    // existing product-order payment flow still always sets it, so nothing
    // changes for them; `consultationBooking` is additive, for the new
    // astrology consultation payment flow. Enforced by the pre-validate hook
    // below rather than at the field level, since exactly one of two fields
    // being required isn't expressible with `required: true` alone.
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    consultationBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConsultationBooking",
      default: null,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    type: {
      type: String,
      enum: ["payment", "refund"],
      default: "payment",
      required: true,
    },

    // Razorpay identifiers (whichever apply to this event)
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    razorpayRefundId: { type: String, default: null },

    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    method: { type: String, default: null }, // card, upi, netbanking, wallet, cod, etc.

    status: {
      type: String,
      enum: [
        "Created", // razorpay order created, awaiting payment
        "Success",
        "Failed",
        "Cancelled",
        "Retried",
        "Refund Initiated",
        "Refund Processing",
        "Refund Completed",
        "Refund Failed",
      ],
      required: true,
    },

    failureReason: { type: String, default: null },

    // Raw gateway payload for debugging/audit — never exposed verbatim to customers
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },

    // Idempotency key so the same webhook event is never processed twice
    // (Razorpay's `event_id` / payment/refund id + event type combo)
    idempotencyKey: { type: String, default: null, index: true, unique: true, sparse: true },

    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // admin, for manual refunds
  },
  { timestamps: true },
);

paymentTransactionSchema.index({ order: 1, createdAt: -1 });
paymentTransactionSchema.index({ consultationBooking: 1, createdAt: -1 });
paymentTransactionSchema.index({ razorpayPaymentId: 1 });

// Callback-style (`next`) middleware was removed in Mongoose 9 — a
// pre-existing use of it here made every PaymentTransaction.create() call
// throw "next is not a function" (discovered while wiring up refund
// notifications). Sync-throw is the supported style across every current
// Mongoose version and both single- and array-form create() calls.
paymentTransactionSchema.pre("validate", function () {
  if (!this.order && !this.consultationBooking) {
    throw new Error("A payment transaction must reference either an order or a consultation booking");
  }
});

module.exports = mongoose.model("PaymentTransaction", paymentTransactionSchema);
