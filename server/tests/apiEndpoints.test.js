const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');

describe('API Endpoints Integration Tests', () => {
  let server;
  let baseUrl;
  let authToken;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /health returns 200 ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, 'ok');
  });

  test('POST /api/verify succeeds with valid credentials and issues token', async () => {
    const res = await fetch(`${baseUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagNumber: '0123456789',
        surname: 'SMITH',
        pnr: 'WIMB01'
      })
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.verificationToken.startsWith('vtok_0123456789_'));
    assert.strictEqual(json.data.bag.tagNumber, '0123456789');

    authToken = json.data.verificationToken;
  });

  test('POST /api/verify rejects invalid input format with 400', async () => {
    const res = await fetch(`${baseUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagNumber: '123', // not 10 digits
        surname: 'SMITH',
        pnr: 'WIMB01'
      })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'INVALID_INPUT');
  });

  test('POST /api/verify rejects non-matching credentials with 401', async () => {
    const res = await fetch(`${baseUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagNumber: '0987654321',
        surname: 'DOE', // wrong surname for scenario 2
        pnr: 'WIMB02'
      })
    });

    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VERIFICATION_FAILED');
  });

  test('GET /api/bags/:tagNumber/timeline returns timeline with valid token', async () => {
    const res = await fetch(`${baseUrl}/api/bags/0123456789/timeline`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.tagNumber, '0123456789');
    assert.ok(Array.isArray(json.data.events));
    assert.ok(json.data.riskAssessment);
  });

  test('GET /api/bags/:tagNumber/timeline rejects missing token with 401', async () => {
    const res = await fetch(`${baseUrl}/api/bags/0123456789/timeline`);
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.error.code, 'MISSING_OR_EXPIRED_TOKEN');
  });

  test('GET /api/bags/:tagNumber/timeline rejects mismatched token with 403', async () => {
    // Token was issued for 0123456789, requesting 0111222333
    const res = await fetch(`${baseUrl}/api/bags/0111222333/timeline`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    assert.strictEqual(res.status, 403);
    const json = await res.json();
    assert.strictEqual(json.error.code, 'TOKEN_BAG_MISMATCH');
  });

  test('GET /api/scenarios returns all 4 demo scenarios', async () => {
    const res = await fetch(`${baseUrl}/api/scenarios`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.length, 4);
  });

  test('POST /api/reports/delayed creates delayed baggage report with 201', async () => {
    const res = await fetch(`${baseUrl}/api/reports/delayed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        tagNumber: '0123456789',
        pnr: 'WIMB01',
        passengerSurname: 'SMITH',
        deliveryAddress: '789 Fifth Avenue, New York, NY 10022',
        contactPhone: '+1 212 555 0199',
        contactEmail: 'smith@example.com',
        bagDescription: 'Black Samsonite expandable suitcase with red strap',
        notes: 'Arrived on flight BA178'
      })
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.referenceNumber.startsWith('WIMB-DEL-'));
    assert.strictEqual(json.data.status, 'SUBMITTED');
  });

  test('POST /api/reports/delayed rejects invalid payload with 400', async () => {
    const res = await fetch(`${baseUrl}/api/reports/delayed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        tagNumber: '0123456789',
        deliveryAddress: '123' // missing required fields and too short
      })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  test('GET /api/bags/:tagNumber/stream rejects missing token with 401 JSON without upgrading to SSE', async () => {
    const res = await fetch(`${baseUrl}/api/bags/0123456789/stream`);
    assert.strictEqual(res.status, 401);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'), 'Must return JSON error');
    const json = await res.json();
    assert.strictEqual(json.error.code, 'MISSING_OR_EXPIRED_TOKEN');
  });

  test('GET /api/bags/:tagNumber/stream opens SSE connection with 200 text/event-stream', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/bags/0123456789/stream?token=${authToken}`, {
      signal: controller.signal
    });

    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/event-stream'), 'Must return text/event-stream');

    // Read initial chunk containing connected event
    const reader = res.body.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    assert.ok(text.includes('event: connected'));
    assert.ok(text.includes('Connected to WhereIsMyBag real-time simulation stream'));

    // Cancel reader and abort connection
    await reader.cancel();
    controller.abort();
  });
});

