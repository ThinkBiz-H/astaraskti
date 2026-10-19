/**
 * Wraps an async controller/middleware function and forwards any
 * thrown errors to Express's next() so the centralized error
 * handler can process them.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
