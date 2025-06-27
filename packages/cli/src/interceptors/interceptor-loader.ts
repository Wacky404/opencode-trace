// Runtime interceptor loader for Node.js
// This file will be compiled to CommonJS to work with Node.js require hooks

import { initializeServerInterception } from './server-interceptor.js';
import type { InterceptionConfig } from '../types/cli.js';

// Get session configuration from environment
const sessionId = process.env.OPENCODE_TRACE_SESSION_ID || 'default';
const traceDir = process.env.OPENCODE_TRACE_DIR || '.opencode-trace';
const debug = process.env.OPENCODE_TRACE_DEBUG === 'true';

if (debug) {
  console.log(`[interceptor-loader] Initializing interception for session: ${sessionId}`);
}

// Initialize interception when this module is loaded
try {
  const config: InterceptionConfig = {
    traceDir,
    debug,
    includeAllRequests: process.env.OPENCODE_TRACE_INCLUDE_ALL === 'true',
    maxBodySize: parseInt(process.env.OPENCODE_TRACE_MAX_BODY_SIZE || '1048576', 10)
  };

  initializeServerInterception(sessionId, config);
  
  if (debug) {
    console.log('[interceptor-loader] Interception initialized successfully');
  }
} catch (error) {
  console.error('[interceptor-loader] Failed to initialize interception:', error);
}