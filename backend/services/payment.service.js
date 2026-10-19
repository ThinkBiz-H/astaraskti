const crypto = require("crypto");
const razorpayInstance = require("../config/razorpay");
const PaymentTransaction = require("../models/PaymentTransaction");
const logger = require("../utils/logger");

/**
 * Verifies a Razorpay order+payment signature pair (used after checkout
 * redirect, NOT the webhook signature — see verifyWebhookSignature below).
 */
const verifyPaymentSignature = (razorpayOrderId, razorpayPaymentId, signature) => {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return expected === signature;
};

/**
 * Verifies the `X-Razorpay-Signature` header on incoming webhooks against
 * the raw request body, using the separate webhook secret configured in the
 * Razorpay dashboard (never the API key secret).
 */
const verifyWebhookSignature = (rawBody, signature) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
};

/**
 * Appends a payment/refund event to the audit log. Never throws on a
 * duplicate idempotency key — logging must never break the calling flow —
 * it just logs a warning and returns the existing record instead.
 */
const logTransaction = async (data) => {
  try {
    return await PaymentTransaction.create(data);
  } catch (error) {
    if (error.code === 11000 && data.idempotencyKey) {
      logger.warn(`Duplicate payment event ignored (idempotencyKey=${data.idempotencyKey})`);
      return PaymentTransaction.findOne({ idempotencyKey: data.idempotencyKey });
    }
    logger.error(`Failed to write payment transaction log: ${error.message}`);
    return null; // logging failures must never break the payment flow
  }
};

/**
 * Manually captures an authorized-but-not-yet-captured payment. Not needed
 * for the default checkout flow (Razorpay orders are created with
 * auto-capture), but kept available for edge cases / admin recovery.
 */
const captureRazorpayPayment = async (paymentId, amount, currency = "INR") => {
  return razorpayInstance.payments.capture(paymentId, Math.round(amount * 100), currency);
};

module.exports = {
  verifyPaymentSignature,
  verifyWebhookSignature,
  logTransaction,
  captureRazorpayPayment,
};
