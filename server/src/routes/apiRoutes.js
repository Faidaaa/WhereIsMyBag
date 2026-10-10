/**
 * API Routes for WhereIsMyBag
 * Reference: CONTRACT.md Section 3
 */

const express = require('express');
const router = express.Router();

const {
  verifyPassenger,
  getTimeline,
  streamBaggageUpdates,
  submitDelayedReport,
  getScenarios
} = require('../controllers/baggageController');

// Health Check Endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'WhereIsMyBag API'
  });
});

// 3.1 Verification Endpoint
router.post('/verify', verifyPassenger);

// 3.2 Baggage Timeline Snapshot (REST Fallback)
router.get('/bags/:tagNumber/timeline', getTimeline);

// 3.3 Real-Time Baggage Stream (Server-Sent Events)
router.get('/bags/:tagNumber/stream', streamBaggageUpdates);

// 3.4 Delayed Baggage Report Submission
router.post('/reports/delayed', submitDelayedReport);

// 3.5 Demo Scenarios Meta-Endpoint
router.get('/scenarios', getScenarios);

module.exports = router;
