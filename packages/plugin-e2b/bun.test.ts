// Bun test configuration for ElizaOS E2B plugin package
export default {
  // Test patterns
  testMatch: ['src/**/*.test.{js,ts}', 'src/**/*.spec.{js,ts}', 'src/__tests__/**/*.{js,ts}'],

  // Coverage configuration
  coverage: {
    reporter: ['text', 'json', 'html'],
    include: ['src/**/*'],
    exclude: [
      'src/test/**',
      'src/**/*.test.*',
      'src/**/*.spec.*',
      'src/__tests__/**',
      'src/**/*.d.ts',
    ],
  },

  // Test timeout
  timeout: 60000, // Longer timeout for E2B sandbox tests

  // Environment
  env: {
    NODE_ENV: 'test',
  },
};
