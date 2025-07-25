export default {
  // Use a unique port for plugin-experience tests to avoid conflicts
  serverPort: 3456,
  
  // Test environment settings
  env: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    PORT: '3456',
    SERVER_PORT: '3456',
  },
  
  // Test database configuration
  database: {
    type: 'pglite',
    dataDir: './test-data',
  },
  
  // Test timeouts
  timeouts: {
    test: 60000,
    e2e: 120000,
  },
  
  // Agent configuration for tests
  agent: {
    name: 'ExperienceTestAgent',
    modelProvider: 'openai',
    model: 'gpt-4o-mini',
  },
}; 