/**
 * Test setup file - runs before all tests
 * Sets up environment variables and mocks needed for testing
 */

// Set required environment variables BEFORE any imports that validate them
(process.env as any).NODE_ENV = 'test';
process.env.JWT_SECRET =
  'test-jwt-secret-that-is-definitely-long-enough-to-pass-all-validation-requirements-and-then-some';
process.env.ELIZA_AGENT_URL = 'http://localhost:3001';
process.env.ELIZA_AGENT_TOKEN = 'test-token-123';
process.env.DATABASE_URL = 'pglite://./test-data/test.db';

// Keep console output for debugging tests
// global.console = {
//   ...console,
//   log: () => {},
//   warn: () => {},
//   error: () => {},
//   info: () => {},
//   debug: () => {},
// };
