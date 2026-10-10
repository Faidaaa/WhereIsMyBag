/**
 * Standard API Response Utilities
 * Reference: CONTRACT.md Section 2
 */

/**
 * Creates standard success response format.
 * @param {*} data
 * @returns {Object}
 */
function successResponse(data) {
  return {
    success: true,
    data
  };
}

/**
 * Creates standard error response format.
 * @param {string} code - Error code identifier
 * @param {string} message - Human-readable error description
 * @param {*} [details=null] - Additional error details
 * @returns {Object}
 */
function errorResponse(code, message, details = null) {
  return {
    success: false,
    error: {
      code,
      message,
      details
    }
  };
}

module.exports = {
  successResponse,
  errorResponse
};
