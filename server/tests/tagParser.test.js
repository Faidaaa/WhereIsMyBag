/**
 * Unit Tests: Baggage Tag Parser (server/src/utils/tagParser.js)
 *
 * Tests cover:
 *  - Valid 10-digit tags with leading zeroes preserved
 *  - Tags with leading zero (common in aviation: 0055123456)
 *  - Malformed tags (too short, too long, non-numeric, null, number type)
 *  - Known airline codes present in AIRLINE_CODE_MAP
 *  - Unknown airline codes (not in map, should return airline: null)
 *  - Unknown tag numbers (parseBaggageTag still succeeds — lookup is not tag-level)
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  parseBaggageTag,
  isValidTagFormat,
  parseTag,
  AIRLINE_CODE_MAP
} = require('../src/utils/tagParser');

// ---------------------------------------------------------------------------
// isValidTagFormat
// ---------------------------------------------------------------------------

describe('isValidTagFormat()', () => {
  test('returns true for a valid 10-digit tag string', () => {
    assert.strictEqual(isValidTagFormat('0055123456'), true);
  });

  test('returns true when tag starts with leading zeroes (leading zeroes preserved)', () => {
    assert.strictEqual(isValidTagFormat('0000000001'), true);
  });

  test('returns true for all-zeros edge case', () => {
    assert.strictEqual(isValidTagFormat('0000000000'), true);
  });

  test('returns false for a tag that is too short (9 digits)', () => {
    assert.strictEqual(isValidTagFormat('005512345'), false);
  });

  test('returns false for a tag that is too long (11 digits)', () => {
    assert.strictEqual(isValidTagFormat('00551234567'), false);
  });

  test('returns false for a tag containing non-numeric characters', () => {
    assert.strictEqual(isValidTagFormat('005512345X'), false);
  });

  test('returns false for empty string', () => {
    assert.strictEqual(isValidTagFormat(''), false);
  });

  test('returns false for a Number type (not a string — leading zeroes would be lost)', () => {
    assert.strictEqual(isValidTagFormat(55123456), false);
  });

  test('returns false for null', () => {
    assert.strictEqual(isValidTagFormat(null), false);
  });

  test('returns false for undefined', () => {
    assert.strictEqual(isValidTagFormat(undefined), false);
  });

  test('returns false for a tag containing a space', () => {
    assert.strictEqual(isValidTagFormat('005 123456'), false);
  });
});

// ---------------------------------------------------------------------------
// parseTag (internal structure)
// ---------------------------------------------------------------------------

describe('parseTag()', () => {
  test('correctly extracts leadingDigit, airlineCode, serialNumber for "0055123456"', () => {
    const result = parseTag('0055123456');
    assert.strictEqual(result.tagNumber, '0055123456');
    assert.strictEqual(result.leadingDigit, '0');
    assert.strictEqual(result.airlineCode, '055');
    assert.strictEqual(result.serialNumber, '123456');
  });

  test('preserves leading zeroes in tagNumber output', () => {
    const result = parseTag('0055123456');
    // tagNumber must be the full 10-char string, not numeric
    assert.strictEqual(typeof result.tagNumber, 'string');
    assert.strictEqual(result.tagNumber[0], '0');
  });

  test('resolves known airline code "055" to Nimbus Airways', () => {
    const result = parseTag('0055123456');
    assert.ok(result.airline !== null, 'Known airline code should resolve');
    assert.strictEqual(result.airline.code, '055');
    assert.strictEqual(result.airline.name, 'Nimbus Airways');
  });

  test('returns airline: null for unknown airline code', () => {
    // "099" is not in AIRLINE_CODE_MAP
    const result = parseTag('0099999999');
    assert.strictEqual(result.airline, null);
  });

  test('correctly handles tag "0123456789" from CONTRACT.md Section 8', () => {
    const result = parseTag('0123456789');
    assert.strictEqual(result.leadingDigit, '0');
    assert.strictEqual(result.airlineCode, '123');
    assert.strictEqual(result.serialNumber, '456789');
  });
});

// ---------------------------------------------------------------------------
// parseBaggageTag (main entry point)
// ---------------------------------------------------------------------------

describe('parseBaggageTag()', () => {
  // Valid tags
  test('succeeds and returns parsed result for valid tag "0055123456"', () => {
    const result = parseBaggageTag('0055123456');
    assert.strictEqual(result.success, true);
    assert.ok(result.parsed);
    assert.strictEqual(result.parsed.tagNumber, '0055123456');
    assert.strictEqual(result.parsed.airlineCode, '055');
    assert.strictEqual(result.parsed.serialNumber, '123456');
  });

  test('succeeds for "0055123457" (connection-risk fixture)', () => {
    const result = parseBaggageTag('0055123457');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.parsed.serialNumber, '123457');
  });

  test('succeeds for "0055123458" (missed-connection fixture)', () => {
    const result = parseBaggageTag('0055123458');
    assert.strictEqual(result.success, true);
  });

  test('succeeds for "0055123459" (auth-test fixture)', () => {
    const result = parseBaggageTag('0055123459');
    assert.strictEqual(result.success, true);
  });

  test('succeeds for CONTRACT.md scenario tag "0123456789" — leading zero preserved', () => {
    const result = parseBaggageTag('0123456789');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.parsed.tagNumber[0], '0');
  });

  // Leading zero preservation
  test('does NOT strip leading zeroes from the tag string', () => {
    const result = parseBaggageTag('0055123456');
    assert.strictEqual(result.parsed.tagNumber, '0055123456');
    // Confirm it is still 10 characters, not 9 (leading zero not dropped)
    assert.strictEqual(result.parsed.tagNumber.length, 10);
  });

  // Malformed inputs
  test('fails with INVALID_INPUT when input is a Number (would lose leading zero)', () => {
    const result = parseBaggageTag(55123456);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, 'INVALID_INPUT');
    assert.ok(result.errorMessage.includes('string'));
  });

  test('fails with INVALID_INPUT for a tag shorter than 10 digits', () => {
    const result = parseBaggageTag('123456789');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, 'INVALID_INPUT');
  });

  test('fails with INVALID_INPUT for a tag longer than 10 digits', () => {
    const result = parseBaggageTag('00551234567');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, 'INVALID_INPUT');
  });

  test('fails with INVALID_INPUT for a tag with non-numeric characters', () => {
    const result = parseBaggageTag('005512345X');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, 'INVALID_INPUT');
  });

  test('fails with INVALID_INPUT for null', () => {
    const result = parseBaggageTag(null);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, 'INVALID_INPUT');
  });

  test('fails with INVALID_INPUT for undefined', () => {
    const result = parseBaggageTag(undefined);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, 'INVALID_INPUT');
  });

  test('fails with INVALID_INPUT for empty string', () => {
    const result = parseBaggageTag('');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, 'INVALID_INPUT');
  });

  // Unknown airline code (parseBaggageTag itself succeeds — the tag is valid)
  test('succeeds but returns airline: null for unknown airline code in AIRLINE_CODE_MAP', () => {
    // "099" is not in the map
    const result = parseBaggageTag('0099000000');
    assert.strictEqual(result.success, true, 'Tag is structurally valid even if airline code is unknown');
    assert.strictEqual(result.parsed.airline, null);
  });

  // AIRLINE_CODE_MAP sanity check
  test('AIRLINE_CODE_MAP contains expected demo codes', () => {
    assert.ok('055' in AIRLINE_CODE_MAP);
    assert.ok('005' in AIRLINE_CODE_MAP);
  });
});
