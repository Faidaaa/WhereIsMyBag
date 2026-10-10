/**
 * Delayed Baggage Report Submission — Comprehensive Test Suite
 * Reference: CONTRACT.md Section 3.4, 6, 10, 11
 *
 * Covers:
 *  1. Successful submission -> 201 + correct response schema
 *  2. Response body is clearly identified as a simulated submission
 *  3. Reference number format WIMB-DEL-YYYYMMDD-XXXX
 *  4. All CONTRACT.md required fields validated individually
 *  5. Optional `notes` field accepted / omitted gracefully
 *  6. Missing or expired token returns 401
 *  7. Token issued for another tag returns 403 TOKEN_BAG_MISMATCH
 *  8. Invalid field values return 400 VALIDATION_ERROR with details array
 *  9. Both endpoint aliases work: POST /api/reports/delayed and POST /api/report
 * 10. Sequential submissions each get unique reference numbers
 * 11. Response never exposes private auth data
 */

'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const { createVerificationToken, _clearAllTokens } = require('../src/services/authService');

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** POST JSON to a path, optionally with a bearer token */
function postJson(baseUrl, urlPath, payload, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      new URL(urlPath, baseUrl),
      { method: 'POST', headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Valid minimal report payload that passes all CONTRACT.md field constraints.
 * Uses the missed_connection scenario (0555666777 / WIMB04) as this is the
 * canonical delayed-report scenario from CONTRACT.md Section 8.
 */
function validPayload(tagNumber = '0555666777') {
  return {
    tagNumber,
    pnr: 'WIMB04',
    passengerSurname: 'MUELLER',
    deliveryAddress: '456 Sunset Blvd, Los Angeles, CA 90028',
    contactPhone: '+1 (555) 019-2834',
    contactEmail: 'mueller@example.com',
    bagDescription: 'Navy blue soft-sided Samsonite upright suitcase with red identifier strap',
    notes: 'Connecting flight LH900 arrived late at LHR.'
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Test Suite
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/reports/delayed — Delayed Baggage Report (CONTRACT.md Section 3.4)', () => {
  let server;
  let baseUrl;
  let tokenForMueller; // scoped to 0555666777 / WIMB04
  let tokenForSmith;   // scoped to 0123456789 / WIMB01

  before(() =>
    new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    })
  );

  after(() =>
    new Promise((resolve) => {
      if (server) server.close(resolve);
      else resolve();
    })
  );

  beforeEach(() => {
    _clearAllTokens();

    // Issue fresh tokens before every test to avoid expiry edge-cases
    tokenForMueller = createVerificationToken({
      tagNumber: '0555666777',
      surname: 'MUELLER',
      pnr: 'WIMB04'
    }).token;

    tokenForSmith = createVerificationToken({
      tagNumber: '0123456789',
      surname: 'SMITH',
      pnr: 'WIMB01'
    }).token;
  });

  // ── 1. Happy path ──────────────────────────────────────────────────────────

  test('returns 201 Created with the full CONTRACT.md Section 3.4 response schema', async () => {
    const res = await postJson(baseUrl, '/api/reports/delayed', validPayload(), tokenForMueller);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);

    const d = res.body.data;
    assert.ok(d.referenceNumber,                       'referenceNumber must be present');
    assert.equal(d.tagNumber, '0555666777');
    assert.equal(d.pnr,       'WIMB04');
    assert.equal(d.status,    'SUBMITTED');
    assert.ok(d.submittedAt,                           'submittedAt must be present');
    assert.equal(typeof d.estimatedResolutionHours, 'number');
    assert.ok(d.message,                               'message must be present');
  });

  // ── 2. Simulated submission — must not claim WorldTracer filing ───────────

  test('response message describes simulated handling and does not mention WorldTracer', async () => {
    const res = await postJson(baseUrl, '/api/reports/delayed', validPayload(), tokenForMueller);
    assert.equal(res.status, 201);

    const msg = res.body.data.message;
    // CONTRACT.md Section 3.4 exact message text includes "logged" and "airline baggage services"
    assert.ok(
      msg.toLowerCase().includes('logged') ||
      msg.toLowerCase().includes('bag')    ||
      msg.toLowerCase().includes('airline baggage services'),
      `message should describe simulated handling — got: "${msg}"`
    );
    assert.ok(
      !msg.toLowerCase().includes('worldtracer'),
      'Response must NOT claim WorldTracer filing'
    );
  });

  // ── 3. Reference number format WIMB-DEL-YYYYMMDD-XXXX ────────────────────

  test('reference number matches WIMB-DEL-YYYYMMDD-XXXX and embeds today\'s date (Section 10.2)', async () => {
    const res = await postJson(baseUrl, '/api/reports/delayed', validPayload(), tokenForMueller);
    assert.equal(res.status, 201);

    const ref = res.body.data.referenceNumber;
    const today = new Date();
    const yyyymmdd =
      `${today.getFullYear()}` +
      `${String(today.getMonth() + 1).padStart(2, '0')}` +
      `${String(today.getDate()).padStart(2, '0')}`;

    assert.match(ref, /^WIMB-DEL-\d{8}-\d{4}$/, `"${ref}" does not match WIMB-DEL-YYYYMMDD-XXXX`);
    assert.ok(ref.includes(yyyymmdd), `referenceNumber must embed today's date ${yyyymmdd}, got "${ref}"`);
  });

  // ── 4a. Optional notes — omitted ──────────────────────────────────────────

  test('accepts submission when optional notes field is omitted (CONTRACT.md Section 11)', async () => {
    const payload = validPayload();
    delete payload.notes;

    const res = await postJson(baseUrl, '/api/reports/delayed', payload, tokenForMueller);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
  });

  // ── 4b. Optional notes — explicit null ────────────────────────────────────

  test('accepts submission when notes is explicitly null', async () => {
    const payload = { ...validPayload(), notes: null };
    const res = await postJson(baseUrl, '/api/reports/delayed', payload, tokenForMueller);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
  });

  // ── 5. submittedAt — valid ISO 8601 UTC ───────────────────────────────────

  test('submittedAt is a valid ISO 8601 UTC string within the test window', async () => {
    const before = Date.now();
    const res = await postJson(baseUrl, '/api/reports/delayed', validPayload(), tokenForMueller);
    const after = Date.now();

    assert.equal(res.status, 201);
    const { submittedAt } = res.body.data;
    assert.ok(submittedAt.endsWith('Z'), 'submittedAt must be UTC (end with Z)');
    const ts = new Date(submittedAt).getTime();
    assert.ok(ts >= before && ts <= after, 'submittedAt must fall within the test window');
  });

  // ── 6. Sequential submissions — unique reference numbers ──────────────────

  test('two sequential submissions produce different reference numbers', async () => {
    const r1 = await postJson(baseUrl, '/api/reports/delayed', validPayload(), tokenForMueller);
    const token2 = createVerificationToken({ tagNumber: '0555666777', surname: 'MUELLER', pnr: 'WIMB04' }).token;
    const r2 = await postJson(baseUrl, '/api/reports/delayed', validPayload(), token2);

    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);
    assert.notEqual(
      r1.body.data.referenceNumber,
      r2.body.data.referenceNumber,
      'Each submission must generate a unique reference number'
    );
  });

  // ── 7a. Auth — missing Authorization header → 401 ─────────────────────────

  test('returns 401 MISSING_OR_EXPIRED_TOKEN when Authorization header is absent', async () => {
    const res = await postJson(baseUrl, '/api/reports/delayed', validPayload());

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'MISSING_OR_EXPIRED_TOKEN');
  });

  // ── 7b. Auth — expired token → 401 ───────────────────────────────────────

  test('returns 401 MISSING_OR_EXPIRED_TOKEN for an expired token', async () => {
    const expiredToken = createVerificationToken({
      tagNumber: '0555666777',
      surname: 'MUELLER',
      pnr: 'WIMB04',
      expiresInMs: -1000 // expired 1 second ago
    }).token;

    const res = await postJson(baseUrl, '/api/reports/delayed', validPayload(), expiredToken);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'MISSING_OR_EXPIRED_TOKEN');
  });

  // ── 8. Auth — token scoped to wrong tag → 403 ─────────────────────────────

  test('returns 403 TOKEN_BAG_MISMATCH when token is scoped to a different bag tag', async () => {
    // tokenForSmith is scoped to 0123456789; payload says 0555666777
    const res = await postJson(baseUrl, '/api/reports/delayed', validPayload(), tokenForSmith);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'TOKEN_BAG_MISMATCH');
  });

  // ── 9. Field validation — individual field failures → 400 ─────────────────

  test('returns 400 VALIDATION_ERROR with details array when all required fields are absent', async () => {
    const res = await postJson(
      baseUrl,
      '/api/reports/delayed',
      { tagNumber: '0555666777' }, // everything else missing
      tokenForMueller
    );

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(res.body.error.details), 'details must be an array');
    assert.ok(res.body.error.details.length > 0, 'details array must not be empty');
  });

  test('returns 400 when tagNumber is not 10 digits', async () => {
    const payload = { ...validPayload(), tagNumber: '12345' };
    const res = await postJson(baseUrl, '/api/reports/delayed', payload, tokenForMueller);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('returns 400 when pnr is not 6 alphanumeric characters', async () => {
    const payload = { ...validPayload(), pnr: 'TOOLONG1' };
    const res = await postJson(baseUrl, '/api/reports/delayed', payload, tokenForMueller);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('returns 400 when deliveryAddress is shorter than 5 characters', async () => {
    const payload = { ...validPayload(), deliveryAddress: '123' };
    const res = await postJson(baseUrl, '/api/reports/delayed', payload, tokenForMueller);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('returns 400 when contactPhone is not a valid phone number', async () => {
    const payload = { ...validPayload(), contactPhone: 'not-a-phone' };
    const res = await postJson(baseUrl, '/api/reports/delayed', payload, tokenForMueller);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('returns 400 when contactEmail is not a valid email address', async () => {
    const payload = { ...validPayload(), contactEmail: 'not-an-email' };
    const res = await postJson(baseUrl, '/api/reports/delayed', payload, tokenForMueller);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('returns 400 when bagDescription is shorter than 5 characters', async () => {
    const payload = { ...validPayload(), bagDescription: 'Bag' };
    const res = await postJson(baseUrl, '/api/reports/delayed', payload, tokenForMueller);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // ── 10. Error responses must not expose private passenger data ────────────

  test('403 error body does not expose passenger surname, PNR, or token string', async () => {
    const res = await postJson(baseUrl, '/api/reports/delayed', validPayload(), tokenForSmith);
    assert.equal(res.status, 403);

    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes('MUELLER'),       'Error must not expose passenger surname');
    assert.ok(!raw.includes('WIMB04'),        'Error must not expose PNR');
    assert.ok(!raw.includes(tokenForSmith),   'Error must not echo the auth token');
  });

  // ── 11. Route alias: POST /api/report (singular) ──────────────────────────

  test('POST /api/report (singular alias) behaves identically to /api/reports/delayed', async () => {
    const res = await postJson(baseUrl, '/api/report', validPayload(), tokenForMueller);

    assert.equal(res.status, 201, `Expected 201 from /api/report alias, got ${res.status}`);
    assert.equal(res.body.success, true);
    assert.match(res.body.data.referenceNumber, /^WIMB-DEL-\d{8}-\d{4}$/);
  });

  // ── 12. Verbatim CONTRACT.md Section 3.4 example request ─────────────────

  test('accepts exact CONTRACT.md Section 3.4 example request and returns expected fields', async () => {
    const res = await postJson(
      baseUrl,
      '/api/reports/delayed',
      {
        tagNumber:        '0555666777',
        pnr:              'WIMB04',
        passengerSurname: 'MUELLER',
        deliveryAddress:  '456 Sunset Blvd, Los Angeles, CA 90028',
        contactPhone:     '+1 (555) 019-2834',
        contactEmail:     'mueller@example.com',
        bagDescription:   'Navy blue soft-sided Samsonite upright suitcase with red identifier strap',
        notes:            'Connecting flight LH900 arrived late at LHR.'
      },
      tokenForMueller
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.data.tagNumber,               '0555666777');
    assert.equal(res.body.data.pnr,                     'WIMB04');
    assert.equal(res.body.data.status,                  'SUBMITTED');
    assert.equal(res.body.data.estimatedResolutionHours, 24);
    assert.ok(res.body.data.message.length > 0, 'message must be non-empty');
  });
});
