const express = require("express");
const router = express.Router();

const {
  register,
  verifyOtp,
  resendOtp,
  login,
  logout,
  logoutAllDevices,
  getSessions,
  revokeSessionById,
  getLoginHistory,
  refreshAccessToken,
  mobileRegister,
  mobileLoginRequestOtp,
  mobileVerifyOtp,
  resendMobileOtp,
  requestOtp,
  checkMobile,
  verifyOtpUnified,
  forgotPassword,
  resetPassword,
  forgotPasswordMobile,
  verifyResetOtp,
  resetPasswordMobile,
  changePassword,
  getMe,
} = require("../controllers/auth.controller");

const { protect } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  authLimiter,
  otpLimiter,
} = require("../middlewares/rateLimiter.middleware");

const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  verifyOtpValidator,
  checkMobileValidator,
  mobileRegisterValidator,
  mobileLoginValidator,
  mobileVerifyOtpValidator,
  forgotPasswordMobileValidator,
  verifyResetOtpValidator,
  resetPasswordMobileValidator,
  requestOtpValidator,
} = require("../validators/auth.validator");

// Existing email/password + email-OTP-verification flow — unchanged
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new account with email + password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               mobile: { type: string }
 *               password: { type: string, format: password, description: "Min 8 chars, at least one letter and one number" }
 *     responses:
 *       201: { description: Account created, verification OTP sent }
 *       422: { description: Validation failed }
 */
router.post("/register", authLimiter, registerValidator, validate, register);
router.post(
  "/verify-otp",
  authLimiter,
  verifyOtpValidator,
  validate,
  verifyOtp,
);
router.post("/resend-otp", authLimiter, resendOtp);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email + password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Login successful — accessToken in body, refresh token set as httpOnly cookie
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *       401: { description: Invalid credentials }
 *       423: { description: Account temporarily locked after too many failed attempts }
 */
router.post("/login", authLimiter, loginValidator, validate, login);
router.post("/logout", protect, logout);
/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Rotate the refresh token (read from httpOnly cookie) and issue a new access token
 *     tags: [Auth]
 *     responses:
 *       200: { description: New accessToken issued }
 *       401: { description: Refresh token missing, expired, or revoked }
 */
router.post("/refresh-token", refreshAccessToken);
router.post(
  "/forgot-password",
  authLimiter,
  forgotPasswordValidator,
  validate,
  forgotPassword,
);

router.post(
  "/forgot-password/mobile",
  authLimiter,
  forgotPasswordMobileValidator,
  validate,
  forgotPasswordMobile,
);

router.post(
  "/forgot-password/verify-otp",
  authLimiter,
  verifyResetOtpValidator,
  validate,
  verifyResetOtp,
);

router.post(
  "/reset-password/mobile",
  authLimiter,
  resetPasswordMobileValidator,
  validate,
  resetPasswordMobile,
);
router.post(
  "/reset-password/:token",
  authLimiter,
  resetPasswordValidator,
  validate,
  resetPassword,
);
router.post(
  "/change-password",
  protect,
  changePasswordValidator,
  validate,
  changePassword,
);
router.get("/me", protect, getMe);

// ---------- Unified mobile-only OTP auth (astrology site primary flow) ----------
// Enter mobile -> OTP sent -> verify -> auto-registers on first use, logs in
// on every subsequent use. No password, no separate register screen.
/**
 * @swagger
 * /auth/otp/request:
 *   post:
 *     summary: Request an OTP for a mobile number (auto-creates the account on first use)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile]
 *             properties:
 *               mobile: { type: string }
 *     responses:
 *       200: { description: OTP sent }
 */
router.post("/otp/request", otpLimiter, requestOtpValidator, validate, requestOtp);
/**
 * @swagger
 * /auth/check-mobile:
 *   post:
 *     summary: Check whether a mobile number is already registered (no OTP sent)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile]
 *             properties:
 *               mobile: { type: string }
 *     responses:
 *       200: { description: "{ exists: boolean }" }
 */
router.post("/check-mobile", authLimiter, checkMobileValidator, validate, checkMobile);
/**
 * @swagger
 * /auth/otp/verify:
 *   post:
 *     summary: Verify the OTP and log in (or complete first-time registration)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile, otp]
 *             properties:
 *               mobile: { type: string }
 *               otp: { type: string }
 *     responses:
 *       200: { description: Logged in — accessToken in body, refresh token set as httpOnly cookie }
 */
router.post(
  "/otp/verify",
  authLimiter,
  mobileVerifyOtpValidator,
  validate,
  verifyOtpUnified,
);

// Phase 7 — Mobile OTP authentication (the new primary customer mechanism)
router.post(
  "/mobile/register",
  otpLimiter,
  mobileRegisterValidator,
  validate,
  mobileRegister,
);
router.post(
  "/mobile/login",
  otpLimiter,
  mobileLoginValidator,
  validate,
  mobileLoginRequestOtp,
);
router.post(
  "/mobile/verify",
  authLimiter,
  mobileVerifyOtpValidator,
  validate,
  mobileVerifyOtp,
);
router.post(
  "/mobile/resend-otp",
  otpLimiter,
  mobileLoginValidator,
  validate,
  resendMobileOtp,
);

// Phase 7 — Device sessions & login history
router.post("/logout-all", protect, logoutAllDevices);
router.get("/sessions", protect, getSessions);
router.delete("/sessions/:id", protect, revokeSessionById);
router.get("/login-history", protect, getLoginHistory);

module.exports = router;
