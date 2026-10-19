const Order = require("../models/Order");
const User = require("../models/User");
const Coupon = require("../models/Coupon");
const PaymentTransaction = require("../models/PaymentTransaction");
const { reduceStock } = require("../services/order.service");
const { withTransaction } = require("../utils/withTransaction");
const { notify } = require("./notification.service");
const logger = require("../utils/logger");

/**
 * Marks an order as paid, atomically guarding against double-processing.
 * Both the `payment.captured` and `order.paid` webhook events (and the
 * client-side `POST /payments/verify` flow) can independently try to mark
 * the same order paid — the `paymentStatus: { $ne: "Paid" }` filter makes
 * this a single atomic compare-and-swap, so only the first one to arrive
 * actually mutates the order / reduces stock / clears the cart.
 */
const markOrderPaidIfNeeded = async ({ razorpayOrderId, razorpayPaymentId, amount, method }, session) => {
  const order = await Order.findOneAndUpdate(
    { "paymentInfo.razorpayOrderId": razorpayOrderId, paymentStatus: { $ne: "Paid" } },
    {
      $set: {
        paymentStatus: "Paid",
        orderStatus: "Confirmed",
        "paymentInfo.razorpayPaymentId": razorpayPaymentId,
        "paymentInfo.paidAt": new Date(),
      },
      $push: {
        statusHistory: { status: "Confirmed", note: "Payment confirmed via Razorpay webhook" },
      },
    },
    { new: true, session },
  );

  if (!order) {
    // Either no matching order, or it was already marked Paid by another
    // path (client verify / a different webhook event) — both are fine.
    const existing = await Order.findOne({ "paymentInfo.razorpayOrderId": razorpayOrderId }).session(session);
    return { order: existing, wasAlreadyPaid: !!existing };
  }

  // Only the request that actually flipped the flag reduces stock / clears
  // cart / bumps coupon usage, so this can never double-run.
  await reduceStock(order.items, { orderId: order._id, performedBy: null, session });

  if (order.coupon?.code) {
    const couponDoc = await Coupon.findOne({ code: order.coupon.code }).session(session);
    if (couponDoc) await couponDoc.recordUsage(order.user, session);
  }

  await User.findByIdAndUpdate(order.user, { $set: { cart: [] } }, { session });

  return { order, wasAlreadyPaid: false };
};

const handlePaymentCaptured = async (payload, session) => {
  const payment = payload.payment.entity;
  const { order, wasAlreadyPaid } = await markOrderPaidIfNeeded(
    {
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      amount: payment.amount / 100,
      method: payment.method,
    },
    session,
  );

  if (!order) return { matched: false };

  await PaymentTransaction.create(
    [
      {
        order: order._id,
        user: order.user,
        type: "payment",
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        amount: payment.amount / 100,
        currency: payment.currency,
        method: payment.method,
        status: "Success",
        gatewayResponse: payment,
        idempotencyKey: `webhook-payment.captured-${payment.id}`,
      },
    ],
    { session },
  );

  return { matched: true, order, note: wasAlreadyPaid ? "Order was already marked Paid" : "Order marked Paid" };
};

const handlePaymentFailed = async (payload, session) => {
  const payment = payload.payment.entity;

  const order = await Order.findOne({ "paymentInfo.razorpayOrderId": payment.order_id }).session(session);
  if (!order) return { matched: false };

  if (order.paymentStatus !== "Paid") {
    order.paymentStatus = "Failed";
    order.statusHistory.push({
      status: order.orderStatus,
      note: `Payment failed via webhook: ${payment.error_description || "Unknown reason"}`,
    });
    await order.save({ session });
  }

  await PaymentTransaction.create(
    [
      {
        order: order._id,
        user: order.user,
        type: "payment",
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        amount: payment.amount / 100,
        currency: payment.currency,
        method: payment.method,
        status: "Failed",
        failureReason: payment.error_description || payment.error_reason || "Unknown reason",
        gatewayResponse: payment,
        idempotencyKey: `webhook-payment.failed-${payment.id}`,
      },
    ],
    { session },
  );

  return { matched: true, order };
};

const handleRefundCreated = async (payload, session) => {
  const refund = payload.refund.entity;

  const order = await Order.findOne({ "paymentInfo.razorpayPaymentId": refund.payment_id }).session(session);
  if (!order) return { matched: false };

  const isFullRefund = refund.amount >= Math.round(order.grandTotal * 100);
  order.paymentStatus = isFullRefund ? "Refunded" : "Partially Refunded";

  if (order.returnRequest) {
    order.returnRequest.refund.status = "Processing";
    order.returnRequest.refund.razorpayRefundId = refund.id;
    order.returnRequest.refund.amount = refund.amount / 100;
    order.returnRequest.refund.history.push({
      status: "Processing",
      amount: refund.amount / 100,
      note: "Refund initiated via Razorpay webhook",
    });
  }

  order.statusHistory.push({ status: order.orderStatus, note: "Refund initiated" });
  await order.save({ session });

  await PaymentTransaction.create(
    [
      {
        order: order._id,
        user: order.user,
        type: "refund",
        razorpayPaymentId: refund.payment_id,
        razorpayRefundId: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: "Refund Initiated",
        gatewayResponse: refund,
        idempotencyKey: `webhook-refund.created-${refund.id}`,
      },
    ],
    { session },
  );

  // Automated refund-initiation (customer never sees this if it only
  // happens via the admin's manual initiateRefund, which already notifies
  // separately) — this webhook path had no notification at all before.
  await notify({
    user: order.user,
    type: "refund_processed",
    title: "💰 Refund Initiated",
    message: `A refund of ₹${refund.amount / 100} has been initiated for order #${order.orderNumber}.`,
    relatedOrder: order._id,
  });

  return { matched: true, order };
};

