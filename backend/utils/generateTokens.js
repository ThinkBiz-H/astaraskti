const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const sessionService = require("../services/session.service");

// .env.example documents separate access/refresh secrets, but this file
// previously only ever read JWT_SECRET for both — fixed here to actually
// use the split secrets when configured (limits blast radius if one leaks),
// while falling back to the shared JWT_SECRET so any existing deployment
// that only has that one set keeps working unchanged.
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

const generateAccessToken = (payload) => {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRE || "15m",
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || "30d",
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET);
};

const cookieOptionsFor = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: (Number(process.env.COOKIE_EXPIRE_DAYS) || 30) * 24 * 60 * 60 * 1000,
});

/**
 * Generates access + refresh tokens for a user and creates a Session
 * document to back them (Phase 7 — replaces the old single
 * `user.refreshToken` field, which only supported one active login at a
 * time). The JWT payload embeds the session id (`sid`) so refresh/logout
 * can identify exactly which device session a token belongs to.
 *
 * `deviceInfo` is optional so every existing call site keeps working
 * unchanged — omitting it just means the session is recorded with an
 * empty userAgent/ip.
 */
const issueTokens = async (user, res, deviceInfo = {}) => {
  const sessionId = new mongoose.Types.ObjectId();
  const payload = { id: user._id, role: user.role, sid: sessionId.toString() };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await sessionService.createSession({
    id: sessionId,
    userId: user._id,
    refreshToken,
    userAgent: deviceInfo.userAgent || "",
    ip: deviceInfo.ip || "",
  });

  res.cookie("refreshToken", refreshToken, cookieOptionsFor());

  return { accessToken, refreshToken, sessionId: sessionId.toString() };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokens,
  cookieOptionsFor,
};
