/**
 * Integration & Unit Tests: Passenger Verification API & Token Lifecycle
 * (server/tests/authVerification.test.js)
 *
 * Verifies that:
 *  1. POST /api/verify succeeds with valid credentials (CONTRACT.md Section 3.1 & 6)
 *  2. Verification tokens are cryptographically secure and scoped to the tag number
 *  3. Verification failure handling uses generic 401 response (Requirement 6)
 *  4. Invalid inputs (bad tag format, bad PNR format) return 400 INVALID_INPUT
 *  5. Expired tokens return 401 MISSING_OR_EXPIRED_TOKEN
 *  6. Attempting to access another bag tag returns 403 TOKEN_BAG_MISMATCH
 *  7. Verification attempts are protected by rate limiting (Requirement 7)
 *  8. Sensitive credentials and tokens are masked from logging (Requirement 8)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const {
  createVerificationToken,
  validateToken,
  _clearAllTokens
} = require('../src/services/authService');
const { createRateLimiter } = require('../src/middleware/rateLimiter');
const { sanitizeRequestForLog } = require('../src/middleware/authMiddleware');

let server;
let baseUrl;

test.before(() => {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(() => {
  return new Promise((resolve) => {
    if (server) {
      server.close(resolve);
    } else {
      resolve();
    }
  });
});

test.beforeEach(() => {
  _clearAllTokens();
});

function postJson(urlPath, payload) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(urlPath, baseUrl);
    const postData = JSON.stringify(payload);

    const req = http.request(
      fullUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const bodyText = Buffer.concat(chunks).toString('utf-8');
          let json = null;
          try {
            json = JSON.parse(bodyText);
          } catch (_) {}
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: json,
            rawBody: bodyText
          });
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getAuth(urlPath, token) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(urlPath, baseUrl);
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(fullUrl, { method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const bodyText = Buffer.concat(chunks).toString('utf-8');
        let json = null;
        try {
          json = JSON.parse(bodyText);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json,
          rawBody: bodyText
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ============================================================================
// PART 1: Successful Passenger Verification
// ============================================================================

test('POST /api/verify succeeds with CONTRACT.md credentials (0123456789 / SMITH / WIMB01)', async () => {
  const res = await postJson('/api/verify', {
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'WIMB01'
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);

  const data = res.body.data;
  assert(data.verificationToken.startsWith('vtok_0123456789_'));
  assert(data.verificationToken.length >= 30, 'Token must contain cryptographically secure payload');
  assert(data.expiresAt.endsWith('Z'), 'expiresAt must be ISO string');

  assert.equal(data.bag.tagNumber, '0123456789');
  assert.equal(data.bag.passengerSurname, 'SMITH');
  assert.equal(data.bag.pnr, 'WIMB01');
  assert.equal(data.bag.passengerFullName, 'John Smith');
  assert.equal(data.bag.origin, 'LHR');
  assert.equal(data.bag.destination, 'JFK');
});

test('POST /api/verify succeeds with fixture credentials (0055123456 / OKAFOR / NBFX01)', async () => {
  const res = await postJson('/api/verify', {
    tagNumber: '0055123456',
    surname: 'OKAFOR',
    pnr: 'NBFX01'
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert(res.body.data.verificationToken.startsWith('vtok_0055123456_'));
  assert.equal(res.body.data.bag.passengerFullName, 'Chidi Okafor');
});

// ============================================================================
// PART 2: Generic Verification Failure & Privacy Handling (Requirement 6)
// ============================================================================

test('POST /api/verify returns generic 401 error on wrong surname', async () => {
  const res = await postJson('/api/verify', {
    tagNumber: '0123456789',
    surname: 'WRONGSURNAME',
    pnr: 'WIMB01'
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VERIFICATION_FAILED');
  assert(res.body.error.message.includes('Surname or PNR does not match'));
});

test('POST /api/verify returns generic 401 error on wrong PNR', async () => {
  const res = await postJson('/api/verify', {
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'WRONG1'
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VERIFICATION_FAILED');
});

test('POST /api/verify returns generic 401 error on unknown tag number', async () => {
  const res = await postJson('/api/verify', {
    tagNumber: '9999999999',
    surname: 'SMITH',
    pnr: 'WIMB01'
  });

  // Requirement 6: Generic response that does not reveal if booking or tag exists
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VERIFICATION_FAILED');
});

// ============================================================================
// PART 3: Input Validation
// ============================================================================

test('POST /api/verify rejects malformed tagNumber (not 10 digits)', async () => {
  const res = await postJson('/api/verify', {
    tagNumber: '12345',
    surname: 'SMITH',
    pnr: 'WIMB01'
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_INPUT');
  assert(res.body.error.message.includes('10 numeric digits'));
});

test('POST /api/verify rejects malformed PNR (not 6 alphanumeric chars)', async () => {
  const res = await postJson('/api/verify', {
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'INVALID_PNR_TOO_LONG'
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_INPUT');
  assert(res.body.error.message.includes('6 alphanumeric'));
});

// ============================================================================
// PART 4: Token Expiration & Tag Scoping (Requirements 3, 4, 5)
// ============================================================================

test('Expired verification token returns 401 MISSING_OR_EXPIRED_TOKEN', async () => {
  // Create an expired token directly
  const { token } = createVerificationToken({
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'WIMB01',
    expiresInMs: -1000 // Expired 1 second ago
  });

  const res = await getAuth('/api/bags/0123456789/timeline', token);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'MISSING_OR_EXPIRED_TOKEN');
});

test('Token issued for tag A cannot be used to access tag B (403 TOKEN_BAG_MISMATCH)', async () => {
  // Issue token for tag 0123456789
  const { token } = createVerificationToken({
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'WIMB01'
  });

  // Attempt to access timeline for tag 0055123456 with tag 0123456789's token
  const res = await getAuth('/api/bags/0055123456/timeline', token);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'TOKEN_BAG_MISMATCH');
  assert(res.body.error.message.includes('issued for a different baggage tag'));
});

test('Valid token allows access to matching baggage timeline', async () => {
  const { token } = createVerificationToken({
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'WIMB01'
  });

  const res = await getAuth('/api/bags/0123456789/timeline', token);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.tagNumber, '0123456789');
});

// ============================================================================
// PART 5: Rate Limiting (Requirement 7)
// ============================================================================

test('Rate limiter blocks excessive verification attempts with 429 RATE_LIMIT_EXCEEDED', async () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 3 });

  let blockedCount = 0;
  let successCount = 0;

  const mockReq = { ip: '192.168.1.100', headers: {} };

  for (let i = 0; i < 5; i++) {
    const mockRes = {
      setHeader: () => {},
      status: (code) => {
        if (code === 429) blockedCount++;
        return {
          json: (data) => {
            assert.equal(data.error.code, 'RATE_LIMIT_EXCEEDED');
          }
        };
      }
    };

    let nextCalled = false;
    limiter(mockReq, mockRes, () => {
      nextCalled = true;
      successCount++;
    });
  }

  assert.equal(successCount, 3, 'First 3 requests should pass');
  assert.equal(blockedCount, 2, 'Subsequent 2 requests should be rate limited');
});

// ============================================================================
// PART 6: Sensitive Credential Masking (Requirement 8)
// ============================================================================

test('sanitizeRequestForLog masks sensitive fields from request log metadata', () => {
  const mockReq = {
    method: 'POST',
    originalUrl: '/api/verify',
    ip: '127.0.0.1',
    headers: { authorization: 'Bearer vtok_0123456789_abcdef' },
    body: {
      tagNumber: '0123456789',
      surname: 'SMITH',
      pnr: 'WIMB01'
    }
  };

  const safeLog = sanitizeRequestForLog(mockReq);

  assert.equal(safeLog.method, 'POST');
  assert.equal(safeLog.path, '/api/verify');
  assert.equal(safeLog.hasAuthToken, true);

  // Must not expose surname, pnr, or raw token string
  assert.equal(safeLog.surname, undefined);
  assert.equal(safeLog.pnr, undefined);
  assert.equal(safeLog.verificationToken, undefined);
});
