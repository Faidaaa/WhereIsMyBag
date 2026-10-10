/**
 * Unit Tests: Baggage Simulation Engine & State Machine
 * (server/tests/simulationEngine.test.js)
 *
 * Verifies that:
 *  1. State Machine enforces realistic, valid event order
 *  2. All 3 required demo scenarios complete cleanly (0055123456, 0055123457, 0055123458)
 *  3. Unknown tags return proper error response without crashing
 *  4. Timer cleanup and scenario stopping work reliably (no memory leaks)
 *  5. Duplicate subscriptions are prevented
 *  6. Repeat runs execute cleanly from start to finish
 *  7. Public event payloads meet CONTRACT.md Section 4 & 5 privacy rules (internalNotes: null)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BaggageStateMachine,
  BaggageSimulationEngine,
  sanitizeForPublic
} = require('../src/services/simulationEngine');
const { FIXTURE_SCENARIOS } = require('../src/data/fixtures');

// Helper to wait for ms
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// PART 1: State Machine & Event Order Validation
// ============================================================================

test('BaggageStateMachine validates valid steps, categories, and statuses', () => {
  assert.equal(BaggageStateMachine.isValidStep('CHECKED_IN'), true);
  assert.equal(BaggageStateMachine.isValidStep('CLAIMED'), true);
  assert.equal(BaggageStateMachine.isValidStep('UNKNOWN_STEP'), false);

  assert.equal(BaggageStateMachine.isValidCategory('CHECK_IN'), true);
  assert.equal(BaggageStateMachine.isValidCategory('EXCEPTION'), true);
  assert.equal(BaggageStateMachine.isValidCategory('INVALID_CAT'), false);

  assert.equal(BaggageStateMachine.isValidStatus('COMPLETED'), true);
  assert.equal(BaggageStateMachine.isValidStatus('WARNING'), true);
  assert.equal(BaggageStateMachine.isValidStatus('INVALID_STAT'), false);
});

test('BaggageStateMachine validates realistic step transitions', () => {
  assert.equal(BaggageStateMachine.canTransition('CHECKED_IN', 'SECURITY_SCREENED'), true);
  assert.equal(BaggageStateMachine.canTransition('SECURITY_SCREENED', 'LOADED_ON_AIRCRAFT'), true);
  assert.equal(BaggageStateMachine.canTransition('LOADED_ON_AIRCRAFT', 'DEPARTED'), true);
  assert.equal(BaggageStateMachine.canTransition('TRANSFER_SORTED', 'TRANSFER_TIGHT_CONNECTION'), true);
  assert.equal(BaggageStateMachine.canTransition('TRANSFER_TIGHT_CONNECTION', 'LOADED_CONNECTING_FLIGHT'), true);
  assert.equal(BaggageStateMachine.canTransition('TRANSFER_SORTED', 'MISSED_CONNECTION'), true);

  // Invalid transitions
  assert.equal(BaggageStateMachine.canTransition('CLAIMED', 'CHECKED_IN'), false);
  assert.equal(BaggageStateMachine.canTransition('CHECKED_IN', 'DELIVERED_TO_CAROUSEL'), false);
  assert.equal(BaggageStateMachine.canTransition('DEPARTED', 'CHECKED_IN'), false);
});

test('BaggageStateMachine validates event sequences for all three demo tags', () => {
  const demoTags = ['0055123456', '0055123457', '0055123458'];

  demoTags.forEach((tag) => {
    const fixture = FIXTURE_SCENARIOS[tag];
    assert(fixture, `Fixture record must exist for tag ${tag}`);

    const res = BaggageStateMachine.validateSequence(fixture.events);
    assert.equal(res.isValid, true, `Sequence for tag ${tag} must be valid: ${res.error}`);
  });
});

test('BaggageStateMachine rejects invalid or out-of-order event sequence', () => {
  const invalidSequence = [
    { step: 'CHECKED_IN', category: 'CHECK_IN', status: 'COMPLETED' },
    { step: 'CLAIMED', category: 'ARRIVAL', status: 'COMPLETED' } // Impossible jump
  ];

  const res = BaggageStateMachine.validateSequence(invalidSequence);
  assert.equal(res.isValid, false);
  assert(res.error.includes('Invalid state transition'));
});

// ============================================================================
// PART 2: Scenario Execution & Completion for Demo Tags
// ============================================================================

test('Engine completes scenario 0055123456 (normal baggage journey)', async () => {
  const engine = new BaggageSimulationEngine({ stepDelayMs: 5 });
  const receivedEvents = [];
  let isComplete = false;

  const result = engine.subscribe('0055123456', (msg) => {
    if (msg.type === 'baggage-event') {
      receivedEvents.push(msg.data);
    }
    if (msg.type === 'stream-complete') {
      isComplete = true;
    }
  });

  assert.equal(result.success, true);
  await sleep(100);

  assert.equal(isComplete, true);
  assert(receivedEvents.length >= 5);
  assert.equal(receivedEvents[0].step, 'CHECKED_IN');
  assert.equal(receivedEvents[receivedEvents.length - 1].step, 'CLAIMED');

  engine.stopAllSimulations();
});

test('Engine completes scenario 0055123457 (connection at risk)', async () => {
  const engine = new BaggageSimulationEngine({ stepDelayMs: 5 });
  const receivedEvents = [];
  const riskAlerts = [];
  let isComplete = false;

  engine.subscribe('0055123457', (msg) => {
    if (msg.type === 'baggage-event') {
      receivedEvents.push(msg.data);
    }
    if (msg.type === 'risk-alert') {
      riskAlerts.push(msg.data);
    }
    if (msg.type === 'stream-complete') {
      isComplete = true;
    }
  });

  await sleep(150);

  assert.equal(isComplete, true);
  const steps = receivedEvents.map((e) => e.step);
  assert(steps.includes('TRANSFER_TIGHT_CONNECTION'));
  assert(steps.includes('LOADED_CONNECTING_FLIGHT'));
  assert(riskAlerts.length > 0);

  engine.stopAllSimulations();
});

test('Engine completes scenario 0055123458 (missed connection)', async () => {
  const engine = new BaggageSimulationEngine({ stepDelayMs: 5 });
  const receivedEvents = [];
  const riskAlerts = [];
  let isComplete = false;

  engine.subscribe('0055123458', (msg) => {
    if (msg.type === 'baggage-event') {
      receivedEvents.push(msg.data);
    }
    if (msg.type === 'risk-alert') {
      riskAlerts.push(msg.data);
    }
    if (msg.type === 'stream-complete') {
      isComplete = true;
    }
  });

  await sleep(100);

  assert.equal(isComplete, true);
  const lastEvent = receivedEvents[receivedEvents.length - 1];
  assert.equal(lastEvent.step, 'MISSED_CONNECTION');
  assert(riskAlerts.some((r) => r.riskLevel === 'CRITICAL' && r.eligibleForDelayedReport === true));

  engine.stopAllSimulations();
});

// ============================================================================
// PART 3: Unknown Tag Handling
// ============================================================================

test('Engine handles unknown tag numbers gracefully without throwing', () => {
  const engine = new BaggageSimulationEngine({ stepDelayMs: 5 });
  const result = engine.subscribe('9999999999', () => {});

  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'TAG_NOT_FOUND');
  assert(result.errorMessage.includes('9999999999'));
  assert.equal(typeof result.unsubscribe, 'function');
});

// ============================================================================
// PART 4: Timer Cleanup & Stopping Scenarios
// ============================================================================

test('stopSimulation stops active timers and halts event emission immediately', async () => {
  const engine = new BaggageSimulationEngine({ stepDelayMs: 50 });
  const receivedEvents = [];

  engine.subscribe('0055123456', (msg) => {
    if (msg.type === 'baggage-event') {
      receivedEvents.push(msg.data);
    }
  });

  await sleep(75); // Allow 1 or 2 events to fire
  const initialCount = receivedEvents.length;
  assert(initialCount > 0, 'Should have received initial events');

  // Stop simulation
  const stopped = engine.stopSimulation('0055123456');
  assert.equal(stopped, true);

  await sleep(200); // Wait longer than remaining events would take
  assert.equal(receivedEvents.length, initialCount, 'No further events should fire after stop');

  const status = engine.getSimulationStatus('0055123456');
  assert.equal(status, null, 'Session should be removed after stop');
});

test('Unsubscribing sole subscriber stops simulation and cleans up timers', async () => {
  const engine = new BaggageSimulationEngine({ stepDelayMs: 50 });
  const receivedEvents = [];

  const sub = engine.subscribe('0055123456', (msg) => {
    if (msg.type === 'baggage-event') {
      receivedEvents.push(msg.data);
    }
  });

  await sleep(75);
  const countAtUnsub = receivedEvents.length;
  assert(countAtUnsub > 0);

  sub.unsubscribe(); // Unsubscribe sole listener

  await sleep(200);
  assert.equal(receivedEvents.length, countAtUnsub);
  assert.equal(engine.getSimulationStatus('0055123456'), null);
});

test('stopAllSimulations cleans up all running simulation sessions', async () => {
  const engine = new BaggageSimulationEngine({ stepDelayMs: 50 });

  engine.subscribe('0055123456', () => {});
  engine.subscribe('0055123457', () => {});
  engine.subscribe('0055123458', () => {});

  assert.equal(engine.activeSessions.size, 3);

  engine.stopAllSimulations();

  assert.equal(engine.activeSessions.size, 0);
});

// ============================================================================
// PART 5: Duplicate Subscription Prevention & Subscriber Management
// ============================================================================

test('Engine prevents duplicate subscriptions with same callback function', async () => {
  const engine = new BaggageSimulationEngine({ stepDelayMs: 5 });
  let callCount = 0;

  const callback = (msg) => {
    if (msg.type === 'baggage-event') {
      callCount++;
    }
  };

  // Subscribe same callback twice
  const res1 = engine.subscribe('0055123456', callback);
  const res2 = engine.subscribe('0055123456', callback);

  assert.equal(res1.success, true);
  assert.equal(res2.success, true);

  const status = engine.getSimulationStatus('0055123456');
  assert.equal(status.subscriberCount, 1, 'Subscriber count must be 1 (duplicate ignored)');

  await sleep(100);

  // Single subscriber should receive each event exactly once
  const expectedTotal = FIXTURE_SCENARIOS['0055123456'].events.filter(
    (e) => e.visibility !== 'INTERNAL_ONLY'
  ).length;

  assert.equal(callCount, expectedTotal);

  engine.stopAllSimulations();
});

// ============================================================================
// PART 6: Repeat Runs
// ============================================================================

test('Engine allows repeat runs of the same scenario sequentially', async () => {
  const engine = new BaggageSimulationEngine({ stepDelayMs: 5 });

  // Run 1
  let run1Events = 0;
  engine.subscribe('0055123456', (msg) => {
    if (msg.type === 'baggage-event') run1Events++;
  });

  await sleep(100);
  assert(run1Events > 0);

  // Ensure cleaned up
  engine.stopSimulation('0055123456');

  // Run 2 (Repeat)
  let run2Events = 0;
  let run2Complete = false;
  engine.subscribe('0055123456', (msg) => {
    if (msg.type === 'baggage-event') run2Events++;
    if (msg.type === 'stream-complete') run2Complete = true;
  });

  await sleep(100);
  assert.equal(run2Complete, true);
  assert.equal(run2Events, run1Events);

  engine.stopAllSimulations();
});

// ============================================================================
// PART 7: Privacy & Visible Event Field Compliance (CONTRACT.md Section 4 & 5)
// ============================================================================

test('sanitizeForPublic filters out INTERNAL_ONLY events and enforces internalNotes: null', () => {
  const internalEvent = {
    id: 'evt_int_01',
    tagNumber: '0055123456',
    step: 'SORTED_TO_CONTAINER',
    category: 'SORTING',
    status: 'COMPLETED',
    visibility: 'INTERNAL_ONLY',
    internalNotes: 'Optical scanner pulse verified'
  };

  assert.equal(sanitizeForPublic(internalEvent), null);

  const passengerEvent = {
    id: 'evt_p_01',
    tagNumber: '0055123456',
    step: 'CHECKED_IN',
    category: 'CHECK_IN',
    status: 'COMPLETED',
    flightNumber: 'NB201',
    airportCode: 'ARC',
    location: 'Zone C Counter 14',
    timestamp: '2026-10-11T06:15:00.000Z',
    estimatedTimestamp: null,
    description: 'Bag checked in at ARC',
    visibility: 'PASSENGER',
    internalNotes: 'Diagnostic log'
  };

  const sanitized = sanitizeForPublic(passengerEvent);
  assert(sanitized !== null);
  assert.equal(sanitized.visibility, 'PASSENGER');
  assert.equal(sanitized.internalNotes, null, 'internalNotes must be strictly null for passenger events');
  assert.equal(sanitized.tagNumber, '0055123456');
});
