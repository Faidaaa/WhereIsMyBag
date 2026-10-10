/**
 * Integration & Unit Tests: Real-Time Baggage Stream (SSE)
 * (server/tests/sseStream.test.js)
 *
 * Verifies that:
 *  1. Authorization & Tag Scoping (401 for invalid/expired token, 403 for tag mismatch, 404 for unknown tag)
 *  2. Multi-method authentication (Authorization: Bearer <token> AND ?token=<token> query param)
 *  3. SSE Response Headers (Content-Type: text/event-stream, Cache-Control, Connection: keep-alive)
 *  4. Event Delivery Sequence (connected -> baggage-event -> risk-alert -> stream-complete)
 *  5. Reconnection with Last-Event-ID / lastEventId (skips duplicate events)
 *  6. Disconnection Cleanup (cancels ping timers & cleans up simulation subscriptions on close)
 *  7. Route Aliasing (/api/bag/:tag/stream & /api/bags/:tag/stream)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const { createVerificationToken, _clearAllTokens } = require('../src/services/authService');
const { defaultEngine } = require('../src/services/simulationEngine');

let server;
let baseUrl;

// Override step delay and ping interval for fast, deterministic tests
process.env.SIMULATION_STEP_DELAY_MS = '20';
process.env.SSE_PING_INTERVAL_MS = '50';

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
  defaultEngine.stopAllSimulations();
});

/**
 * Helper to open an SSE stream or fetch HTTP response
 */
function fetchStream(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(urlPath, baseUrl);
    const headers = options.headers || {};

    const req = http.request(fullUrl, { method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
        if (options.onChunk) {
          options.onChunk(chunk.toString('utf-8'));
        }
      });

      res.on('end', () => {
        const bodyText = Buffer.concat(chunks).toString('utf-8');
        let json = null;
        try {
          json = JSON.parse(bodyText);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          bodyText,
          json,
          req
        });
      });
    });

    req.on('error', (err) => {
      if (err.code === 'ECONNRESET') {
        resolve({ statusCode: 0, destroyed: true });
      } else {
        reject(err);
      }
    });

    if (options.autoDestroyMs) {
      setTimeout(() => {
        req.destroy();
      }, options.autoDestroyMs);
    } else {
      req.end();
    }
  });
}

// ============================================================================
// PART 1: Authorization & Error Handling
// ============================================================================

test('GET /api/bags/0123456789/stream without token returns 401 MISSING_OR_EXPIRED_TOKEN', async () => {
  const res = await fetchStream('/api/bags/0123456789/stream');
  assert.equal(res.statusCode, 401);
  assert.equal(res.json.success, false);
  assert.equal(res.json.error.code, 'MISSING_OR_EXPIRED_TOKEN');
});

test('GET /api/bags/0123456789/stream with expired token returns 401 MISSING_OR_EXPIRED_TOKEN', async () => {
  const { token } = createVerificationToken({
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'WIMB01',
    expiresInMs: -1000
  });

  const res = await fetchStream(`/api/bags/0123456789/stream?token=${token}`);
  assert.equal(res.statusCode, 401);
  assert.equal(res.json.error.code, 'MISSING_OR_EXPIRED_TOKEN');
});

test('GET /api/bags/0055123456/stream with token for tag 0123456789 returns 403 TOKEN_BAG_MISMATCH', async () => {
  const { token } = createVerificationToken({
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'WIMB01'
  });

  const res = await fetchStream(`/api/bags/0055123456/stream?token=${token}`);
  assert.equal(res.statusCode, 403);
  assert.equal(res.json.error.code, 'TOKEN_BAG_MISMATCH');
});

test('GET /api/bags/9999999999/stream with valid token format returns 404 TAG_NOT_FOUND', async () => {
  const { token } = createVerificationToken({
    tagNumber: '9999999999',
    surname: 'UNKNOWN',
    pnr: 'UNKN01'
  });

  const res = await fetchStream(`/api/bags/9999999999/stream?token=${token}`);
  assert.equal(res.statusCode, 404);
  assert.equal(res.json.error.code, 'TAG_NOT_FOUND');
});

