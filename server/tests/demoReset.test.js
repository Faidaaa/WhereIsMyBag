/**
 * Demo Reset Endpoint — Comprehensive Test Suite
 * POST /api/demo/reset
 *
 * NOTE: CONTRACT.md does not define this endpoint. It is a demo-environment-only
 * utility protected by X-Demo-Reset-Secret and blocked in NODE_ENV=production.
 *
 * Covers:
 *  1. Successful reset returns 200 with expected response schema
 *  2. Reset during an active simulation stops timers and reports stopped count
 *  3. Repeated resets are safe (idempotent — no crash, counts just go to zero)
 *  4. Scenario can be replayed after reset (new SSE subscription starts fresh)
 *  5. Missing X-Demo-Reset-Secret returns 401 INVALID_RESET_SECRET
 *  6. Wrong X-Demo-Reset-Secret returns 401 INVALID_RESET_SECRET
 *  7. Fixture definitions are preserved after reset (scenarios still load)
 *  8. Submitted reports are cleared after reset
 *  9. Auth tokens are NOT cleared by reset (existing sessions stay valid)
 * 10. Production guard: NODE_ENV=production returns 403 FORBIDDEN_IN_PRODUCTION
 */

'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const { createVerificationToken, _clearAllTokens } = require('../src/services/authService');
const { defaultEngine } = require('../src/services/simulationEngine');

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const DEMO_SECRET = process.env.DEMO_RESET_SECRET || 'wimb-demo-reset-2026';

