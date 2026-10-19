/** Real policy check, usable outside express-validator too (e.g. in a service). */
const isStrongPassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) return false;
  if (!/[A-Za-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
};

const passwordPolicyMessage = 'Password must be at least 8 characters and include at least one letter and one number';

/** express-validator custom() validator function. */
const passwordPolicyValidator = (value) => isStrongPassword(value);

module.exports = { isStrongPassword, passwordPolicyMessage, passwordPolicyValidator };
