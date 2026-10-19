const mongoose = require("mongoose");

/**
 * Full audit trail of every incoming webhook, from any provider. The unique
 * index on `idempotencyKey` is the actual dedup mechanism — we INSERT this
 * document first (before doing any processing), so a duplicate delivery
 * hits a MongoDB duplicate-key error and is rejected atomically, even under
 * concurrent delivery. This is safer than a "check-then-act" read + write.
 */
const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["razorpay", "shiprocket"], required: true },
    event: { type: String, required: true }, // e.g. "payment.captured"

    idempotencyKey: { type: String, required: true, unique: true },

    signatureValid: { type: Boolean, required: true },

    status: {
      type: String,
      enum: ["Received", "Processed", "Duplicate", "Ignored", "Failed"],
      default: "Received",
    },

    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },

    // Stored as a string (not Mixed) so we retain the exact payload as
    // received, useful for replaying/debugging without any Mongoose casting.
    rawBody: { type: String, required: true },

    processingTimeMs: { type: Number, default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true },
);

webhookEventSchema.index({ provider: 1, event: 1, createdAt: -1 });

module.exports = mongoose.model("WebhookEvent", webhookEventSchema);
