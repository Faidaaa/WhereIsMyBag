/**
 * BSM (Baggage Source Message) Generator Service for WhereIsMyBag
 *
 * Generates sample BSM-style messages derived from fictional fixture records.
 *
 * IMPORTANT DISCLAIMER:
 *  These messages are strictly SIMULATED DEMO DATA for testing and evaluation.
 *  They are NOT actual airline messages and MUST NOT be represented as real operational data.
 *
 * Reference: CONTRACT.md Section 8 & 11
 */

'use strict';

const { FIXTURE_SCENARIOS } = require('../data/fixtures');
const { parseTag } = require('../utils/tagParser');

/**
 * Global explicit disclaimer text required for all simulated BSM data
 */
const DEMO_DATA_DISCLAIMER = 'SIMULATED BSM-STYLE DEMO DATA — NOT AN ACTUAL AIRLINE MESSAGE';
const DEMO_BANNER = '=== SIMULATED BSM-STYLE DEMO DATA (NOT AN ACTUAL AIRLINE MESSAGE) ===';

/**
 * Formats standard IATA-style simulated BSM text block.
 *
 * @param {Object} fixture - Fixture record object
 * @returns {string} Multiline text formatted like an IATA BSM message
 */
function formatRawBsmText(fixture) {
  if (!fixture || !fixture.tagNumber) {
    throw new Error('Invalid fixture record provided for BSM formatting');
  }

  const tagStr = String(fixture.tagNumber);
  const surname = String(fixture.surname || 'PASSENGER').toUpperCase();
  const nameParts = (fixture.passengerFullName || '').split(' ');
  const firstName = (nameParts[0] || '').toUpperCase();
  const flight = String(fixture.currentFlight || 'NB100').toUpperCase();
  const origin = String(fixture.origin || 'ARC').toUpperCase();
  const dest = String(fixture.destination || 'PNX').toUpperCase();

  return [
    DEMO_BANNER,
    'BSM',
    '.V/1L',
    `.N/${tagStr}`,
    `.P/${surname}/${firstName}`,
    `.F/${flight}/11OCT/${origin}/${dest}`,
    `.Y/${dest}`,
    `.R/${fixture.pnr}`,
    'ENDBSM'
  ].join('\n');
}

/**
 * Generates a complete BSM-style data structure for a given fixture record.
 *
 * @param {Object} fixture - Fixture record from fixtures.js
 * @returns {Object} Structured BSM data object
 */
function generateBsmFromFixture(fixture) {
  if (!fixture || !fixture.tagNumber) {
    throw new Error('Invalid fixture record provided for BSM generation');
  }

  const parsedTag = parseTag(fixture.tagNumber);
  const rawBsmText = formatRawBsmText(fixture);

  return {
    isSimulatedDemoData: true,
    disclaimer: DEMO_DATA_DISCLAIMER,
    tagNumber: fixture.tagNumber,
    pnr: fixture.pnr,
    passengerSurname: fixture.surname,
    passengerFullName: fixture.passengerFullName,
    scenarioId: fixture.id,
    origin: fixture.origin,
    destination: fixture.destination,
    flightNumber: fixture.currentFlight,
    airlineCode: parsedTag.airlineCode,
    airlineName: parsedTag.airline ? parsedTag.airline.name : 'Nimbus Airways',
    rawBsmText,
    iataElements: {
      header: 'BSM',
      version: '1L',
      tagNumber: fixture.tagNumber,
      passenger: `${fixture.surname}/${(fixture.passengerFullName || '').split(' ')[0]}`.toUpperCase(),
      flight: `${fixture.currentFlight}/11OCT/${fixture.origin}/${fixture.destination}`,
      destination: fixture.destination,
      pnr: fixture.pnr
    }
  };
}

/**
 * Generates a BSM-style sample message for a specific 10-digit tag number.
 *
 * @param {string} tagNumber - 10-digit tag string
 * @returns {Object} BSM message object
 */
function generateBsmForTag(tagNumber) {
  const sanitizedTag = String(tagNumber || '').trim();
  const fixture = Object.values(FIXTURE_SCENARIOS).find(f => f.tagNumber === sanitizedTag);

  if (!fixture) {
    throw new Error(`No fictional fixture record found for tag number ${sanitizedTag}`);
  }

  return generateBsmFromFixture(fixture);
}

/**
 * Generates sample BSM-style messages for all standard demo tags.
 *
 * @returns {Array<Object>} List of BSM message objects
 */
function generateAllDemoBsms() {
  const targetTags = ['0055123456', '0055123457', '0055123458'];
  return targetTags.map(tagNumber => generateBsmForTag(tagNumber));
}

module.exports = {
  DEMO_DATA_DISCLAIMER,
  DEMO_BANNER,
  formatRawBsmText,
  generateBsmFromFixture,
  generateBsmForTag,
  generateAllDemoBsms
};
