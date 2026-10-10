/**
 * Baggage Tracking Controller
 * Reference: CONTRACT.md Section 2, 3, 5, 6, 7, 11
 */

const SimulatorBaggageAdapter = require('../adapters/simulatorAdapter');
const { createVerificationToken, validateToken } = require('../services/authService');

const adapter = new SimulatorBaggageAdapter();

/**
 * Standard error response helper.
 */
function sendError(res, statusCode, code, message, details = null) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details
    }
  });
}

/**
 * Helper to extract bearer token from Authorization header.
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1].trim();
}

/**
 * POST /api/verify
 */
async function verifyPassenger(req, res) {
  const { tagNumber, surname, pnr } = req.body || {};

  // Input validation (Section 11)
  if (!tagNumber || !surname || !pnr) {
    return sendError(
      res,
      400,
      'INVALID_INPUT',
      'Missing required fields: tagNumber, surname, and pnr are required.'
    );
  }

  const isTenDigits = /^\d{10}$/.test(String(tagNumber).trim());
  if (!isTenDigits) {
    return sendError(
      res,
      400,
      'INVALID_INPUT',
      'tagNumber must be exactly 10 numeric digits.'
    );
  }

  const isSixAlphaNum = /^[A-Za-z0-9]{6}$/.test(String(pnr).trim());
  if (!isSixAlphaNum) {
    return sendError(
      res,
      400,
      'INVALID_INPUT',
      'pnr must be exactly 6 alphanumeric characters.'
    );
  }

  const cleanTag = String(tagNumber).trim();
  const cleanSurname = String(surname).trim();
  const cleanPnr = String(pnr).trim();

  const verificationResult = await adapter.verifyPassenger({
    tagNumber: cleanTag,
    surname: cleanSurname,
    pnr: cleanPnr
  });

  if (!verificationResult.success) {
    // Requirement 6: Generic authentication-failure response that does not reveal
    // whether the surname, PNR, or booking tag exists.
    return sendError(
      res,
      401,
      'VERIFICATION_FAILED',
      'Surname or PNR does not match records for this bag tag.'
    );
  }

  // Generate verification token (Section 6)
  const { token, expiresAt } = createVerificationToken({
    tagNumber: cleanTag,
    surname: cleanSurname,
    pnr: cleanPnr
  });

  return res.status(200).json({
    success: true,
    data: {
      verificationToken: token,
      expiresAt,
      bag: verificationResult.bag
    }
  });
}

/**
 * GET /api/bags/:tagNumber/timeline
 */
async function getTimeline(req, res) {
  const { tagNumber } = req.params;
  const token = extractBearerToken(req);

  // Validate token
  const auth = validateToken(token, tagNumber);
  if (!auth.valid) {
    const status = auth.errorCode === 'TOKEN_BAG_MISMATCH' ? 403 : 401;
    return sendError(res, status, auth.errorCode, auth.errorMessage);
  }

  const timelineResult = await adapter.getTimeline(tagNumber);
  if (!timelineResult.success) {
    return sendError(
      res,
      404,
      timelineResult.errorCode,
      timelineResult.errorMessage
    );
  }

  return res.status(200).json({
    success: true,
    data: timelineResult.data
  });
}

/**
 * GET /api/bags/:tagNumber/stream?token=<verificationToken>
 */
