/**
 * Rate Limiter Middleware for WhereIsMyBag API
 *
 * Implements sliding window in-memory rate limiting to protect
 * authentication and verification endpoints against brute-force attacks.
 *
 * Reference: CONTRACT.md Section 2 & Requirement 7
 */

'use strict';

/**
 * Creates an in-memory rate limiter middleware instance.
 *
 * @param {Object} [options={}]
 * @param {number} [options.windowMs=60000] - Window size in milliseconds (default 1 min)
 * @param {number} [options.max=10] - Max requests allowed per window per IP
 * @param {string} [options.message] - Custom error message
 * @returns {Function} Express middleware function
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60000;
  const max = options.max || 10;
  const message =
    options.message ||
    'Too many verification attempts. Please wait a minute before trying again.';

  // Map of client IP -> Array of timestamps
  const hitsMap = new Map();

  // Periodic cleanup of stale IP records every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hitsMap.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        hitsMap.delete(ip);
      } else {
        hitsMap.set(ip, valid);
      }
    }
  }, 5 * 60 * 1000);

  // Prevent cleanup interval from holding process open in tests
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  function rateLimiter(req, res, next) {
    // Extract client IP address cleanly
    const clientIp =
      req.ip ||
      (req.headers['x-forwarded-for']
        ? String(req.headers['x-forwarded-for']).split(',')[0].trim()
        : '127.0.0.1');

    const now = Date.now();
    const timestamps = hitsMap.get(clientIp) || [];

    // Filter out timestamps outside the current window
    const windowHits = timestamps.filter((t) => now - t < windowMs);

    if (windowHits.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          details: null
        }
      });
    }

    // Record current hit
    windowHits.push(now);
    hitsMap.set(clientIp, windowHits);

    next();
  }

  // Expose reset helper for tests
  rateLimiter.reset = () => {
    hitsMap.clear();
  };

  return rateLimiter;
}

// Default verify rate limiter: max 10 verification attempts per minute per IP
const verifyRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many verification attempts. Please wait a minute before trying again.'
});

module.exports = {
  createRateLimiter,
  verifyRateLimiter
};
