const shiprocket = require("./shiprocket.service");
const ApiError = require("../utils/ApiError");

/**
 * Calculate shipping charge
 */
const calculateShipping = async ({
  pincode,
  deliveryPincode,
  weight = 0.5,
  cod = false,
}) => {
  // Dono support karega
  const finalPincode = deliveryPincode || pincode;

  if (!finalPincode) {
    throw new ApiError(400, "Delivery pincode is required");
  }

  // ==========================
  // Shiprocket Disabled
  // ==========================
  if (!shiprocket.isShiprocketEnabled()) {
    let shippingCharge = 0;

    if (weight <= 0.5) {
      shippingCharge = 60;
    } else if (weight <= 1) {
      shippingCharge = 90;
    } else {
      shippingCharge = 120 + Math.ceil(weight - 1) * 30;
    }

    return {
      shippingCharge,
      courierName: "Standard Shipping",
      estimatedDays: 4,
      courierId: null,
      availableCouriers: 1,
    };
  }

  // ==========================
  // Shiprocket Enabled
  // ==========================
  const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE;

  if (!pickupPincode) {
    throw new ApiError(500, "SHIPROCKET_PICKUP_PINCODE is not configured");
  }

  const couriers = await shiprocket.checkServiceability({
    pickupPincode,
    deliveryPincode: finalPincode,
    weight,
    cod,
  });

  if (!couriers || couriers.length === 0) {
    throw new ApiError(400, "Delivery is not available for this pincode");
  }

  couriers.sort((a, b) => Number(a.rate) - Number(b.rate));

  const courier = couriers[0];

  return {
    shippingCharge: Number(courier.rate || 0),
    courierName: courier.courier_name,
    estimatedDays:
      Number(courier.estimated_delivery_days) || Number(courier.etd) || 4,
    courierId: courier.courier_company_id,
    availableCouriers: couriers.length,
  };
};

module.exports = {
  calculateShipping,
};
