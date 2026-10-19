const crypto = require('crypto');

/**
 * Generates a numeric OTP of the given length (default 6 digits).
 */
const generateOtp = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[crypto.randomInt(0, digits.length)];
  }
  return otp;
};

/**
 * Generates a secure random token (used for password reset / email verification links).
 */
const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { generateOtp, generateSecureToken, hashToken };
