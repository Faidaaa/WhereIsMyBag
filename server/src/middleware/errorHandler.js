/**
 * Centralized Error & Not Found Handling Middleware
 * Reference: CONTRACT.md Section 2
 */

const { errorResponse } = require('../utils/response');

/**
 * Safe 404 handler for unknown endpoints.
 */
function notFoundHandler(req, res) {
  res.status(404).json(
    errorResponse(
      'ROUTE_NOT_FOUND',
      `The requested endpoint ${req.originalUrl} does not exist.`
    )
  );
}

/**
 * Centralized application error handler.
 */
function errorHandler(err, req, res, next) {
  console.error('[Application Error]:', err);

  const status = typeof err.status === 'number' ? err.status : 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred.';
  const details = process.env.NODE_ENV === 'development' ? err.stack : null;

  res.status(status).json(errorResponse(code, message, details));
}

module.exports = {
  notFoundHandler,
  errorHandler
};
