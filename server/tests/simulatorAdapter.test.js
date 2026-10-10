const { test, describe } = require('node:test');
const assert = require('node:assert');
const SimulatorBaggageAdapter = require('../src/adapters/simulatorAdapter');

describe('Simulator Baggage Adapter', () => {
  const adapter = new SimulatorBaggageAdapter();

  test('successfully verifies valid passenger credentials', async () => {
    const result = await adapter.verifyPassenger({
      tagNumber: '0123456789',
      surname: 'smith', // case-insensitive check
      pnr: 'WIMB01'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.bag.tagNumber, '0123456789');
    assert.strictEqual(result.bag.passengerSurname, 'SMITH');
  });

  test('rejects mismatched surname with VERIFICATION_FAILED', async () => {
    const result = await adapter.verifyPassenger({
      tagNumber: '0123456789',
      surname: 'WRONG_NAME',
      pnr: 'WIMB01'
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, 'VERIFICATION_FAILED');
  });

  test('rejects non-existent bag tag with TAG_NOT_FOUND', async () => {
    const result = await adapter.verifyPassenger({
      tagNumber: '9999999999',
      surname: 'SMITH',
      pnr: 'WIMB01'
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, 'TAG_NOT_FOUND');
  });

  test('filters out INTERNAL_ONLY events and strips internalNotes for passenger timeline (CONTRACT.md Section 5)', async () => {
    const timeline = await adapter.getTimeline('0123456789');
    assert.strictEqual(timeline.success, true);

    const { events } = timeline.data;
    assert.ok(events.length > 0, 'Must contain passenger events');

    for (const evt of events) {
      assert.strictEqual(evt.visibility, 'PASSENGER', 'All timeline events must be PASSENGER visible');
      assert.strictEqual(evt.internalNotes, null, 'Internal notes must be null for passenger view');
    }

    // Verify internal sorting event was filtered out
    const internalEvent = events.find((e) => e.step === 'SORTED_TO_CONTAINER');
    assert.strictEqual(internalEvent, undefined, 'Internal BHS sorting scan should not be present');
  });

  test('generates correct reference number format for delayed reports (WIMB-DEL-YYYYMMDD-XXXX)', async () => {
    const reportData = {
      tagNumber: '0555666777',
      pnr: 'WIMB04',
      passengerSurname: 'MUELLER',
      deliveryAddress: '123 Fake Street, CA',
      contactPhone: '+1-555-0199',
      contactEmail: 'test@example.com',
      bagDescription: 'Black roller suitcase',
      notes: null
    };

    const result = await adapter.submitDelayedReport(reportData);
    assert.ok(
      /^WIMB-DEL-\d{8}-\d{4}$/.test(result.referenceNumber),
      `Reference number ${result.referenceNumber} must match format WIMB-DEL-YYYYMMDD-XXXX`
    );
    assert.strictEqual(result.status, 'SUBMITTED');
  });

  test('returns all 4 demo scenarios in getScenariosList', () => {
    const scenarios = adapter.getScenariosList();
    assert.strictEqual(scenarios.length, 4);
    assert.ok(scenarios.some((s) => s.id === 'successful_journey'));
    assert.ok(scenarios.some((s) => s.id === 'incorrect_verification'));
    assert.ok(scenarios.some((s) => s.id === 'connection_risk'));
    assert.ok(scenarios.some((s) => s.id === 'missed_connection'));
  });
});
