#!/usr/bin/env node

// Simple wrapper that imports the external dependencies and then loads the built server
import 'uuid';
import 'pino';
import 'pino-pretty';

// Set production environment variables for proper logging
process.env.NODE_ENV = 'production';
process.env.LOG_JSON_FORMAT = 'true';
process.env.DOCKER_CONTAINER = 'true';

// Import and run the built server
import('./dist-backend/server.js');
