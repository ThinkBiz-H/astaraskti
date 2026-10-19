const { body } = require("express-validator");
const { SERVICE_TYPES, CONSULTATION_MODES } = require("../models/ConsultationService");
const { MEETING_MODES } = require("../models/ConsultationBooking");
const { BOOKING_STATUSES } = require("../utils/consultationStatusMachine");

// ---------- Consultation Service (admin) ----------

const serviceCommonRules = [
  body("salePrice").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Sale price must be a positive number"),
  body("gstPercent").optional().isFloat({ min: 0, max: 100 }).withMessage("gstPercent must be between 0 and 100"),
  body("featured").optional().isBoolean(),
  body("trending").optional().isBoolean(),
  body("preparationInstructions").optional().isString(),
  body("sortOrder").optional().isInt(),
];

const serviceValidator = [
  body("name").trim().notEmpty().withMessage("Service name is required"),
  body("type")
    .optional()
    .isIn(SERVICE_TYPES)
    .withMessage(`Type must be one of: ${SERVICE_TYPES.join(", ")}`),
  body("price").notEmpty().withMessage("Price is required").isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("duration")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Duration must be a positive number of minutes"),
  body("description").optional().trim().isString(),
  body("status").optional().isIn(["active", "inactive"]),
  ...serviceCommonRules,
];

const serviceUpdateValidator = [
  body("name").optional().trim().notEmpty().withMessage("Service name cannot be empty"),
  body("type")
    .optional()
    .isIn(SERVICE_TYPES)
    .withMessage(`Type must be one of: ${SERVICE_TYPES.join(", ")}`),
  body("price").optional().isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("duration")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Duration must be a positive number of minutes"),
  body("status").optional().isIn(["active", "inactive"]),
  ...serviceCommonRules,
];

// ---------- Consultation Booking (customer) ----------

const createBookingValidator = [
  body("serviceId").notEmpty().withMessage("serviceId is required"),
  body("appointmentDate").isISO8601().withMessage("Valid appointmentDate is required"),
  body("appointmentTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("appointmentTime must be in HH:mm format"),
  body("meetingMode")
    .isIn(MEETING_MODES)
    .withMessage(`meetingMode must be one of: ${MEETING_MODES.join(", ")}`),
  body("contactMobile")
    .matches(/^[0-9]{10}$/)
    .withMessage("Valid 10-digit contactMobile is required"),
  body("contactEmail").optional({ nullable: true }).isEmail().withMessage("Invalid contactEmail"),
  body("couponCode").optional({ nullable: true }).isString(),

  // Kundli
  body("kundliDetails.fullName").if(body("kundliDetails").exists()).notEmpty(),
  body("kundliDetails.gender")
    .if(body("kundliDetails").exists())
    .isIn(["Male", "Female", "Other"]),
  body("kundliDetails.dob").if(body("kundliDetails").exists()).isISO8601(),
  body("kundliDetails.birthTime").if(body("kundliDetails").exists()).notEmpty(),
  body("kundliDetails.birthPlace").if(body("kundliDetails").exists()).notEmpty(),

  // Horoscope matching
  body("horoscopeDetails.bride.name").if(body("horoscopeDetails").exists()).notEmpty(),
  body("horoscopeDetails.bride.dob").if(body("horoscopeDetails").exists()).isISO8601(),
  body("horoscopeDetails.bride.birthTime").if(body("horoscopeDetails").exists()).notEmpty(),
  body("horoscopeDetails.bride.birthPlace").if(body("horoscopeDetails").exists()).notEmpty(),
  body("horoscopeDetails.groom.name").if(body("horoscopeDetails").exists()).notEmpty(),
  body("horoscopeDetails.groom.dob").if(body("horoscopeDetails").exists()).isISO8601(),
  body("horoscopeDetails.groom.birthTime").if(body("horoscopeDetails").exists()).notEmpty(),
  body("horoscopeDetails.groom.birthPlace").if(body("horoscopeDetails").exists()).notEmpty(),

  // Gemstone
  body("gemstoneDetails.dob").if(body("gemstoneDetails").exists()).isISO8601(),
  body("gemstoneDetails.birthTime").if(body("gemstoneDetails").exists()).notEmpty(),
  body("gemstoneDetails.birthPlace").if(body("gemstoneDetails").exists()).notEmpty(),

  // Vastu
  body("vastuDetails.fullAddress").if(body("vastuDetails").exists()).notEmpty(),
  body("vastuDetails.propertyType")
    .if(body("vastuDetails").exists())
    .isIn(["Residential", "Commercial", "Plot", "Other"]),
  body("vastuDetails.problemDescription").if(body("vastuDetails").exists()).notEmpty(),
];

const updateBookingStatusValidator = [
  // Optional — the same endpoint also handles a meeting-link-only save
  // (see updateBookingStatus in consultationBooking.controller.js).
  body("bookingStatus")
    .optional()
    .isIn(BOOKING_STATUSES)
    .withMessage(`Invalid bookingStatus — must be one of: ${BOOKING_STATUSES.join(", ")}`),
  body("note").optional().isString(),
  body("meetingLink").optional({ nullable: true }).isString(),
];

const cancelBookingValidator = [
  body("reason").optional().isString(),
];

const assignAstrologerValidator = [
  body("astrologerId").optional().isMongoId().withMessage("astrologerId must be a valid id"),
  body("note").optional().isString(),
];

const moderateReviewValidator = [
  body("status").optional().isIn(["Pending", "Approved", "Rejected"]).withMessage("Invalid review status"),
  body("isFeatured").optional().isBoolean(),
];

module.exports = {
  serviceValidator,
  serviceUpdateValidator,
  createBookingValidator,
  updateBookingStatusValidator,
  cancelBookingValidator,
  assignAstrologerValidator,
  moderateReviewValidator,
};
