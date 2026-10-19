const { v4: uuidv4 } = require('uuid');

/**
 * Attaches a unique id to every request (req.id) and echoes it back as
 * X-Request-Id — lets a client/support ticket reference one id that a log
 * search can then find every line for. Controllers can optionally include
 * req.id in a logger call for correlation; not retrofitted into every
 * existing log line across the codebase (that's mechanical, not done here).
 */
const requestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
};

module.exports = requestId;
