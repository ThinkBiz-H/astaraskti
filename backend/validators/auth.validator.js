const { body } = require("express-validator");
const {
  passwordPolicyValidator,
  passwordPolicyMessage,
} = require("../utils/passwordPolicy");

const registerValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("mobile")
    .optional()
    .isLength({ min: 10, max: 15 })
    .withMessage("Valid mobile number required"),
  body("password")
    .custom(passwordPolicyValidator)
    .withMessage(passwordPolicyMessage),
];

const loginValidator = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const forgotPasswordValidator = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
];

const resetPasswordValidator = [
  body("password")
    .custom(passwordPolicyValidator)
    .withMessage(passwordPolicyMessage),
];

const changePasswordValidator = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .custom(passwordPolicyValidator)
    .withMessage(passwordPolicyMessage),
];

// const verifyOtpValidator = [
//   body("email")
//     .isEmail()
//     .withMessage("Valid email is required")
//     .normalizeEmail(),
//   body("otp").isLength({ min: 4, max: 6 }).withMessage("Valid OTP is required"),
// ];
const verifyOtpValidator = [
  body("mobile")
    .trim()
    .notEmpty()
    .withMessage("Mobile number is required")
    .isLength({ min: 10, max: 15 })
    .withMessage("Valid mobile number is required"),

  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),
];
const checkMobileValidator = [
  body("mobile")
    .trim()
    .notEmpty()
    .withMessage("Mobile number is required")
    .isLength({ min: 10, max: 15 })
    .withMessage("Valid mobile number is required"),
];

// Phase 7 — Mobile OTP auth
const mobileRegisterValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("mobile")
    .isLength({ min: 10, max: 15 })
    .withMessage("Valid mobile number is required"),
];

const mobileLoginValidator = [
  body("mobile")
    .isLength({ min: 10, max: 15 })
    .withMessage("Valid mobile number is required"),
];

const mobileVerifyOtpValidator = [
  body("mobile")
    .isLength({ min: 10, max: 15 })
    .withMessage("Valid mobile number is required"),
  body("otp").isLength({ min: 4, max: 6 }).withMessage("Valid OTP is required"),
];

// Unified mobile-only OTP auth (astrology site): a single "enter mobile,
// get OTP" step with no separate register/login choice. Verification reuses
// mobileVerifyOtpValidator above since the shape (mobile + otp) is identical.
const requestOtpValidator = [
  body("mobile")
    .isLength({ min: 10, max: 15 })
    .withMessage("Valid mobile number is required"),
];
const forgotPasswordMobileValidator = [
  body("mobile")
    .isLength({ min: 10, max: 15 })
    .withMessage("Valid mobile number is required"),
];

const verifyResetOtpValidator = [
  body("mobile")
    .isLength({ min: 10, max: 15 })
    .withMessage("Valid mobile number is required"),

  body("otp")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),
];

const resetPasswordMobileValidator = [
  body("mobile")
    .isLength({ min: 10, max: 15 }),

  body("otp")
    .isLength({ min: 6, max: 6 }),

  body("password")
    .custom(passwordPolicyValidator)
    .withMessage(passwordPolicyMessage),
];
module.exports = {
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
};