async function streamBaggageUpdates(req, res) {
  const { tagNumber } = req.params;
  const token = req.query.token;

  // Validate auth before opening SSE stream
  const auth = validateToken(token, tagNumber);
  if (!auth.valid) {
    const status = auth.errorCode === 'TOKEN_BAG_MISMATCH' ? 403 : 401;
    return sendError(res, status, auth.errorCode, auth.errorMessage);
  }

  // Verify bag exists
  const bagDetails = await adapter.getBagDetails(tagNumber);
  if (!bagDetails) {
    return sendError(
      res,
      404,
      'TAG_NOT_FOUND',
      'Tag number not found in airline system.'
    );
  }

  // Set SSE Headers (Section 7)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  });

  // Send initial connected event
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      message: 'Connected to WhereIsMyBag real-time simulation stream',
      tagNumber
    })}\n\n`
  );

  // Keep-alive heartbeat ping every 15s (Section 7.3)
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  // Support Last-Event-ID for reconnection (Section 7.4)
  const lastEventId = req.headers['last-event-id'];

  // Subscribe to simulator updates
  const unsubscribe = adapter.subscribeToUpdates(
    tagNumber,
    (msg) => {
      if (msg.type === 'baggage-event') {
        res.write(
          `id: ${msg.id}\nevent: baggage-event\ndata: ${JSON.stringify(
            msg.data
          )}\n\n`
        );
      } else if (msg.type === 'risk-alert') {
        res.write(
          `event: risk-alert\ndata: ${JSON.stringify(msg.data)}\n\n`
        );
      } else if (msg.type === 'stream-complete') {
        res.write(
          `event: stream-complete\ndata: ${JSON.stringify(msg.data)}\n\n`
        );
        cleanup();
        res.end();
      }
    },
    lastEventId
  );

  function cleanup() {
    clearInterval(pingInterval);
    unsubscribe();
  }

  req.on('close', () => {
    cleanup();
  });
}

/**
 * POST /api/reports/delayed
 */
async function submitDelayedReport(req, res) {
  const token = extractBearerToken(req);
  const {
    tagNumber,
    pnr,
    passengerSurname,
    deliveryAddress,
    contactPhone,
    contactEmail,
    bagDescription,
    notes
  } = req.body || {};

  // Validate token
  const auth = validateToken(token, tagNumber);
  if (!auth.valid) {
    const status = auth.errorCode === 'TOKEN_BAG_MISMATCH' ? 403 : 401;
    return sendError(res, status, auth.errorCode, auth.errorMessage);
  }

  // Field validations (Section 11)
  const errors = [];
  if (!tagNumber || !/^\d{10}$/.test(String(tagNumber).trim())) {
    errors.push('tagNumber must be exactly 10 digits.');
  }
  if (!pnr || !/^[A-Za-z0-9]{6}$/.test(String(pnr).trim())) {
    errors.push('pnr must be exactly 6 alphanumeric characters.');
  }
  if (!passengerSurname || !String(passengerSurname).trim()) {
    errors.push('passengerSurname is required.');
  }
  if (!deliveryAddress || String(deliveryAddress).trim().length < 5) {
    errors.push('deliveryAddress must be at least 5 characters long.');
  }
  if (!contactPhone || !/^\+?[\d\s\-()]{7,25}$/.test(String(contactPhone).trim())) {
    errors.push('contactPhone must be a valid phone number.');
  }
  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contactEmail).trim())) {
    errors.push('contactEmail must be a valid email address.');
  }
  if (!bagDescription || String(bagDescription).trim().length < 5) {
    errors.push('bagDescription must be at least 5 characters long.');
  }

  if (errors.length > 0) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      `Delayed baggage report validation failed: ${errors.join(' ')}`,
      errors
    );
  }

  const reportResult = await adapter.submitDelayedReport({
    tagNumber: String(tagNumber).trim(),
    pnr: String(pnr).trim(),
    passengerSurname: String(passengerSurname).trim(),
    deliveryAddress: String(deliveryAddress).trim(),
    contactPhone: String(contactPhone).trim(),
    contactEmail: String(contactEmail).trim(),
    bagDescription: String(bagDescription).trim(),
    notes: notes ? String(notes).trim() : null
  });

  return res.status(201).json({
    success: true,
    data: reportResult
  });
}

/**
 * GET /api/scenarios
 */
function getScenarios(req, res) {
  const scenarios = adapter.getScenariosList();
  return res.status(200).json({
    success: true,
    data: scenarios
  });
}

module.exports = {
  verifyPassenger,
  getTimeline,
  streamBaggageUpdates,
  submitDelayedReport,
  getScenarios,
  _adapterInstance: adapter
};
