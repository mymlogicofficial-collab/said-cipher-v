#!/usr/bin/env node

/**
 * S.A.I.D. Cipher Backend Server
 * Standalone Express server for Railway deployment
 * Runs the backend API for multimodal AI agent
 */

require('dotenv').config();
const { createServer } = require('./server/index.js');

const PORT = process.env.PORT || 9471;

createServer(PORT)
  .then(() => {
    console.log(`✓ Cipher Backend listening on port ${PORT}`);
    console.log(`✓ Health check: http://localhost:${PORT}/health`);
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

