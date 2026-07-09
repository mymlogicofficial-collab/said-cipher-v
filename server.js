#!/usr/bin/env node

/**
 * S.A.I.D. Cipher Backend Server
 * Standalone Express server for Railway deployment
 * Runs the backend API for multimodal AI agent
 */

require('dotenv').config();
const server = require('./server/index.js');

const PORT = process.env.PORT || 9471;

server.listen(PORT, () => {
  console.log(`\n✓ Cipher Backend running on port ${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ API endpoints ready\n`);
});

