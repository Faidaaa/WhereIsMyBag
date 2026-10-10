/**
 * Server Bootstrap Entrypoint
 * Reference: CONTRACT.md Section 2 (Runs on http://localhost:3001 in development)
 */

require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`[WhereIsMyBag API] Server is running on http://localhost:${PORT}/api`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[WhereIsMyBag API] SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[WhereIsMyBag API] SIGINT received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
