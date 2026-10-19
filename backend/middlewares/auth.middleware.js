const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/generateTokens');
const User = require('../models/User');

/**
 * Protects routes - requires a valid access token
 * Token can come from Authorization header (Bearer) or cookie.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw new ApiError(401, 'Not authorized, no access token provided');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    throw new ApiError(401, 'Not authorized, token failed or expired');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, 'User belonging to this token no longer exists');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated');
  }

  req.user = user;
  req.sessionId = decoded.sid || null;
  next();
});

/**
 * Restrict access to specific roles.
 * Usage: authorize('admin') or authorize('admin', 'user')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, `Role '${req.user ? req.user.role : 'guest'}' is not authorized to access this resource`));
    }
    next();
  };
};

/**
 * Like `protect`, but never rejects — populates `req.user` when a valid
 * token is present, otherwise leaves it undefined and continues. Used on
 * public routes that show extra data to a logged-in admin (e.g. "include
 * inactive items when ?all=true") without requiring auth for everyone else.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id);
    if (user && user.isActive) {
      req.user = user;
      req.sessionId = decoded.sid || null;
    }
  } catch (error) {
    // Invalid/expired token on an optional-auth route — treat as anonymous.
  }

  next();
});

module.exports = { protect, authorize, optionalAuth };
