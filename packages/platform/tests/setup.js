const { initializeDatabase, initializeDbProxy } = require('../lib/database');

/**
 * Test setup - Initialize database for testing
 */
async function setupTests() {
  try {
    // Initialize database connection
    const database = await initializeDatabase();

    // Initialize the proxy to make db exports work
    initializeDbProxy(database);

    console.log('✅ Test database initialized');
    return database;
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error);
    throw error;
  }
}

module.exports = { setupTests };