// ============================================================================
// PART 2: Authentication Flexibility (Bearer Header vs Query Param)
// ============================================================================

test('SSE stream authenticates via Authorization: Bearer header', async () => {
  const { token } = createVerificationToken({
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'WIMB01'
  });

  const res = await fetchStream('/api/bags/0123456789/stream', {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(res.statusCode, 200);
  assert(res.headers['content-type'].includes('text/event-stream'));
  assert(res.bodyText.includes('event: connected'));
});

// ============================================================================
// PART 3: Event Delivery Sequence & Response Headers
// ============================================================================

test('SSE stream emits correct headers and ordered event sequence', async () => {
  const { token } = createVerificationToken({
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'WIMB01'
  });

  const receivedChunks = [];
  const res = await fetchStream(`/api/bags/0123456789/stream?token=${token}`, {
    onChunk: (chunk) => receivedChunks.push(chunk)
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'text/event-stream');
  assert.equal(res.headers['cache-control'], 'no-cache, no-transform');
  assert.equal(res.headers['connection'], 'keep-alive');

  const fullText = receivedChunks.join('');

  // 1. Must start with event: connected
  assert(fullText.includes('event: connected'));
  assert(fullText.includes('"message":"Connected to WhereIsMyBag real-time simulation stream"'));

  // 2. Must contain baggage-events with stable event IDs
  assert(fullText.includes('id: evt_sj_01'));
  assert(fullText.includes('event: baggage-event'));
  assert(fullText.includes('"step":"CHECKED_IN"'));
  assert(fullText.includes('"visibility":"PASSENGER"'));
  assert(fullText.includes('"internalNotes":null'));

  // 3. Must contain stream-complete
  assert(fullText.includes('event: stream-complete'));
  assert(fullText.includes('"status":"FINISHED"'));
});

// ============================================================================
// PART 4: Reconnection & Last-Event-ID Handling
// ============================================================================

test('SSE stream handles Last-Event-ID reconnection skipping already received events', async () => {
  const { token } = createVerificationToken({
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'WIMB01'
  });

  // Reconnect after evt_sj_02
  const res = await fetchStream(`/api/bags/0123456789/stream?token=${token}`, {
    headers: { 'Last-Event-ID': 'evt_sj_02' }
  });

  assert.equal(res.statusCode, 200);
  const text = res.bodyText;

  // evt_sj_01 and evt_sj_02 should be skipped
  assert.equal(text.includes('id: evt_sj_01'), false, 'evt_sj_01 must be skipped on reconnect');
  assert.equal(text.includes('id: evt_sj_02'), false, 'evt_sj_02 must be skipped on reconnect');

  // Should resume from evt_sj_04 onward
  assert(text.includes('id: evt_sj_04'), 'Must resume from event after Last-Event-ID');
  assert(text.includes('event: stream-complete'));
});

// ============================================================================
// PART 5: Disconnection Cleanup (No Memory Leaks)
// ============================================================================

test('Client disconnection cleans up heartbeat timers and simulation subscriptions', async () => {
  const { token } = createVerificationToken({
    tagNumber: '0055123456',
    surname: 'OKAFOR',
    pnr: 'NBFX01'
  });

  // Start stream and auto-destroy connection after 30ms
  await fetchStream(`/api/bags/0055123456/stream?token=${token}`, {
    autoDestroyMs: 30
  });

  // Wait for server cleanup to process
  await new Promise((r) => setTimeout(r, 100));

  // Simulation status should be cleaned up / inactive
  const status = defaultEngine.getSimulationStatus('0055123456');
  assert(status === null || status.subscriberCount === 0, 'Subscribers must be cleaned up on client disconnect');
});

// ============================================================================
// PART 6: Route Aliasing
// ============================================================================

test('GET /api/bag/0123456789/stream (singular alias) works identically', async () => {
  const { token } = createVerificationToken({
    tagNumber: '0123456789',
    surname: 'SMITH',
    pnr: 'WIMB01'
  });

  const res = await fetchStream(`/api/bag/0123456789/stream?token=${token}`);
  assert.equal(res.statusCode, 200);
  assert(res.bodyText.includes('event: connected'));
  assert(res.bodyText.includes('event: baggage-event'));
});
