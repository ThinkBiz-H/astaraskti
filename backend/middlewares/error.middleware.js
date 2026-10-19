const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

/* eslint-disable no-unused-vars */
const errorMiddleware = (err, req, res, next) => {
  console.error("\n========== ERROR ==========");
  console.error(err);
  console.error(err.stack);
  console.error("===========================\n");

  let error = err;

  if (!(error instanceof ApiError)) {
    let statusCode = error.statusCode || 500;
    let message = error.message || "Internal Server Error";

    if (error.name === "CastError") {
      statusCode = 400;
      message = `Resource not found. Invalid: ${error.path}`;
    }

    if (error.code === 11000) {
      statusCode = 409;
      const field = Object.keys(error.keyValue || {}).join(", ");
      message = `Duplicate value entered for field: ${field}`;
    }

    if (error.name === "ValidationError") {
      statusCode = 400;
      message = Object.values(error.errors)
        .map((e) => e.message)
        .join(", ");
    }

    if (error.name === "JsonWebTokenError") {
      statusCode = 401;
      message = "Invalid token. Please log in again";
    }

    if (error.name === "TokenExpiredError") {
      statusCode = 401;
      message = "Token expired. Please log in again";
    }

    error = new ApiError(statusCode, message, error.errors || [], err.stack);
  }

  logger.error(
    `[${req.id || "NO-ID"}] ${req.method} ${req.originalUrl} - ${
      error.statusCode
    } - ${error.message}`,
  );

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    data: null,
    error: {
      requestId: req.id || null,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      details:
        process.env.NODE_ENV === "development" ? error.errors : undefined,
    },
  });
};

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found - ${req.originalUrl}`));
};

module.exports = {
  errorMiddleware,
  notFound,
};
