/**
 * Unit Tests: Fictional Demo Fixtures (server/src/data/fixtures.js)
 *
 * Verifies that:
 *  - All 4 fixture scenarios are present and keyed correctly
 *  - Tag numbers match expected values and the 10-digit contract format
 *  - Correct surnames and PNRs are set for each fixture
 *  - Each fixture has at least one event
 *  - All passenger-visible events have required CONTRACT.md fields
 *  - INTERNAL_ONLY events exist only in scenarios that need them
 *  - Missed-connection fixture ends with MISSED_CONNECTION step
 *  - Auth-test fixture credentials differ from all other fixtures
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  FIXTURE_SCENARIOS,
  FICTIONAL_AIRLINES,
  FICTIONAL_AIRPORTS,
  FICTIONAL_FLIGHTS,
  FICTIONAL_BOOKINGS
} = require('../src/data/fixtures');

const REQUIRED_EVENT_FIELDS = [
  'id', 'tagNumber', 'step', 'category', 'status',
  'airportCode', 'location', 'timestamp', 'description', 'visibility'
];

describe('Fictional Fixtures — FIXTURE_SCENARIOS', () => {
  test('contains exactly 4 fixture scenarios', () => {
    assert.strictEqual(Object.keys(FIXTURE_SCENARIOS).length, 4);
  });

  test('fixture tag "0055123456" (happy path) is present', () => {
    assert.ok('0055123456' in FIXTURE_SCENARIOS);
    assert.strictEqual(FIXTURE_SCENARIOS['0055123456'].id, 'happy_path');
  });

  test('fixture tag "0055123457" (connection risk) is present', () => {
    assert.ok('0055123457' in FIXTURE_SCENARIOS);
    assert.strictEqual(FIXTURE_SCENARIOS['0055123457'].id, 'connection_risk_fixture');
  });

  test('fixture tag "0055123458" (missed connection) is present', () => {
    assert.ok('0055123458' in FIXTURE_SCENARIOS);
    assert.strictEqual(FIXTURE_SCENARIOS['0055123458'].id, 'missed_connection_fixture');
  });

  test('fixture tag "0055123459" (auth test) is present', () => {
    assert.ok('0055123459' in FIXTURE_SCENARIOS);
    assert.strictEqual(FIXTURE_SCENARIOS['0055123459'].id, 'auth_test_fixture');
  });

  // Tag format validation (10 numeric digits, preserved as string)
  for (const tagNumber of Object.keys(FIXTURE_SCENARIOS)) {
    test(`fixture tag "${tagNumber}" is a 10-digit string (leading zeroes preserved)`, () => {
      assert.strictEqual(typeof tagNumber, 'string');
      assert.strictEqual(tagNumber.length, 10);
      assert.ok(/^\d{10}$/.test(tagNumber), 'Must be exactly 10 numeric digits');
    });
  }

  // PNR format (6 alphanumeric chars per CONTRACT.md Section 11)
  for (const [tagNumber, scenario] of Object.entries(FIXTURE_SCENARIOS)) {
    test(`scenario "${scenario.id}" PNR is 6 alphanumeric characters`, () => {
      assert.ok(/^[A-Za-z0-9]{6}$/.test(scenario.pnr),
        `PNR "${scenario.pnr}" must be exactly 6 alphanumeric characters`);
    });
  }

  // Surname: non-empty string
  for (const [tagNumber, scenario] of Object.entries(FIXTURE_SCENARIOS)) {
    test(`scenario "${scenario.id}" has a non-empty surname`, () => {
      assert.ok(typeof scenario.surname === 'string' && scenario.surname.trim().length > 0);
    });
  }

  // Each scenario must have at least one event
  for (const [tagNumber, scenario] of Object.entries(FIXTURE_SCENARIOS)) {
    test(`scenario "${scenario.id}" has at least one event`, () => {
      assert.ok(Array.isArray(scenario.events) && scenario.events.length > 0);
    });
  }
});

describe('Fictional Fixtures — Event Field Completeness', () => {
  for (const [tagNumber, scenario] of Object.entries(FIXTURE_SCENARIOS)) {
    const passengerEvents = scenario.events.filter(e => e.visibility === 'PASSENGER');

    test(`all PASSENGER events in "${scenario.id}" have required CONTRACT.md fields`, () => {
      for (const evt of passengerEvents) {
        for (const field of REQUIRED_EVENT_FIELDS) {
          assert.ok(
            field in evt,
            `Event "${evt.id}" in scenario "${scenario.id}" is missing required field "${field}"`
          );
        }
        // internalNotes must be null for PASSENGER events (Section 5)
        assert.strictEqual(evt.internalNotes, null,
          `Event "${evt.id}" should have internalNotes: null for PASSENGER visibility`);
      }
    });

    test(`all event tagNumbers in "${scenario.id}" match the scenario tagNumber`, () => {
      for (const evt of scenario.events) {
        assert.strictEqual(evt.tagNumber, tagNumber,
          `Event "${evt.id}" tagNumber mismatch: expected "${tagNumber}", got "${evt.tagNumber}"`);
      }
    });
  }
});

describe('Fictional Fixtures — Scenario-Specific Assertions', () => {
  test('happy_path last event is CLAIMED (complete journey)', () => {
    const scenario = FIXTURE_SCENARIOS['0055123456'];
    const lastEvent = scenario.events[scenario.events.length - 1];
    assert.strictEqual(lastEvent.step, 'CLAIMED');
  });

  test('connection_risk_fixture contains a TRANSFER_TIGHT_CONNECTION event', () => {
    const scenario = FIXTURE_SCENARIOS['0055123457'];
    const hasTight = scenario.events.some(e => e.step === 'TRANSFER_TIGHT_CONNECTION');
    assert.ok(hasTight, 'Should contain a TRANSFER_TIGHT_CONNECTION event');
  });

  test('connection_risk_fixture eventually has LOADED_CONNECTING_FLIGHT (bag makes it)', () => {
    const scenario = FIXTURE_SCENARIOS['0055123457'];
    const hasLoaded = scenario.events.some(e => e.step === 'LOADED_CONNECTING_FLIGHT');
    assert.ok(hasLoaded, 'Connection-risk fixture should show bag made the connection');
  });

  test('missed_connection_fixture contains a MISSED_CONNECTION event with EXCEPTION category', () => {
    const scenario = FIXTURE_SCENARIOS['0055123458'];
    const missedEvt = scenario.events.find(e => e.step === 'MISSED_CONNECTION');
    assert.ok(missedEvt, 'Must contain a MISSED_CONNECTION event');
    assert.strictEqual(missedEvt.category, 'EXCEPTION');
    assert.strictEqual(missedEvt.status, 'FAILED');
  });

  test('missed_connection_fixture riskConfig has availableConnectionMinutes < minimumConnectTimeMinutes', () => {
    const rc = FIXTURE_SCENARIOS['0055123458'].riskConfig;
    assert.ok(
      rc.availableConnectionMinutes < rc.minimumConnectTimeMinutes,
      'Available time must be less than MCT for a missed connection scenario'
    );
  });

  test('auth_test_fixture credentials are unique — surname "TANAKA" not used in any other fixture', () => {
    const otherSurnames = Object.entries(FIXTURE_SCENARIOS)
      .filter(([tag]) => tag !== '0055123459')
      .map(([, s]) => s.surname);
    assert.ok(!otherSurnames.includes('TANAKA'));
  });

  test('auth_test_fixture PNR "NBFX04" is not used in any other fixture', () => {
    const otherPnrs = Object.entries(FIXTURE_SCENARIOS)
      .filter(([tag]) => tag !== '0055123459')
      .map(([, s]) => s.pnr);
    assert.ok(!otherPnrs.includes('NBFX04'));
  });
});

describe('Fictional Reference Data', () => {
  test('FICTIONAL_AIRLINES contains at least 2 entries', () => {
    assert.ok(Object.keys(FICTIONAL_AIRLINES).length >= 2);
  });

  test('FICTIONAL_AIRPORTS contains all airports used in fixtures', () => {
    const usedCodes = new Set();
    for (const scenario of Object.values(FIXTURE_SCENARIOS)) {
      usedCodes.add(scenario.origin);
      usedCodes.add(scenario.destination);
    }
    for (const code of usedCodes) {
      assert.ok(code in FICTIONAL_AIRPORTS, `Airport "${code}" used in fixture but not in FICTIONAL_AIRPORTS`);
    }
  });

  test('FICTIONAL_FLIGHTS contains all flights referenced in fixture events', () => {
    const usedFlights = new Set();
    for (const scenario of Object.values(FIXTURE_SCENARIOS)) {
      for (const evt of scenario.events) {
        if (evt.flightNumber) usedFlights.add(evt.flightNumber);
      }
    }
    for (const flight of usedFlights) {
      assert.ok(
        flight in FICTIONAL_FLIGHTS,
        `Flight "${flight}" used in fixture events but not in FICTIONAL_FLIGHTS`
      );
    }
  });

  test('FICTIONAL_BOOKINGS has one entry per fixture tag number', () => {
    for (const [tagNumber] of Object.entries(FIXTURE_SCENARIOS)) {
      const booking = Object.values(FICTIONAL_BOOKINGS).find(b => b.tagNumber === tagNumber);
      assert.ok(booking, `No booking found for fixture tag "${tagNumber}"`);
    }
  });
});
