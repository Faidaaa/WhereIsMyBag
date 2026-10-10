/**
 * Unit Tests: BSM Generator Service (server/src/services/bsmGenerator.js)
 *
 * Verifies that:
 *  - BSM messages generated are consistent with fixture records in fixtures.js
 *  - All generated BSM messages contain explicit simulated demo data disclaimers
 *  - Raw BSM text contains valid IATA-style tags (.N/, .P/, .F/, .Y/)
 *  - Tag numbers with leading zeroes (0055123456) are preserved
 *  - generateAllDemoBsms() produces messages for all 3 demo tags
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEMO_DATA_DISCLAIMER,
  DEMO_BANNER,
  formatRawBsmText,
  generateBsmFromFixture,
  generateBsmForTag,
  generateAllDemoBsms
} = require('../src/services/bsmGenerator');
const { FIXTURE_SCENARIOS } = require('../src/data/fixtures');

test('generateBsmForTag generates accurate BSM data for tag 0055123456 (Happy Path)', () => {
  const bsm = generateBsmForTag('0055123456');
  const fixture = FIXTURE_SCENARIOS['0055123456'];

  assert.equal(bsm.isSimulatedDemoData, true);
  assert.equal(bsm.disclaimer, DEMO_DATA_DISCLAIMER);
  assert.equal(bsm.tagNumber, '0055123456');
  assert.equal(bsm.pnr, fixture.pnr);
  assert.equal(bsm.passengerSurname, fixture.surname);
  assert.equal(bsm.passengerFullName, fixture.passengerFullName);
  assert.equal(bsm.flightNumber, fixture.currentFlight);
  assert.equal(bsm.origin, fixture.origin);
  assert.equal(bsm.destination, fixture.destination);
  assert.equal(bsm.airlineCode, '055');
  assert.equal(bsm.airlineName, 'Nimbus Airways');
});

test('generateBsmForTag generates accurate BSM data for tag 0055123457 (Connection Risk)', () => {
  const bsm = generateBsmForTag('0055123457');
  const fixture = FIXTURE_SCENARIOS['0055123457'];

  assert.equal(bsm.tagNumber, '0055123457');
  assert.equal(bsm.pnr, 'NBFX02');
  assert.equal(bsm.passengerSurname, 'LINDQVIST');
  assert.equal(bsm.flightNumber, fixture.currentFlight);
  assert.equal(bsm.origin, fixture.origin);
  assert.equal(bsm.destination, fixture.destination);
});

test('generateBsmForTag generates accurate BSM data for tag 0055123458 (Missed Connection)', () => {
  const bsm = generateBsmForTag('0055123458');
  const fixture = FIXTURE_SCENARIOS['0055123458'];

  assert.equal(bsm.tagNumber, '0055123458');
  assert.equal(bsm.pnr, 'NBFX03');
  assert.equal(bsm.passengerSurname, 'FERREIRA');
  assert.equal(bsm.flightNumber, fixture.currentFlight);
  assert.equal(bsm.origin, fixture.origin);
  assert.equal(bsm.destination, fixture.destination);
});

test('Raw BSM text formatting includes standard IATA tags and banner', () => {
  const fixture = FIXTURE_SCENARIOS['0055123456'];
  const rawText = formatRawBsmText(fixture);

  assert(rawText.includes(DEMO_BANNER), 'Must include demo disclaimer banner');
  assert(rawText.includes('BSM'), 'Must contain BSM header');
  assert(rawText.includes('.N/0055123456'), 'Must contain .N/ tag number tag preserving 00s');
  assert(rawText.includes('.P/OKAFOR/CHIDI'), 'Must contain .P/ passenger tag');
  assert(rawText.includes('.F/NB201/11OCT/ARC/PNX'), 'Must contain .F/ flight segment tag');
  assert(rawText.includes('.Y/PNX'), 'Must contain .Y/ destination tag');
  assert(rawText.includes('ENDBSM'), 'Must contain ENDBSM footer');
});

test('generateAllDemoBsms returns valid BSM objects for all 3 demo tags', () => {
  const bsms = generateAllDemoBsms();
  assert.equal(bsms.length, 3);

  const tags = bsms.map(b => b.tagNumber);
  assert.deepEqual(tags, ['0055123456', '0055123457', '0055123458']);

  bsms.forEach(bsm => {
    assert.equal(bsm.isSimulatedDemoData, true);
    assert.equal(bsm.disclaimer, DEMO_DATA_DISCLAIMER);
    assert(bsm.rawBsmText.includes('=== SIMULATED BSM-STYLE DEMO DATA'));
  });
});

test('generateBsmForTag throws helpful error for unknown tag', () => {
  assert.throws(
    () => {
      generateBsmForTag('9999999999');
    },
    {
      name: 'Error',
      message: /No fictional fixture record found for tag number 9999999999/
    }
  );
});
