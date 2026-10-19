const express = require("express");
const router = express.Router();

const { getHoroscopeService, getHoroscopeSettings, createOrder, verifyPayment, devGenerateHoroscope } = require("../controllers/horoscope.controller");

// Geocoding has nothing Kundli-specific about it (pure place-name ->
// lat/lon/timezone resolution) — reused directly instead of duplicating
// it, per "reuse existing logic wherever possible instead of duplicating
// code". Does not modify or import anything Kundli-specific.
const { geocodeBirthPlace } = require("../controllers/premiumKundli.controller");
const { geocodeValidator, createOrderValidator, verifyPaymentValidator } = require("../validators/premiumKundli.validator");

const { optionalAuth } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");

// Public — the Horoscope purchase page reads price/content from here.
router.get("/service", getHoroscopeService);

// Public — same GET pattern as Premium Kundli's GET /kundli/settings.
router.get("/settings", getHoroscopeSettings);

// Public — resolves a birth place before payment (reused from Premium Kundli).
router.post("/geocode", geocodeValidator, validate, geocodeBirthPlace);

// Full guest checkout — no login/OTP required, same pattern as Premium Kundli.
router.post("/order", optionalAuth, createOrderValidator, validate, createOrder);
router.post("/payment/verify", optionalAuth, verifyPaymentValidator, validate, verifyPayment);

// DEV-ONLY — bypasses Razorpay entirely, gated independently of Premium
// Kundli's SKIP_KUNDLI_PAYMENT via its own TEST_MODE env flag (see
// devGenerateHoroscope's own server-side guard).
router.post("/generate", optionalAuth, createOrderValidator, validate, devGenerateHoroscope);

module.exports = router;
