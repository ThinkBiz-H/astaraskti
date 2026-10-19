const razorpayInstance = require("../../config/razorpay");
const {
  verifyPaymentSignature,
  verifyWebhookSignature,
} = require("../payment.service");

/**
 * Razorpay implementation of the common gateway interface (see index.js in
 * this folder for the interface every gateway module must implement).
 */
const createOrder = async ({ amount, currency = "INR", receipt, notes = {} }) => {
  const order = await razorpayInstance.orders.create({
    amount: Math.round(amount * 100), // paise
    currency,
    receipt,
    notes,
  });
  return {
    gateway: "razorpay",
    gatewayOrderId: order.id,
    amount,
    currency,
    // Everything the storefront's checkout SDK needs to open the widget.
    raw: order,
  };
};

const verifyPayment = ({ gatewayOrderId, gatewayPaymentId, signature }) => {
  return verifyPaymentSignature(gatewayOrderId, gatewayPaymentId, signature);
};

module.exports = {
  name: "razorpay",
  createOrder,
  verifyPayment,
  verifyWebhookSignature,
};
