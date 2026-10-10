/**
 * Baggage Tag Parser Utility
 *
 * CONTRACT.md Section 11 defines a baggage tag as:
 *   "String, exactly 10 numeric digits"
 *
 * This utility parses the internal sub-structure of a valid tag for
 * backend use only. It is NEVER exposed in API responses directly —
 * the tag is always surfaced as a plain string in all API outputs.
 *
 * Internal tag layout (10 digits total):
 *   [0]       — leading digit (always a single digit 0-9)
 *   [1][2][3] — 3-digit airline numeric code (IATA standard)
 *   [4]…[9]  — 6-digit sequential serial number
 *
 * Example: "0055123456"
 *   leading digit : "0"
 *   airline code  : "055"
 *   serial number : "123456"
 */

'use strict';

/**
 * Controlled local mapping of 3-digit IATA numeric airline codes to names.
 * Only codes used in this hackathon fixture set are listed.
 * These are entirely fictional entries for demo purposes.
 *
 * Format: { "NNN": { code: "NNN", iata: "XX", name: "Airline Name" } }
 */
const AIRLINE_CODE_MAP = {
  '005': { code: '005', iata: 'NB', name: 'Nimbus Airways' },
  '012': { code: '012', iata: 'BA', name: 'Britannic Air' },
  '098': { code: '098', iata: 'GT', name: 'Gateway Airlines' },
  '011': { code: '011', iata: 'SP', name: 'Solstice Pacific' },
  '055': { code: '055', iata: 'NB', name: 'Nimbus Airways' }
};

/**
 * Validates whether a value is a well-formed 10-digit baggage tag string.
 * Preserves leading zeroes — input must always be passed as a string.
 *
 * @param {*} input - The raw input to validate (must be a string)
 * @returns {boolean}
 */
function isValidTagFormat(input) {
  if (typeof input !== 'string') return false;
  return /^\d{10}$/.test(input);
}

/**
 * Parses a validated 10-digit baggage tag string into its structural components.
 *
 * @param {string} tagNumber - A valid 10-digit numeric string (leading zeroes preserved)
 * @returns {{
 *   tagNumber: string,
 *   leadingDigit: string,
 *   airlineCode: string,
 *   serialNumber: string,
 *   airline: { code: string, iata: string, name: string } | null
 * }}
 */
function parseTag(tagNumber) {
  const leadingDigit = tagNumber[0];
  const airlineCode = tagNumber.slice(1, 4);
  const serialNumber = tagNumber.slice(4);
  const airline = AIRLINE_CODE_MAP[airlineCode] || null;

  return {
    tagNumber,
    leadingDigit,
    airlineCode,
    serialNumber,
    airline
  };
}

/**
 * Main entry point: validates and parses a baggage tag.
 *
 * Returns a result object rather than throwing, so callers can handle
 * errors without try/catch and the API never crashes on bad input.
 *
 * @param {*} input - Raw input from request body or params
 * @returns {{
 *   success: true,
 *   parsed: ReturnType<parseTag>
 * } | {
 *   success: false,
 *   errorCode: string,
 *   errorMessage: string
 * }}
 */
function parseBaggageTag(input) {
  // Guard: must be a string to preserve leading zeroes
  if (typeof input !== 'string') {
    return {
      success: false,
      errorCode: 'INVALID_INPUT',
      errorMessage:
        'tagNumber must be provided as a string to preserve leading zeroes.'
    };
  }

  // Guard: must be exactly 10 numeric digits
  if (!isValidTagFormat(input)) {
    return {
      success: false,
      errorCode: 'INVALID_INPUT',
      errorMessage:
        'tagNumber must be exactly 10 numeric digits (e.g. "0055123456").'
    };
  }

  const parsed = parseTag(input);

  return {
    success: true,
    parsed
  };
}

module.exports = {
  parseBaggageTag,
  isValidTagFormat,
  parseTag,
  AIRLINE_CODE_MAP
};
