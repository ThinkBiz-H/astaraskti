const { body } = require("express-validator");
const { KUNDLI_STATUSES } = require("../models/PremiumKundliOrder");

const createOrderValidator = [
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("email").isEmail().withMessage("A valid email is required"),
  body("mobile").matches(/^[0-9]{10}$/).withMessage("Valid 10-digit mobile is required"),
  body("dob").isISO8601().withMessage("Valid date of birth is required"),
  body("birthTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("birthTime must be in HH:mm format"),
  body("birthPlace").trim().notEmpty().withMessage("Birth place is required"),
  body("gender").isIn(["Male", "Female", "Other"]).withMessage("Valid gender is required"),
  // Optional — set when the frontend already resolved the place via
  // POST /kundli/geocode before payment. If absent, kundliGeneration.service.js
  // falls back to resolving them itself during generation, same as before.
  body("latitude").optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body("longitude").optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body("timezoneOffset").optional({ nullable: true }).isFloat({ min: -14, max: 14 }),
];

const geocodeValidator = [
  body("birthPlace").trim().notEmpty().withMessage("Birth place is required"),
  body("dob").isISO8601().withMessage("Valid date of birth is required"),
  body("birthTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("birthTime must be in HH:mm format"),
];

const verifyPaymentValidator = [
  body("orderId").isMongoId().withMessage("Valid orderId is required"),
  body("gatewayOrderId").notEmpty().withMessage("gatewayOrderId is required"),
  body("gatewayPaymentId").notEmpty().withMessage("gatewayPaymentId is required"),
  body("signature").notEmpty().withMessage("signature is required"),
];

const updateStatusValidator = [
  body("orderId").isMongoId().withMessage("Valid orderId is required"),
  body("kundliStatus").optional().isIn(KUNDLI_STATUSES).withMessage(`kundliStatus must be one of: ${KUNDLI_STATUSES.join(", ")}`),
  body("note").optional().isString(),
  body("adminNotes").optional().isString(),
];

const updateSettingsValidator = [
  body("originalPrice").optional().isFloat({ min: 0 }).withMessage("originalPrice must be a positive number"),
  body("salePrice").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("salePrice must be a positive number"),
  body("gstPercent").optional().isFloat({ min: 0, max: 100 }).withMessage("gstPercent must be between 0 and 100"),
  body("isActive").optional().isBoolean(),
];

module.exports = {
  createOrderValidator,
  geocodeValidator,
  verifyPaymentValidator,
  updateStatusValidator,
  updateSettingsValidator,
};
