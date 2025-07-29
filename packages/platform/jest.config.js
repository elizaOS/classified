export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testTimeout: 30000,
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@elizaos/(.*)$': '<rootDir>/../$1/src',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@tauri-apps/api/tauri$': '<rootDir>/__mocks__/@tauri-apps/api/tauri.js',
    '^@tauri-apps/api/shell$': '<rootDir>/__mocks__/@tauri-apps/api/shell.js',
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  testPathIgnorePatterns: [
    '<rootDir>/tests/integration/eliza-runtime-integration.test.ts',
    '<rootDir>/tests/integration/real-runtime.test.ts',
    '<rootDir>/tests/security/security-fixes.test.ts',
    '<rootDir>/tests/runtime/api-key-integration.test.ts',
    '<rootDir>/tests/runtime/eliza-database-adapter.test.ts',
    '<rootDir>/tests/security/comprehensive-security-test.test.ts',
    '<rootDir>/tests/runtime/platform-runtime-integration.test.ts',
    '<rootDir>/tests/integration/api-integration.test.ts',
    '<rootDir>/tests/performance/load-test.test.ts',
    '<rootDir>/tests/runtime/core-billing-test.test.ts',
    '<rootDir>/tests/runtime/platform-only-test.test.ts',
    '<rootDir>/tests/runtime/agent-billing-scenario.test.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  globalTeardown: '<rootDir>/jest.teardown.js',
  globals: {
    'import.meta': {
      env: {
        SECRET_SALT: 'test-secret-salt',
        NODE_ENV: 'test',
      },
    },
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          target: 'ES2022',
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@elizaos|node-fetch|fetch-blob|data-uri-to-buffer|formdata-polyfill|@ai-sdk|zod|nanoid|.*\\.mjs$))',
  ],
  resolver: undefined, // Let Jest handle module resolution
};
