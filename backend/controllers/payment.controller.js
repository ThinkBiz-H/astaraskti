const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Order = require('../models/Order');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const PaymentTransaction = require('../models/PaymentTransaction');
const razorpayInstance = require('../config/razorpay');
const { reduceStock } = require('../services/order.service');
const { verifyPaymentSignature, logTransaction } = require('../services/payment.service');
const { sendEmail, templates } = require('../utils/sendEmail');
const { notify } = require('../services/notification.service');

// @desc    Verify Razorpay payment signature and finalize order
// @route   POST /api/v1/payments/verify
// @access  Private
// NOTE: behavior/response shape is unchanged from Phase 1 — only addition is
// audit-log writes via logTransaction(), which never throw into this flow.
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
    throw new ApiError(400, 'Missing required payment verification fields');
  }

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  if (order.paymentInfo.razorpayOrderId !== razorpay_order_id) {
    throw new ApiError(400, 'Order ID mismatch');
  }

  const isValidSignature = verifyPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );

  if (!isValidSignature) {
    order.paymentStatus = 'Failed';
    await order.save();

    await logTransaction({
      order: order._id,
      user: order.user,
      type: 'payment',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amount: order.grandTotal,
      status: 'Failed',
      failureReason: 'Signature verification failed',
      idempotencyKey: `verify-fail-${razorpay_payment_id}`,
    });

    throw new ApiError(400, 'Payment verification failed: invalid signature');
  }

  // Signature valid -> mark order as paid, reduce stock, apply coupon usage, clear cart
  order.paymentStatus = 'Paid';
  order.orderStatus = 'Confirmed';
  order.paymentInfo.razorpayPaymentId = razorpay_payment_id;
  order.paymentInfo.razorpaySignature = razorpay_signature;
  order.paymentInfo.paidAt = new Date();
  order.statusHistory.push({ status: 'Confirmed', note: 'Payment verified successfully' });
  await order.save();

  await reduceStock(order.items, { orderId: order._id, performedBy: req.user._id });

  if (order.coupon && order.coupon.code) {
    const couponDoc = await Coupon.findOne({ code: order.coupon.code });
    if (couponDoc) await couponDoc.recordUsage(order.user);
  }

  const user = await User.findById(order.user);
  user.cart = [];
  await user.save({ validateBeforeSave: false });

  // Fetch payment method from Razorpay for the audit log (best-effort, non-fatal)
  let method = null;
  try {
    const payment = await razorpayInstance.payments.fetch(razorpay_payment_id);
    method = payment.method || null;
  } catch (e) {
    /* non-fatal — logged below without method */
  }

  await logTransaction({
    order: order._id,
    user: order.user,
    type: 'payment',
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    amount: order.grandTotal,
    method,
    status: 'Success',
    idempotencyKey: `verify-success-${razorpay_payment_id}`,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: `Order Confirmed - ${order.orderNumber}`,
      html: templates.orderConfirmation(user.name, order),
    });
  } catch (e) {
    /* non-fatal */
  }

  sendResponse(res, 200, { order }, 'Payment verified and order confirmed successfully');
});

// @desc    Handle payment failure callback from client
// @route   POST /api/v1/payments/failure
// @access  Private
// NOTE: unchanged response shape from Phase 1 — adds an audit-log write only.
const paymentFailed = asyncHandler(async (req, res) => {
  const { orderId, reason, razorpay_payment_id } = req.body;

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  order.paymentStatus = 'Failed';
  order.statusHistory.push({ status: order.orderStatus, note: 'Payment failed' });
  await order.save();

  await logTransaction({
    order: order._id,
    user: order.user,
    type: 'payment',
    razorpayOrderId: order.paymentInfo?.razorpayOrderId,
    razorpayPaymentId: razorpay_payment_id || null,
    amount: order.grandTotal,
    status: 'Failed',
    failureReason: reason || 'Payment failed (client callback)',
    idempotencyKey: razorpay_payment_id ? `client-fail-${razorpay_payment_id}` : undefined,
  });

  try {
    const user = await User.findById(order.user).select('name email');
    if (user) {
      await sendEmail({
        to: user.email,
        subject: `Payment Failed - ${order.orderNumber}`,
        html: templates.paymentFailed(user.name, order, reason),
      });
    }
  } catch (e) {
    /* non-fatal */
  }

  notify({
    user: order.user,
    type: 'payment_failed',
    title: 'Payment failed',
    message: `Your payment for order #${order.orderNumber} could not be processed.`,
    relatedOrder: order._id,
  });

  sendResponse(res, 200, { order }, 'Payment failure recorded');
});

// @desc    Record that the customer abandoned/cancelled checkout before paying
// @route   POST /api/v1/payments/cancelled
// @access  Private
const paymentCancelled = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) throw new ApiError(400, 'orderId is required');

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  if (order.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not authorized to modify this order');
  }

  if (order.paymentStatus === 'Paid') {
    throw new ApiError(400, 'This order has already been paid for');
  }

  order.paymentStatus = 'Failed';
  order.statusHistory.push({ status: order.orderStatus, note: 'Payment cancelled by customer' });
  await order.save();

  await logTransaction({
    order: order._id,
    user: order.user,
    type: 'payment',
    razorpayOrderId: order.paymentInfo?.razorpayOrderId,
    amount: order.grandTotal,
    status: 'Cancelled',
    failureReason: 'Cancelled by customer before completing checkout',
  });

  sendResponse(res, 200, { order }, 'Payment cancellation recorded');
});

