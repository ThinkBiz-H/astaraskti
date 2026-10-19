const ApiError = require("../../utils/ApiError");
const razorpayGateway = require("./razorpay.gateway");
const notImplementedGateway = require("./notImplemented.gateway");

/**
 * Common gateway interface every adapter implements:
 *   - name: string
 *   - createOrder({ amount, currency, receipt, notes }) -> { gateway, gatewayOrderId, amount, currency, raw }
 *   - verifyPayment({ gatewayOrderId, gatewayPaymentId, signature }) -> boolean
 *   - verifyWebhookSignature(rawBody, signature) -> boolean
 *
 * Callers (payment.controller.js, consultationPayment.controller.js) code
 * against this interface only — never against a specific SDK — so adding
 * Stripe/PhonePe/Cashfree for real later doesn't touch any calling code.
 */
const registry = {
  razorpay: razorpayGateway,
  stripe: notImplementedGateway("stripe"),
  phonepe: notImplementedGateway("phonepe"),
  cashfree: notImplementedGateway("cashfree"),
};

const getGateway = (name = "razorpay") => {
  const gateway = registry[name];
  if (!gateway) throw new ApiError(400, `Unknown payment gateway: ${name}`);
  return gateway;
};

module.exports = { getGateway, SUPPORTED_GATEWAYS: Object.keys(registry) };
