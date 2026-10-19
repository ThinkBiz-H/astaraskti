const express = require("express");
const router = express.Router();

const {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  addBookingReview,
} = require("../controllers/consultationBooking.controller");
const {
  createPaymentOrder,
  verifyPayment,
} = require("../controllers/consultationPayment.controller");

const { protect } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");
const validate = require("../middlewares/validate.middleware");
const parseJsonFields = require("../middlewares/parseJsonFields.middleware");
const {
  createBookingValidator,
  cancelBookingValidator,
} = require("../validators/consultation.validator");

// ---------- Customer ----------
router.post(
  "/",
  protect,
  upload.array("images", 6), // optional Vastu property photos
  parseJsonFields("kundliDetails", "horoscopeDetails", "gemstoneDetails", "vastuDetails"),
  createBookingValidator,
  validate,
  createBooking,
);
router.get("/my", protect, getMyBookings);
router.get("/:id", protect, getBookingById);
router.post("/:id/cancel", protect, cancelBookingValidator, validate, cancelBooking);
router.post("/:id/review", protect, addBookingReview);

// Payment (gateway-abstracted — see services/paymentGateways/)
router.post("/:id/pay/create-order", protect, createPaymentOrder);
router.post("/:id/pay/verify", protect, verifyPayment);

module.exports = router;
