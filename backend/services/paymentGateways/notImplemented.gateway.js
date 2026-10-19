const ApiError = require("../../utils/ApiError");

/**
 * Produces a gateway module that satisfies the common interface but clearly
 * refuses to process anything until it's actually implemented and
 * configured. This lets the rest of the app (routes, controllers, the
 * gateway registry) already be written against every planned gateway, so
 * flipping one on later only means writing that one file — nothing else in
 * the payment flow changes.
 */
const notImplementedGateway = (name) => ({
  name,
  createOrder: async () => {
    throw new ApiError(501, `${name} is not yet configured on this server`);
  },
  verifyPayment: () => {
    throw new ApiError(501, `${name} is not yet configured on this server`);
  },
  verifyWebhookSignature: () => false,
});

module.exports = notImplementedGateway;
