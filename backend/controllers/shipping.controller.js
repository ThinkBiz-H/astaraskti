const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/ApiResponse");
const shippingService = require("../services/shipping.service");

/**
 * @desc    Calculate shipping charge by pincode
 * @route   POST /api/v1/shipping/calculate
 * @access  Public
 */
const calculateShipping = asyncHandler(async (req, res) => {
  const { pincode, weight = 0.5, cod = false } = req.body;

  const shipping = await shippingService.calculateShipping({
    deliveryPincode: pincode,
    weight,
    cod,
  });

  sendResponse(res, 200, shipping, "Shipping charge calculated successfully");
});

module.exports = {
  calculateShipping,
};
