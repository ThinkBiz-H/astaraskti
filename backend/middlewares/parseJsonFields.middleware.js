const ApiError = require("../utils/ApiError");

/**
 * multer/multipart requests only support flat string fields, so any nested
 * object (e.g. `vastuDetails`, `kundliDetails`) that the client needs to send
 * alongside a file upload arrives as a JSON string. This middleware parses
 * the given field names back into objects before validation/controller
 * logic runs. No-op for fields that are absent or already objects (e.g. a
 * plain application/json request with no files).
 */
const parseJsonFields = (...fields) => (req, res, next) => {
  for (const field of fields) {
    const value = req.body[field];
    if (typeof value === "string" && value.trim() !== "") {
      try {
        req.body[field] = JSON.parse(value);
      } catch {
        return next(new ApiError(400, `${field} must be valid JSON`));
      }
    }
  }
  next();
};

module.exports = parseJsonFields;
