const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const addressSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Home", "Office", "Other"], default: "Home" },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true, default: "India" },
    pincode: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      // Optional: mobile-OTP-only accounts (Phase 7) may have no email at
      // registration time — email stays available for future notifications
      // per the original requirement, but is no longer a hard requirement
      // to create an account. The existing email/password register/login
      // routes still require it via their own validators, unchanged.
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    mobile: { type: String, trim: true, unique: true, sparse: true },
    pushTokens: [{ type: String }],
    password: {
      type: String,
      // Not required at the schema level: mobile-OTP-only accounts (Phase 7)
      // have no password at all — OTP verification IS their auth factor.
      // The existing email/password /auth/register and /auth/login routes
      // still enforce this via registerValidator/loginValidator, unchanged.
      minlength: 6,
      select: false,
    },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    profileImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    address: [addressSchema],
    city: { type: String },
    state: { type: String },
    country: { type: String },
    pincode: { type: String },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    // Additive: most-recently-viewed products, newest first, capped at 20.
    recentlyViewed: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    cart: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          default: null,
        },
        quantity: { type: Number, default: 1, min: 1 },
        color: { type: String },
        size: { type: String },
      },
    ],
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // Empty/unset (the default for every existing admin) = full access,
    // exactly as before this field existed. Only an admin explicitly given
    // a non-empty permissions array is restricted to just those — this is
    // what keeps adding granular permissions from silently locking any
    // existing admin out of anything on deploy.
    permissions: [{ type: String }],
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    refreshToken: { type: String, select: false },

    otp: { type: String, select: false },
    otpExpire: { type: Date, select: false },

    // Phase 7 — Mobile OTP auth. Kept entirely separate from the email
    // otp/otpExpire fields above so both flows can coexist; nothing about
    // the existing email verification flow changes.
    isMobileVerified: { type: Boolean, default: false },
    mobileOtp: { type: String, select: false },
    mobileOtpExpire: { type: Date, select: false },
    mobileOtpAttempts: { type: Number, default: 0, select: false },
    mobileOtpLastSentAt: { type: Date, select: false },

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },

    emailVerificationToken: { type: String, select: false },
    emailVerificationExpire: { type: Date, select: false },
  },
  { timestamps: true },
);

// Hash password before save
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  // Password hi nahi hai (mobile OTP account), to hash mat karo
  if (!this.password) return;

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

  this.password = await bcrypt.hash(this.password, saltRounds);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false; // mobile-OTP-only account — no password to compare against
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateOtpCode = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = crypto.createHash("sha256").update(otp).digest("hex");
  this.otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};

/**
 * Same hashing pattern as generateOtpCode above, but on the separate
 * mobile fields, with an expiry pulled from env (default 5 min — shorter
 * than the email OTP's 10, since SMS OTPs are conventionally short-lived)
 * and a reset attempt counter (each verify failure increments
 * mobileOtpAttempts; see services/otp.service.js for the lockout check).
 */
userSchema.methods.generateMobileOtpCode = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES) || 5;
  this.mobileOtp = crypto.createHash("sha256").update(otp).digest("hex");
  this.mobileOtpExpire = Date.now() + expiryMinutes * 60 * 1000;
  this.mobileOtpAttempts = 0;
  this.mobileOtpLastSentAt = Date.now();
  return otp;
};

userSchema.methods.generateResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
  return resetToken;
};

userSchema.methods.generateEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

module.exports = mongoose.model("User", userSchema);
