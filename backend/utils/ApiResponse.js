/**
 * Standard response shape used across the entire API:
 * { success, message, data, error }
 */
class ApiResponse {
  constructor(statusCode, data = {}, message = 'Success') {
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
    this.error = null;
  }
}

const sendResponse = (res, statusCode, data, message) => {
  return res.status(statusCode).json(new ApiResponse(statusCode, data, message));
};

module.exports = { ApiResponse, sendResponse };
