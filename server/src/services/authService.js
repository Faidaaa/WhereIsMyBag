/**
 * Authentication and Verification Token Lifecycle Service
 * Reference: CONTRACT.md Section 6 & Requirement 3, 4, 5
 */

'use strict';

const crypto = require('crypto');

// In-memory token store: tokenString -> { tagNumber, pnr, surname, expiresAt }
const tokenStore = new Map();

const DEFAULT_TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000; // 2 hours (120 min) per CONTRACT.md Section 6

/**
 * Generates and stores a cryptographically secure verification token bound to passenger credentials.
 * Format per CONTRACT.md Section 6: vtok_<tagNumber>_<randomHexString>
 *
 * @param {Object} params
 * @param {string} params.tagNumber - Exact 10-digit baggage tag string
 * @param {string} params.pnr - 6-character PNR string
 * @param {string} params.surname - Passenger surname string
 * @param {number} [params.expiresInMs] - Custom lifetime in ms (optional, used in tests)
 * @returns {{ token: string, expiresAt: string }}
 */
function createVerificationToken({ tagNumber, pnr, surname, expiresInMs }) {
  const sanitizedTag = String(tagNumber || '').trim();
  const sanitizedPnr = String(pnr || '').trim().toUpperCase();
  const sanitizedSurname = String(surname || '').trim().toUpperCase();

  // Cryptographically secure 16-byte random hex string
  const randomHex = crypto.randomBytes(16).toString('hex');
  const token = `vtok_${sanitizedTag}_${randomHex}`;

  const lifetime = typeof expiresInMs === 'number' ? expiresInMs : DEFAULT_TOKEN_LIFETIME_MS;
  const expiresAtDate = new Date(Date.now() + lifetime);
  const expiresAtISO = expiresAtDate.toISOString();

  tokenStore.set(token, {
    tagNumber: sanitizedTag,
    pnr: sanitizedPnr,
    surname: sanitizedSurname,
    issuedAt: Date.now(),
    expiresAt: expiresAtDate.getTime()
  });

  return {
    token,
    expiresAt: expiresAtISO
  };
}

/**
 * Validates a verification token against tag scoping and expiration rules.
 *
 * @param {string} token - Token string to validate
 * @param {string} [expectedTagNumber] - Tag number expected for tag-scoped authorization
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

  const sanitizedToken = token.trim();

  // Must start with vtok_
  if (!sanitizedToken.startsWith('vtok_')) {
    return {
      valid: false,
      errorCode: 'MISSING_OR_EXPIRED_TOKEN',
      errorMessage: 'Invalid verification token format.'
    };
  }

  const tokenData = tokenStore.get(sanitizedToken);
  if (!tokenData) {
    return {
      valid: false,
      errorCode: 'MISSING_OR_EXPIRED_TOKEN',
      errorMessage: 'Verification token is invalid or expired.'
    };
  }

  // Check expiration
  if (Date.now() > tokenData.expiresAt) {
    tokenStore.delete(sanitizedToken);
    return {
      valid: false,
      errorCode: 'MISSING_OR_EXPIRED_TOKEN',
      errorMessage: 'Verification token has expired. Please verify again.'
    };
  }

  // Requirement 4: Enforce tag scoping to prevent token misuse on other bags
  if (expectedTagNumber) {
    const sanitizedExpectedTag = String(expectedTagNumber).trim();
    if (tokenData.tagNumber !== sanitizedExpectedTag) {
      return {
        valid: false,
        errorCode: 'TOKEN_BAG_MISMATCH',
        errorMessage: 'Verification token was issued for a different baggage tag.'
      };
    }
  }

  return {
    valid: true,
    tokenData
  };
}

/**
 * Sweeps and clears expired tokens from memory to prevent memory leaks.
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
 * Test helper to clear token store
 */
function _clearAllTokens() {
  tokenStore.clear();
}

module.exports = {
  createVerificationToken,
  validateToken,
  cleanupExpiredTokens,
  _clearAllTokens,
  DEFAULT_TOKEN_LIFETIME_MS
};
