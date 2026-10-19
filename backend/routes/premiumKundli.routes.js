const express = require("express");
const router = express.Router();

const {
  getSettings,
  geocodeBirthPlace,
  devGenerateKundli,
  createOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateStatus,
  regenerate,
  resendEmail,
  exportOrders,
  downloadPdf,
} = require("../controllers/premiumKundli.controller");

const { protect, authorize, optionalAuth } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/permission.middleware");
const validate = require("../middlewares/validate.middleware");
const upload = require("../middlewares/upload.middleware");
const { mediaUpload } = require("../middlewares/mediaUpload.middleware");
const {
  createOrderValidator,
  geocodeValidator,
  verifyPaymentValidator,
  updateStatusValidator,
} = require("../validators/premiumKundli.validator");

// Public — home page card reads price/content from here.
router.get("/settings", getSettings);

// Public — resolves a birth place to lat/lon/timezone before payment, so
// the Premium Kundli form can validate it while the customer can still fix
// a typo rather than discovering it only after they've already paid.
router.post("/geocode", geocodeValidator, validate, geocodeBirthPlace);

// Full guest checkout — no login/OTP required. optionalAuth populates
// req.user when a token IS present (so a logged-in buyer's order still
// links to their account) but never requires one.
router.post("/order", optionalAuth, createOrderValidator, validate, createOrder);
router.post("/payment/verify", optionalAuth, verifyPaymentValidator, validate, verifyPayment);

// DEV-ONLY — bypasses Razorpay entirely (see devGenerateKundli's own guard,
// which 403s unless SKIP_KUNDLI_PAYMENT=true and NODE_ENV!==production on
// the server, regardless of what a client sends). Deliberately not routed
// through createOrder/verifyPayment at all — no code path here can reach
// the Razorpay SDK.
router.post("/generate", optionalAuth, createOrderValidator, validate, devGenerateKundli);

// Account-only — used by the logged-in "My Premium Kundli" dashboard page,
// not by the guest purchase flow (a guest gets everything it needs back
// directly in the /order and /payment/verify responses).
router.get("/my-orders", protect, getMyOrders);
router.get("/order/:id", protect, getOrderById);
router.get("/download/:id", protect, downloadPdf);

// Admin
router.get("/orders", protect, authorize("admin"), requirePermission("manage_consultations"), getAllOrders);
router.get("/orders/export", protect, authorize("admin"), requirePermission("manage_consultations"), exportOrders);
router.patch(
  "/status",
  protect,
  authorize("admin"),
  requirePermission("manage_consultations"),
  mediaUpload.single("file"), // optional PDF/image/audio/video report upload
  updateStatusValidator,
  validate,
  updateStatus,
);
router.post("/orders/:id/regenerate", protect, authorize("admin"), requirePermission("manage_consultations"), regenerate);
router.post("/orders/:id/resend-email", protect, authorize("admin"), requirePermission("manage_consultations"), resendEmail);

module.exports = router;
