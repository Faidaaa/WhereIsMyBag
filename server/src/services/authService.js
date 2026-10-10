/**
 * Authentication and Verification Token Lifecycle Service
 * Reference: CONTRACT.md Section 6
 */

const crypto = require('crypto');

// In-memory token store for prototype: tokenString -> { tagNumber, pnr, surname, expiresAt }
const tokenStore = new Map();

const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

/**
 * Generates and stores a verification token bound to the passenger credentials.
 * Format: vtok_<tagNumber>_<randomHexString>
 *
 * @param {Object} params
 * @param {string} params.tagNumber
 * @param {string} params.pnr
 * @param {string} params.surname
 * @returns {{ token: string, expiresAt: string }}
 */
function createVerificationToken({ tagNumber, pnr, surname }) {
  const randomHex = crypto.randomBytes(6).toString('hex');
  const token = `vtok_${tagNumber}_${randomHex}`;
  const expiresAtDate = new Date(Date.now() + TOKEN_LIFETIME_MS);
  const expiresAt = expiresAtDate.toISOString();

  tokenStore.set(token, {
    tagNumber,
    pnr: pnr.toUpperCase(),
    surname: surname.toUpperCase(),
    expiresAt: expiresAtDate.getTime()
  });

  return { token, expiresAt };
}

/**
 * Validates a verification token.
 *
 * @param {string} token - Token string to validate
 * @param {string} [expectedTagNumber] - Optional tag number to check for mismatch
 * @returns {{ valid: boolean, errorCode?: string, errorMessage?: string, tokenData?: Object }}
 */
function validateToken(token, expectedTagNumber) {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      errorCode: 'MISSING_OR_EXPIRED_TOKEN',
      errorMessage: 'Verification token is required.'
    };
  }

  // Token must start with vtok_
  if (!token.startsWith('vtok_')) {
    return {
      valid: false,
      errorCode: 'MISSING_OR_EXPIRED_TOKEN',
      errorMessage: 'Invalid verification token format.'
    };
  }

  const tokenData = tokenStore.get(token);
  if (!tokenData) {
    return {
      valid: false,
      errorCode: 'MISSING_OR_EXPIRED_TOKEN',
      errorMessage: 'Verification token is invalid or expired.'
    };
  }

  if (Date.now() > tokenData.expiresAt) {
    tokenStore.delete(token);
    return {
      valid: false,
      errorCode: 'MISSING_OR_EXPIRED_TOKEN',
      errorMessage: 'Verification token has expired. Please verify again.'
    };
  }

  // Check tag mismatch if expectedTagNumber is provided
  if (expectedTagNumber && tokenData.tagNumber !== expectedTagNumber) {
    return {
      valid: false,
      errorCode: 'TOKEN_BAG_MISMATCH',
      errorMessage: 'Token was issued for a different baggage tag.'
    };
  }

  return {
    valid: true,
    tokenData
  };
}

/**
 * Clears expired tokens to keep memory clean.
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (now > data.expiresAt) {
      tokenStore.delete(token);
    }
  }
}

/**
 * Helper to reset token store (used in tests)
 */
function _clearAllTokens() {
  tokenStore.clear();
}

module.exports = {
  createVerificationToken,
  validateToken,
  cleanupExpiredTokens,
  _clearAllTokens
};
