/**
 * Unit Tests: Barcode Generator Utility (server/src/utils/barcodeGenerator.js)
 *
 * Verifies that:
 *  - Code 128 barcodes can be generated for all three demo tags (0055123456, 0055123457, 0055123458)
 *  - Leading zeroes in tag numbers are strictly preserved (e.g. 0055123456)
 *  - Generated PNG buffers contain valid PNG file headers
 *  - Base64 data URLs start with data:image/png;base64,
 *  - Invalid tags are rejected with descriptive errors
 *  - generateDemoBarcodes() generates all required demo barcodes
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEMO_TAG_NUMBERS,
  generateBarcodePngBuffer,
  generateBarcodeDataUrl,
  generateDemoBarcodes
} = require('../src/utils/barcodeGenerator');

test('DEMO_TAG_NUMBERS contains the three required demo tags with leading zeroes', () => {
  assert.equal(DEMO_TAG_NUMBERS.length, 3);
  assert.deepEqual(DEMO_TAG_NUMBERS, ['0055123456', '0055123457', '0055123458']);
});

test('generateBarcodePngBuffer produces valid PNG buffer for tag 0055123456 preserving leading zeroes', async () => {
  const tag = '0055123456';
  const buffer = await generateBarcodePngBuffer(tag);

  assert(Buffer.isBuffer(buffer), 'Output must be a Node.js Buffer');
  assert(buffer.length > 500, 'PNG buffer should be non-trivial size');

  // PNG file signature magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  assert(isPng, 'Buffer header must match PNG magic bytes');
});

test('generateBarcodePngBuffer produces valid PNG buffer for all demo tags', async () => {
  for (const tag of DEMO_TAG_NUMBERS) {
    const buffer = await generateBarcodePngBuffer(tag);
    assert(Buffer.isBuffer(buffer));
    assert(buffer.length > 0);
  }
});

test('generateBarcodeDataUrl returns valid base64 data URL', async () => {
  const dataUrl = await generateBarcodeDataUrl('0055123456');
  assert.equal(typeof dataUrl, 'string');
  assert(dataUrl.startsWith('data:image/png;base64,'), 'Must start with data:image/png;base64,');
  assert(dataUrl.length > 100, 'Data URL must contain base64 payload');
});

test('generateDemoBarcodes returns data URLs for all three demo tags', async () => {
  const results = await generateDemoBarcodes();
  assert.equal(results.length, 3);

  const tags = results.map(r => r.tagNumber);
  assert.deepEqual(tags, ['0055123456', '0055123457', '0055123458']);

  results.forEach(item => {
    assert(item.dataUrl.startsWith('data:image/png;base64,'));
    assert.equal(item.formattedTag.length, 10);
  });
});

test('generateBarcodePngBuffer rejects malformed tags', async () => {
  await assert.rejects(
    async () => {
      await generateBarcodePngBuffer('12345');
    },
    {
      name: 'Error',
      message: /Invalid tag number for barcode generation/
    }
  );

  await assert.rejects(
    async () => {
      await generateBarcodePngBuffer('005512345A');
    },
    {
      name: 'Error',
      message: /Invalid tag number for barcode generation/
    }
  );
});
