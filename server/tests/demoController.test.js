/**
 * Integration Tests: Demo Controller Endpoints (server/tests/demoController.test.js)
 *
 * Verifies that:
 *  - GET /api/demo/barcodes returns 200 OK with HTML content, barcodes, and disclaimers
 *  - GET /api/barcodes/0055123456.png returns 200 OK with image/png header
 *  - GET /api/bsm returns 200 OK JSON with all simulated BSMs
 *  - GET /api/bsm/0055123456 returns 200 OK JSON for specific tag
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');

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

function fetchUrl(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(urlPath, baseUrl);
    const req = http.request(fullUrl, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: bodyBuffer.toString('utf-8'),
          buffer: bodyBuffer
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

test('GET /api/demo/barcodes returns 200 HTML with printable barcodes and disclaimers', async () => {
  const res = await fetchUrl('/api/demo/barcodes');
  assert.equal(res.statusCode, 200);
  assert(res.headers['content-type'].includes('text/html'));
  assert(res.body.includes('WhereIsMyBag — Demo Baggage Barcodes'));
  assert(res.body.includes('0055123456'));
  assert(res.body.includes('0055123457'));
  assert(res.body.includes('0055123458'));
  assert(res.body.includes('SIMULATED BSM-STYLE DEMO DATA'));
  assert(res.body.includes('data:image/png;base64,'));
});

test('GET /api/barcodes/0055123456.png returns 200 image/png with valid PNG bytes', async () => {
  const res = await fetchUrl('/api/barcodes/0055123456.png');
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'image/png');
  assert(res.buffer.length > 500);

  // Check magic PNG header
  assert.equal(res.buffer[0], 0x89);
  assert.equal(res.buffer[1], 0x50);
  assert.equal(res.buffer[2], 0x4e);
  assert.equal(res.buffer[3], 0x47);
});

test('GET /api/bsm returns 200 JSON with list of simulated BSM messages', async () => {
  const res = await fetchUrl('/api/bsm');
  assert.equal(res.statusCode, 200);
  assert(res.headers['content-type'].includes('application/json'));

  const data = JSON.parse(res.body);
  assert.equal(data.isSimulatedDemoData, true);
  assert.equal(data.count, 3);
  assert.equal(data.messages.length, 3);
  assert.equal(data.messages[0].tagNumber, '0055123456');
  assert.equal(data.messages[1].tagNumber, '0055123457');
  assert.equal(data.messages[2].tagNumber, '0055123458');
});

test('GET /api/bsm/0055123457 returns 200 JSON for specific tag', async () => {
  const res = await fetchUrl('/api/bsm/0055123457');
  assert.equal(res.statusCode, 200);

  const data = JSON.parse(res.body);
  assert.equal(data.isSimulatedDemoData, true);
  assert.equal(data.tagNumber, '0055123457');
  assert.equal(data.passengerSurname, 'LINDQVIST');
  assert.equal(data.pnr, 'NBFX02');
});
