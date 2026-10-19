const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const { sendSms } = require("./sms.service");

const COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60;
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;

const sendMobileOtp = async (user) => {
  if (user.mobileOtpLastSentAt) {
    const secondsSinceLastSend =
      (Date.now() - new Date(user.mobileOtpLastSentAt).getTime()) / 1000;
    if (secondsSinceLastSend < COOLDOWN_SECONDS) {
      const wait = Math.ceil(COOLDOWN_SECONDS - secondsSinceLastSend);
      throw new ApiError(
        429,
        `Please wait ${wait}s before requesting another OTP`,
      );
    }
  }

  const otp = user.generateMobileOtpCode();
  await user.save({ validateBeforeSave: false });

  await sendSms({
    to: user.mobile,
    message: `Your verification code is ${otp}. It expires in ${Number(process.env.OTP_EXPIRY_MINUTES) || 5} minutes.`,
  });
  return { expiresInMinutes: Number(process.env.OTP_EXPIRY_MINUTES) || 5 };
};

const verifyMobileOtp = async (user, submittedOtp) => {
  if (!user.mobileOtp || !user.mobileOtpExpire) {
    throw new ApiError(
      400,
      "No OTP was requested for this account. Request a new one.",
    );
  }

  if (user.mobileOtpAttempts >= MAX_ATTEMPTS) {
    user.mobileOtp = undefined;
    user.mobileOtpExpire = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(429, "Too many incorrect attempts. Request a new OTP.");
  }

  if (new Date(user.mobileOtpExpire).getTime() < Date.now()) {
    throw new ApiError(400, "OTP has expired. Request a new one.");
  }

  const hashedSubmitted = crypto
    .createHash("sha256")
    .update(String(submittedOtp))
    .digest("hex");
  if (hashedSubmitted !== user.mobileOtp) {
    user.mobileOtpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(
      400,
      `Incorrect OTP (${MAX_ATTEMPTS - user.mobileOtpAttempts} attempt(s) remaining)`,
    );
  }

  user.mobileOtp = undefined;
  user.mobileOtpExpire = undefined;
  user.mobileOtpAttempts = 0;
  user.isMobileVerified = true;
  await user.save({ validateBeforeSave: false });
};

module.exports = { sendMobileOtp, verifyMobileOtp };
