import type { TestSuite } from '@elizaos/core';
import comprehensiveTests from '../__tests__/e2e';
// import runtimeTests from '../__tests__/old-tests/runtime'; // Path doesn't exist
import RolodexSQLCompatibilityTestSuite from '../__tests__/e2e/sql-compatibility.test';

// Export all test suites, prioritizing SQL compatibility
export const testSuites: TestSuite[] = [
  // SQL compatibility tests first (most critical for fixing compatibility issues)
  RolodexSQLCompatibilityTestSuite,

  // Runtime tests using real ElizaOS runtime with LLM
  // runtimeTests, // Commented out - missing import

  // Comprehensive E2E test suite
  comprehensiveTests,
];

// Main test suite for the plugin - prioritize SQL compatibility tests
export const rolodexTestSuite: TestSuite = {
  name: 'Rolodex Plugin Test Suite',
  tests: [
    // SQL compatibility tests first
    ...RolodexSQLCompatibilityTestSuite.tests,
    // Then other tests
    // ...runtimeTests.tests, // Commented out - missing import
    ...comprehensiveTests.tests,
  ],
};

export default rolodexTestSuite;