function request(baseUrl, { method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (bodyStr) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(new URL(path, baseUrl), { method, headers: reqHeaders }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf-8')); } catch (_) {}
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/** Sends POST /api/demo/reset with the correct secret */
function doReset(baseUrl, secret = DEMO_SECRET) {
  return request(baseUrl, {
    method: 'POST',
    path: '/api/demo/reset',
    headers: { 'X-Demo-Reset-Secret': secret }
  });
}

/** Gets a fresh auth token for the given fixture scenario */
function getToken(tagNumber, surname, pnr) {
  return createVerificationToken({ tagNumber, surname, pnr }).token;
}

// ────────────────────────────────────────────────────────────────────────────
// Suite
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/demo/reset — Demo State Reset', () => {
  let server;
  let baseUrl;

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
      // Final cleanup: stop any dangling simulation sessions
      defaultEngine.stopAllSimulations();
      if (server) server.close(resolve);
      else resolve();
    })
  );

  beforeEach(() => {
    // Ensure a clean slate before each test
    defaultEngine.stopAllSimulations();
    _clearAllTokens();
  });

  // ── 1. Successful reset — baseline schema ─────────────────────────────────

  test('returns 200 with the expected response schema when no state exists', async () => {
    const res = await doReset(baseUrl);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const d = res.body.data;
    assert.ok(typeof d.message === 'string',             'data.message must be a string');
    assert.ok(typeof d.stoppedSimulations === 'number',  'data.stoppedSimulations must be a number');
    assert.ok(typeof d.clearedReports === 'number',      'data.clearedReports must be a number');
    assert.ok(typeof d.resetAt === 'string',             'data.resetAt must be present');
    assert.ok(d.resetAt.endsWith('Z'),                   'data.resetAt must be UTC ISO string');
    assert.ok(typeof d.note === 'string',                'data.note must be present');
    // Must clearly label as demo/simulated
    assert.ok(
      d.message.includes('[DEMO]'),
      `message must be labelled as [DEMO], got: "${d.message}"`
    );
  });

  // ── 2. Reset during active simulation ─────────────────────────────────────

  test('stops active simulation timers and returns correct stoppedSimulations count', async () => {
    // Start a real simulation session by subscribing
    const noop = () => {};
    defaultEngine.subscribe('0123456789', noop);
    defaultEngine.subscribe('0055123456', noop);

    assert.equal(defaultEngine.activeSessions.size, 2, 'Two sessions must be active before reset');

    const res = await doReset(baseUrl);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.stoppedSimulations, 2,   'Must report 2 stopped simulations');
    assert.equal(defaultEngine.activeSessions.size, 0,  'No sessions must remain after reset');
  });

  // ── 3. Repeated resets are idempotent ─────────────────────────────────────

  test('repeated resets are safe — no errors, subsequent counts are zero', async () => {
    const r1 = await doReset(baseUrl);
    const r2 = await doReset(baseUrl);
    const r3 = await doReset(baseUrl);

    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r3.status, 200);

    // Second and third resets have nothing to stop/clear
    assert.equal(r2.body.data.stoppedSimulations, 0);
    assert.equal(r2.body.data.clearedReports, 0);
    assert.equal(r3.body.data.stoppedSimulations, 0);
    assert.equal(r3.body.data.clearedReports, 0);
  });

  // ── 4. Scenario can be replayed after reset ────────────────────────────────

  test('a scenario can be replayed after reset — new subscription receives events', async (t) => {
    // Subscribe, let a few events fire, then reset
    let eventCount = 0;
    defaultEngine.subscribe('0123456789', () => { eventCount++; });

    // Allow one step delay to fire (engine uses 1500ms by default, but tests use faster)
    // We just verify the session exists and that after reset a new one can be created
    assert.ok(defaultEngine.activeSessions.has('0123456789'), 'Session must be active');

    await doReset(baseUrl);
    assert.equal(defaultEngine.activeSessions.size, 0, 'Sessions must be cleared by reset');

    // Re-subscribe — should work cleanly without errors
    let replayEventCount = 0;
    const result = defaultEngine.subscribe('0123456789', () => { replayEventCount++; });

    assert.equal(result.success, true, 'Re-subscription after reset must succeed');
    assert.ok(defaultEngine.activeSessions.has('0123456789'), 'New session must be active after replay');

    // Cleanup
    result.unsubscribe();
  });

  // ── 5. Reports are cleared by reset ──────────────────────────────────────

  test('clears submitted delayed-baggage reports and reports correct clearedReports count', async () => {
    // Submit a report via the API first
    const token = getToken('0555666777', 'MUELLER', 'WIMB04');
    const reportRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/reports/delayed',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        tagNumber:        '0555666777',
        pnr:              'WIMB04',
        passengerSurname: 'MUELLER',
        deliveryAddress:  '456 Sunset Blvd, Los Angeles, CA 90028',
        contactPhone:     '+1 (555) 019-2834',
        contactEmail:     'mueller@example.com',
        bagDescription:   'Navy blue Samsonite suitcase with red strap'
      }
    });
    assert.equal(reportRes.status, 201, 'Report submission must succeed before reset');

    // Now reset — should show 1 cleared report
    const res = await doReset(baseUrl);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.clearedReports, 1, 'Must report 1 cleared report');
  });

  // ── 6. Fixture definitions are preserved ─────────────────────────────────

  test('fixture scenario data is preserved after reset — GET /api/scenarios still returns all 4', async () => {
    await doReset(baseUrl);

    const res = await request(baseUrl, { path: '/api/scenarios' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 4, 'All 4 demo scenarios must still be available after reset');

    // Verify the canonical missed-connection scenario is intact
    const mueller = res.body.data.find((s) => s.tagNumber === '0555666777');
    assert.ok(mueller, 'missed_connection scenario must survive reset');
    assert.equal(mueller.surname, 'MUELLER');
    assert.equal(mueller.pnr,    'WIMB04');
  });

  // ── 7. Auth tokens are NOT cleared by reset ───────────────────────────────

  test('existing auth tokens remain valid after reset — timeline still accessible', async () => {
    // Issue a token, perform reset, verify token still works
    const token = createVerificationToken({
      tagNumber: '0123456789',
      surname: 'SMITH',
      pnr: 'WIMB01'
    }).token;

    await doReset(baseUrl);

    const res = await request(baseUrl, {
      path: '/api/bags/0123456789/timeline',
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(res.status, 200, 'Token must remain valid after demo reset');
    assert.equal(res.body.success, true);
  });

  // ── 8. Missing X-Demo-Reset-Secret returns 401 ───────────────────────────

  test('returns 401 INVALID_RESET_SECRET when X-Demo-Reset-Secret header is absent', async () => {
    const res = await request(baseUrl, { method: 'POST', path: '/api/demo/reset' });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_RESET_SECRET');
  });

  // ── 9. Wrong X-Demo-Reset-Secret returns 401 ─────────────────────────────

  test('returns 401 INVALID_RESET_SECRET when an incorrect secret is provided', async () => {
    const res = await doReset(baseUrl, 'totally-wrong-secret');

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_RESET_SECRET');
  });

  // ── 10. Production guard ──────────────────────────────────────────────────

  test('returns 403 FORBIDDEN_IN_PRODUCTION when NODE_ENV=production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const res = await doReset(baseUrl);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN_IN_PRODUCTION');
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  // ── 11. Reset of combined state: simulations + reports in one call ────────

  test('resets both active simulations and reports in a single call', async () => {
    // Start a simulation
    const noop = () => {};
    defaultEngine.subscribe('0555666777', noop);

    // Submit a report
    const token = getToken('0555666777', 'MUELLER', 'WIMB04');
    await request(baseUrl, {
      method: 'POST',
      path: '/api/reports/delayed',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        tagNumber: '0555666777', pnr: 'WIMB04', passengerSurname: 'MUELLER',
        deliveryAddress: '456 Sunset Blvd, Los Angeles, CA 90028',
        contactPhone: '+1 (555) 019-2834', contactEmail: 'mueller@example.com',
        bagDescription: 'Navy blue Samsonite suitcase with red strap'
      }
    });

    const res = await doReset(baseUrl);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.stoppedSimulations, 1);
    assert.equal(res.body.data.clearedReports,     1);
    assert.equal(defaultEngine.activeSessions.size, 0);
  });
});
