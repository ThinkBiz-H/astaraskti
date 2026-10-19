const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const ConsultationBooking = require("../models/ConsultationBooking");
const { getGateway } = require("../services/paymentGateways");
const { logTransaction } = require("../services/payment.service");
const { notify } = require("../services/notification.service");

// @desc    Create a gateway order for a booking's payment
// @route   POST /api/v1/consultations/bookings/:id/pay/create-order
// @access  Private
const createPaymentOrder = asyncHandler(async (req, res) => {
  const gatewayName = req.body.gateway || "razorpay";
  const booking = await ConsultationBooking.findById(req.params.id);

  if (!booking) throw new ApiError(404, "Booking not found");
  if (String(booking.user) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to pay for this booking");
  }
  if (booking.paymentStatus === "Paid") {
    throw new ApiError(400, "This booking has already been paid for");
  }

  const gateway = getGateway(gatewayName);
  const gatewayOrder = await gateway.createOrder({
    amount: booking.amount,
    receipt: booking.bookingNumber,
    notes: { bookingId: String(booking._id), type: "consultation" },
  });

  booking.paymentMethod = gatewayName;
  booking.paymentInfo.gateway = gatewayName;
  booking.paymentInfo.gatewayOrderId = gatewayOrder.gatewayOrderId;
  await booking.save();

  sendResponse(res, 200, { order: gatewayOrder }, "Payment order created successfully");
});

// @desc    Verify a completed payment and mark the booking as paid
// @route   POST /api/v1/consultations/bookings/:id/pay/verify
// @access  Private
const verifyPayment = asyncHandler(async (req, res) => {
  const { gatewayOrderId, gatewayPaymentId, signature } = req.body;
  if (!gatewayOrderId || !gatewayPaymentId || !signature) {
    throw new ApiError(400, "Missing required payment verification fields");
  }

  const booking = await ConsultationBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.paymentInfo.gatewayOrderId !== gatewayOrderId) {
    throw new ApiError(400, "Order ID mismatch");
  }

  const gateway = getGateway(booking.paymentMethod);
  const isValid = gateway.verifyPayment({ gatewayOrderId, gatewayPaymentId, signature });

  if (!isValid) {
    booking.paymentStatus = "Failed";
    await booking.save();

    await logTransaction({
      consultationBooking: booking._id,
      user: booking.user,
      type: "payment",
      razorpayOrderId: gatewayOrderId,
      razorpayPaymentId: gatewayPaymentId,
      amount: booking.amount,
      status: "Failed",
      failureReason: "Signature verification failed",
      idempotencyKey: `consultation-verify-fail-${gatewayPaymentId}`,
    });

    throw new ApiError(400, "Payment verification failed: invalid signature");
  }

  booking.paymentStatus = "Paid";
  booking.paymentInfo.gatewayPaymentId = gatewayPaymentId;
  booking.paymentInfo.paidAt = new Date();
  if (booking.bookingStatus === "Pending") booking.bookingStatus = "Confirmed";
  booking.statusHistory.push({ status: booking.bookingStatus, note: "Payment received" });
  await booking.save();

  await logTransaction({
    consultationBooking: booking._id,
    user: booking.user,
    type: "payment",
    razorpayOrderId: gatewayOrderId,
    razorpayPaymentId: gatewayPaymentId,
    amount: booking.amount,
    status: "Success",
    idempotencyKey: `consultation-verify-${gatewayPaymentId}`,
  });

  await notify({
    user: booking.user,
    type: "consultation_payment_received",
    title: "Payment received",
    message: `Payment received for booking ${booking.bookingNumber}. It's now confirmed.`,
  });

  sendResponse(res, 200, { booking }, "Payment verified successfully");
});

module.exports = { createPaymentOrder, verifyPayment };