// @desc    Retry payment for an order whose previous payment attempt failed
//          or was cancelled — creates a fresh Razorpay order for the same
//          grand total so the customer can re-attempt checkout.
// @route   POST /api/v1/payments/:orderId/retry
// @access  Private
const retryPayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  if (order.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not authorized to retry payment for this order');
  }

  if (order.paymentMethod !== 'razorpay') {
    throw new ApiError(400, 'Only online (Razorpay) orders support payment retry');
  }

  if (order.paymentStatus === 'Paid') {
    throw new ApiError(400, 'This order has already been paid for');
  }

  if (!['Pending', 'Confirmed'].includes(order.orderStatus)) {
    throw new ApiError(
      400,
      `Cannot retry payment — order is currently "${order.orderStatus}"`,
    );
  }

  const razorpayOrder = await razorpayInstance.orders.create({
    amount: Math.round(order.grandTotal * 100),
    currency: 'INR',
    receipt: `${order.orderNumber}-retry-${Date.now()}`,
  });

  order.paymentInfo.razorpayOrderId = razorpayOrder.id;
  order.paymentStatus = 'Pending';
  order.statusHistory.push({ status: order.orderStatus, note: 'Payment retry initiated', changedBy: req.user._id });
  await order.save();

  await logTransaction({
    order: order._id,
    user: order.user,
    type: 'payment',
    razorpayOrderId: razorpayOrder.id,
    amount: order.grandTotal,
    status: 'Retried',
  });

  sendResponse(
    res,
    200,
    { order, razorpayOrder, razorpayKeyId: process.env.RAZORPAY_KEY_ID },
    'Payment retry initiated. Proceed to payment.',
  );
});

// @desc    Initiate a Razorpay refund for a paid order (full or partial)
// @route   POST /api/v1/payments/:orderId/refund
// @access  Private/Admin
const initiateRefund = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;
  const order = await Order.findById(req.params.orderId).populate("user", "name email");
  if (!order) throw new ApiError(404, "Order not found");

  if (order.paymentMethod !== "razorpay") {
    throw new ApiError(400, "Only online (Razorpay) payments can be refunded from here");
  }
  if (!["Paid", "Partially Refunded"].includes(order.paymentStatus)) {
    throw new ApiError(400, `Order payment status "${order.paymentStatus}" is not refundable`);
  }
  if (!order.paymentInfo?.razorpayPaymentId) {
    throw new ApiError(400, "No captured Razorpay payment found on this order");
  }

  const refundAmount = amount ? Number(amount) : order.grandTotal;
  if (refundAmount <= 0 || refundAmount > order.grandTotal) {
    throw new ApiError(400, `Refund amount must be between 0 and ${order.grandTotal}`);
  }

  let refund;
  try {
    refund = await razorpayInstance.payments.refund(order.paymentInfo.razorpayPaymentId, {
      amount: Math.round(refundAmount * 100),
      notes: { reason: reason || "Admin-initiated refund", orderNumber: order.orderNumber },
    });
  } catch (error) {
    throw new ApiError(502, `Razorpay refund failed: ${error.error?.description || error.message}`);
  }

  const isFullRefund = refundAmount >= order.grandTotal;
  order.paymentStatus = isFullRefund ? "Refunded" : "Partially Refunded";
  order.statusHistory.push({
    status: order.orderStatus,
    note: `Refund of ${refundAmount} initiated${reason ? ` — ${reason}` : ""}`,
    changedBy: req.user._id,
  });

  if (order.returnRequest) {
    order.returnRequest.refund.status = "Processing";
    order.returnRequest.refund.razorpayRefundId = refund.id;
    order.returnRequest.refund.amount = refundAmount;
    order.returnRequest.refund.history.push({
      status: "Processing",
      amount: refundAmount,
      note: reason || "Refund initiated by admin",
    });
  }

  await order.save();

  await logTransaction({
    order: order._id,
    user: order.user._id,
    type: "refund",
    razorpayPaymentId: order.paymentInfo.razorpayPaymentId,
    razorpayRefundId: refund.id,
    amount: refundAmount,
    status: "Refund Initiated",
    processedBy: req.user._id,
    gatewayResponse: refund,
  });

  try {
    await sendEmail({
      to: order.user.email,
      subject: `Refund Initiated - ${order.orderNumber}`,
      html: templates.refundProcessed(order.user.name, order, refundAmount),
    });
  } catch (e) {
    /* non-fatal */
  }

  notify({
    user: order.user._id,
    // "payment_refunded" isn't a valid Notification.type — this call was
    // silently failing every time (notify() catches Notification.create
    // errors internally and just logs them). refund_processed is the
    // correct, already-existing enum value.
    type: "refund_processed",
    title: "💰 Refund Initiated",
    message: `A refund of ₹${refundAmount} has been initiated for order #${order.orderNumber}.`,
    relatedOrder: order._id,
  });

  sendResponse(res, 200, { order, refund }, "Refund initiated successfully");
});

// @desc    List payment transactions for an order (owner or admin)
// @route   GET /api/v1/payments/:orderId/transactions
// @access  Private
const getOrderTransactions = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const isOwner = order.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    throw new ApiError(403, 'You are not authorized to view these transactions');
  }

  const transactions = await PaymentTransaction.find({ order: order._id }).sort('-createdAt');

  // Customers get a redacted view — no raw gateway payloads
  const payload = isOwner && req.user.role !== 'admin'
    ? transactions.map((t) => {
        const obj = t.toObject();
        delete obj.gatewayResponse;
        return obj;
      })
    : transactions;

  sendResponse(res, 200, { transactions: payload }, 'Payment transactions fetched successfully');
});

module.exports = {
  verifyPayment,
  paymentFailed,
  paymentCancelled,
  retryPayment,
  initiateRefund,
  getOrderTransactions,
};
