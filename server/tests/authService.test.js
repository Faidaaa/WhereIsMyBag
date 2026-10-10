const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  createVerificationToken,
  validateToken,
  _clearAllTokens
} = require('../src/services/authService');

describe('Auth Service - Verification Token Lifecycle', () => {
  beforeEach(() => {
    _clearAllTokens();
  });

  test('generates token with correct vtok_<tagNumber>_<hex> prefix and format', () => {
    const { token, expiresAt } = createVerificationToken({
      tagNumber: '0123456789',
      pnr: 'WIMB01',
      surname: 'SMITH'
    });

    assert.ok(token.startsWith('vtok_0123456789_'), 'Token must start with vtok_<tagNumber>_');
    assert.ok(new Date(expiresAt).getTime() > Date.now(), 'Token must expire in the future');
  });

  test('validates valid token matching tagNumber', () => {
    const { token } = createVerificationToken({
      tagNumber: '0123456789',
      pnr: 'WIMB01',
      surname: 'SMITH'
    });

    const validation = validateToken(token, '0123456789');
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.tokenData.tagNumber, '0123456789');
  });

  test('rejects token when used for a different tag number (TOKEN_BAG_MISMATCH)', () => {
    const { token } = createVerificationToken({
      tagNumber: '0123456789',
      pnr: 'WIMB01',
      surname: 'SMITH'
    });

    const validation = validateToken(token, '0987654321');
    assert.strictEqual(validation.valid, false);
    assert.strictEqual(validation.errorCode, 'TOKEN_BAG_MISMATCH');
  });

  test('rejects missing or malformed token (MISSING_OR_EXPIRED_TOKEN)', () => {
    const emptyValidation = validateToken(null);
    assert.strictEqual(emptyValidation.valid, false);
    assert.strictEqual(emptyValidation.errorCode, 'MISSING_OR_EXPIRED_TOKEN');

    const malformedValidation = validateToken('invalid_token_format');
    assert.strictEqual(malformedValidation.valid, false);
    assert.strictEqual(malformedValidation.errorCode, 'MISSING_OR_EXPIRED_TOKEN');
  });
});
