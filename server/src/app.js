/**
 * Express Application Setup
 * Reference: CONTRACT.md Section 2
 */

const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/apiRoutes');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json());

// Mount API routes under /api base path (CONTRACT.md Section 2)
app.use('/api', apiRoutes);

// Health check fallback at root / and /health
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'WhereIsMyBag API' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'WhereIsMyBag API' });
});

// Safe 404 handler for unknown routes
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
