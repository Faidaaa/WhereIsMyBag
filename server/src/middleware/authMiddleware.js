/**
 * Reusable Authentication & Token Enforcement Middleware
 *
 * Validates bearer tokens and query parameter tokens, enforces tag-scoped
 * authorization, and prevents logging sensitive passenger credentials.
 *
 * Reference: CONTRACT.md Section 3.2, 3.3, 6 & Requirement 4, 8, 9
 */

'use strict';

const { validateToken } = require('../services/authService');

/**
 * Helper to extract verification token from Authorization header or query params.
 *
 * @param {Object} req - Express request
 * @returns {string|null} Token string or null if absent
 */
function extractToken(req) {
  // 1. Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Check query parameter ?token=<token> (used for SSE EventSource streams)
  if (req.query && req.query.token && typeof req.query.token === 'string') {
    return req.query.token.trim();
  }

  return null;
}

/**
 * Reusable Express middleware to require a valid verification token scoped to a bag tag.
 *
 * Expects `req.params.tagNumber` or `req.body.tagNumber` to enforce tag scoping.
 */
function requireTagAuth(req, res, next) {
  const token = extractToken(req);
  const targetTagNumber = req.params.tagNumber || (req.body ? req.body.tagNumber : null);

  const auth = validateToken(token, targetTagNumber);

  if (!auth.valid) {
    const statusCode = auth.errorCode === 'TOKEN_BAG_MISMATCH' ? 403 : 401;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: auth.errorCode,
        message: auth.errorMessage,
        details: null
      }
    });
  }

  // Attach token payload to request for downstream handlers
  req.userToken = auth.tokenData;
  next();
}

/**
 * Sanitizes request object for logging purposes (Requirement 8).
 * Never logs passenger credentials, surname, PNR, tokens, or passwords.
 *
 * @param {Object} req
 * @returns {Object} Safe log metadata
 */
function sanitizeRequestForLog(req) {
  return {
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip,
    hasAuthToken: Boolean(extractToken(req))
  };
}

module.exports = {
  extractToken,
  requireTagAuth,
  sanitizeRequestForLog
};
