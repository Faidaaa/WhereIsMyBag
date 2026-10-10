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

const {
  renderBarcodesDemoPage,
  getBarcodePng,
  getBsmData
} = require('../controllers/demoController');

// Base /api Root & Health Check Endpoints
const healthResponse = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'WhereIsMyBag API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      demoBarcodes: '/api/demo/barcodes',
      verify: 'POST /api/verify',
      timeline: 'GET /api/bags/:tagNumber/timeline',
      scenarios: '/api/scenarios',
      bsm: '/api/bsm'
    }
  });
};

router.get('/', healthResponse);
router.get('/health', healthResponse);

const { verifyRateLimiter } = require('../middleware/rateLimiter');

// 3.1 Verification Endpoint (with rate limiting protection)
router.post('/verify', verifyRateLimiter, verifyPassenger);

// 3.2 Baggage Timeline Snapshot (REST Fallback)
router.get('/bags/:tagNumber/timeline', getTimeline);

// 3.3 Real-Time Baggage Stream (Server-Sent Events)
router.get('/bags/:tagNumber/stream', streamBaggageUpdates);
router.get('/bag/:tagNumber/stream', streamBaggageUpdates);
router.get('/bags/:tag/stream', streamBaggageUpdates);
router.get('/bag/:tag/stream', streamBaggageUpdates);

// 3.4 Delayed Baggage Report Submission
router.post('/reports/delayed', submitDelayedReport);

// 3.5 Demo Scenarios Meta-Endpoint
router.get('/scenarios', getScenarios);

// 3.6 Demo Barcodes Printable Page & Image Serving
router.get('/demo/barcodes', renderBarcodesDemoPage);
router.get('/barcodes/demo', renderBarcodesDemoPage);
router.get('/barcodes/:tagNumber.png', getBarcodePng);
router.get('/barcodes/:tagNumber', getBarcodePng);

// 3.7 Simulated BSM Baggage Source Message Endpoints
router.get('/bsm', getBsmData);
router.get('/bsm/:tagNumber', getBsmData);

module.exports = router;
