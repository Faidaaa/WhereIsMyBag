/**
 * Express Application Setup
 * Reference: CONTRACT.md Section 2
 */

const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json());

// Mount API routes under /api base path (CONTRACT.md Section 2)
app.use('/api', apiRoutes);

// Health check / root info
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'WhereIsMyBag API' });
});

// 404 Not Found Handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.originalUrl} does not exist.`,
      details: null
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred.',
      details: process.env.NODE_ENV === 'development' ? err.stack : null
    }
  });
});

module.exports = app;
