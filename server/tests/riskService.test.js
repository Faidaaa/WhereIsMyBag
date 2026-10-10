const { test, describe } = require('node:test');
const assert = require('node:assert');
const { calculateRisk } = require('../src/services/riskService');

describe('Risk Calculation Engine (CONTRACT.md Section 9)', () => {
  test('returns CRITICAL and eligibleForDelayedReport=true when milestone is MISSED_CONNECTION', () => {
    const result = calculateRisk({
      bagMilestone: 'MISSED_CONNECTION',
      availableConnectionMinutes: 30,
      minimumConnectTimeMinutes: 60
    });

    assert.strictEqual(result.riskLevel, 'CRITICAL');
    assert.strictEqual(result.score, 1.0);
    assert.strictEqual(result.eligibleForDelayedReport, true);
    assert.ok(result.factors.some((f) => f.code === 'MISSED_CONNECTION'));
  });

  test('returns HIGH risk when connection buffer is negative (< 0) and bag not loaded on connecting flight', () => {
    // 35 min available, 60 min MCT -> buffer = -25 min (< 0)
    const result = calculateRisk({
      bagMilestone: 'TRANSFER_TIGHT_CONNECTION',
      availableConnectionMinutes: 35,
      minimumConnectTimeMinutes: 60,
      isTerminalTransfer: false
    });

    assert.strictEqual(result.riskLevel, 'HIGH');
    assert.strictEqual(result.score, 0.85);
    assert.strictEqual(result.eligibleForDelayedReport, false);
    assert.ok(result.factors.some((f) => f.code === 'SHORT_LAYOVER'));
  });

  test('returns MEDIUM risk when buffer is less than 20 minutes', () => {
    // 70 min available, 60 min MCT -> buffer = 10 min (< 20)
    const result = calculateRisk({
      bagMilestone: 'ARRIVED_TRANSFER_HUB',
      availableConnectionMinutes: 70,
      minimumConnectTimeMinutes: 60,
      isTerminalTransfer: false
    });

    assert.strictEqual(result.riskLevel, 'MEDIUM');
    assert.strictEqual(result.score, 0.50);
    assert.strictEqual(result.eligibleForDelayedReport, false);
  });

  test('returns LOW risk when bag has been loaded onto connecting flight despite tight buffer', () => {
    const result = calculateRisk({
      bagMilestone: 'LOADED_CONNECTING_FLIGHT',
      availableConnectionMinutes: 35,
      minimumConnectTimeMinutes: 60
    });

    assert.strictEqual(result.riskLevel, 'LOW');
    assert.strictEqual(result.score, 0.10);
    assert.strictEqual(result.eligibleForDelayedReport, false);
  });

  test('applies 15-minute terminal transfer penalty', () => {
    // 65 min available, 60 min base MCT.
    // Without terminal transfer: buffer = 5 -> MEDIUM
    // With terminal transfer: effective MCT = 75 -> buffer = -10 -> HIGH
    const result = calculateRisk({
      bagMilestone: 'TRANSFER_UNLOADED',
      availableConnectionMinutes: 65,
      minimumConnectTimeMinutes: 60,
      isTerminalTransfer: true
    });

    assert.strictEqual(result.riskLevel, 'HIGH');
    assert.strictEqual(result.score, 0.85);
  });
});