const handleRefundProcessed = async (payload, session) => {
  const refund = payload.refund.entity;

  const order = await Order.findOne({ "paymentInfo.razorpayPaymentId": refund.payment_id }).session(session);
  if (!order) return { matched: false };

  const isFullRefund = refund.amount >= Math.round(order.grandTotal * 100);
  order.paymentStatus = isFullRefund ? "Refunded" : "Partially Refunded";

  if (order.returnRequest) {
    order.returnRequest.refund.status = "Completed";
    order.returnRequest.refund.processedAt = new Date();
    order.returnRequest.refund.history.push({
      status: "Completed",
      amount: refund.amount / 100,
      note: "Refund completed via Razorpay webhook",
    });
  }

  order.statusHistory.push({ status: order.orderStatus, note: "Refund completed" });
  await order.save({ session });

  await PaymentTransaction.create(
    [
      {
        order: order._id,
        user: order.user,
        type: "refund",
        razorpayPaymentId: refund.payment_id,
        razorpayRefundId: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: "Refund Completed",
        gatewayResponse: refund,
        idempotencyKey: `webhook-refund.processed-${refund.id}`,
      },
    ],
    { session },
  );

  await notify({
    user: order.user,
    type: "refund_processed",
    title: "💰 Refund Completed",
    message: `Refund for order #${order.orderNumber} has been credited.`,
    relatedOrder: order._id,
  });

  return { matched: true, order };
};

const handleOrderPaid = async (payload, session) => {
  const orderEntity = payload.order.entity;
  // `order.paid` doesn't always include a payment entity in `payload`, but
  // Razorpay does include the last successful payment id on some accounts.
  // Fall back gracefully if it's missing — payment.captured will still
  // carry the payment-level details.
  const paymentId = payload.payment?.entity?.id || null;

  const { order, wasAlreadyPaid } = await markOrderPaidIfNeeded(
    {
      razorpayOrderId: orderEntity.id,
      razorpayPaymentId: paymentId,
      amount: orderEntity.amount_paid / 100,
      method: null,
    },
    session,
  );

  if (!order) return { matched: false };

  await PaymentTransaction.create(
    [
      {
        order: order._id,
        user: order.user,
        type: "payment",
        razorpayOrderId: orderEntity.id,
        razorpayPaymentId: paymentId,
        amount: orderEntity.amount_paid / 100,
        currency: orderEntity.currency,
        status: "Success",
        gatewayResponse: orderEntity,
        idempotencyKey: `webhook-order.paid-${orderEntity.id}`,
      },
    ],
    { session },
  );

  return { matched: true, order, note: wasAlreadyPaid ? "Order was already marked Paid" : "Order marked Paid" };
};

const HANDLERS = {
  "payment.captured": handlePaymentCaptured,
  "payment.failed": handlePaymentFailed,
  "refund.created": handleRefundCreated,
  "refund.processed": handleRefundProcessed,
  "order.paid": handleOrderPaid,
};

/**
 * Builds a stable idempotency key for a Razorpay webhook event, used to
 * dedupe at the WebhookEvent-collection level (separate from the
 * per-transaction idempotency keys used inside each handler above).
 */
const buildEventIdempotencyKey = (event, payload) => {
  switch (event) {
    case "payment.captured":
    case "payment.failed":
      return `${event}:${payload.payment?.entity?.id}`;
    case "refund.created":
    case "refund.processed":
      return `${event}:${payload.refund?.entity?.id}`;
    case "order.paid":
      return `${event}:${payload.order?.entity?.id}`;
    default:
      return null;
  }
};

/**
 * Dispatches a verified, de-duplicated webhook event to its handler inside
 * a (best-effort) transaction so the Order + PaymentTransaction writes are
 * applied together.
 */
const processEvent = async (event, payload) => {
  const handler = HANDLERS[event];
  if (!handler) {
    return { handled: false, reason: "unmapped" };
  }

  const result = await withTransaction((session) => handler(payload, session));

  if (!result.matched) {
    logger.warn(`Razorpay webhook "${event}": no matching order found`);
  }

  return { handled: true, ...result };
};

module.exports = { buildEventIdempotencyKey, processEvent, HANDLERS };
