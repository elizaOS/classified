import { elizaLogger } from '@elizaos/core';
import { RealWorldScenariosE2ETestSuite } from '../src/tests/e2e/real-world-scenarios.js';
import { E2BService } from '../src/services/E2BService.js';

// Test the real-world scenarios directly to check current pass rates
async function testRealWorldScenarios() {
  elizaLogger.info('🧪 Testing Real-World Scenarios Directly');

  // Mock runtime with minimal implementation
  const mockRuntime: any = {
    agentId: 'test-agent-id',
    getSetting: (key: string) => {
      switch (key) {
        case 'E2B_API_KEY':
          return process.env.E2B_API_KEY || 'test-key';
        default:
          return process.env[key];
      }
    },
    getService: (name: string) => {
      if (name === 'e2b') {
        return new E2BService(mockRuntime);
      }
      return null;
    },
    logger: elizaLogger,
  };

  const testSuite = new RealWorldScenariosE2ETestSuite();

  elizaLogger.info(`📋 Running ${testSuite.tests.length} real-world scenario tests`);

  let passedTests = 0;
  let failedTests = 0;
  const results: Array<{ name: string; status: 'PASS' | 'FAIL'; error?: string }> = [];

  for (let i = 0; i < testSuite.tests.length; i++) {
    const test = testSuite.tests[i];

    try {
      elizaLogger.info(`🏃 Running test ${i + 1}/${testSuite.tests.length}: ${test.name}`);

      const startTime = Date.now();
      await test.fn(mockRuntime);
      const duration = Date.now() - startTime;

      elizaLogger.info(`✅ PASS: ${test.name} (${duration}ms)`);
      passedTests++;
      results.push({ name: test.name, status: 'PASS' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      elizaLogger.error(`❌ FAIL: ${test.name} - ${errorMessage}`);
      failedTests++;
      results.push({
        name: test.name,
        status: 'FAIL',
        error: errorMessage,
      });
    }
  }

  // Summary
  elizaLogger.info('\n📊 TEST RESULTS SUMMARY');
  elizaLogger.info(`Total Tests: ${testSuite.tests.length}`);
  elizaLogger.info(
    `Passed: ${passedTests} (${Math.round((passedTests / testSuite.tests.length) * 100)}%)`
  );
  elizaLogger.info(
    `Failed: ${failedTests} (${Math.round((failedTests / testSuite.tests.length) * 100)}%)`
  );

  // Detailed results
  elizaLogger.info('\n📝 DETAILED RESULTS:');
  results.forEach((result, index) => {
    const emoji = result.status === 'PASS' ? '✅' : '❌';
    elizaLogger.info(`${emoji} ${index + 1}. ${result.name}`);
    if (result.error) {
      elizaLogger.info(`   Error: ${result.error}`);
    }
  });

  // Pass/fail determination
  const passRate = (passedTests / testSuite.tests.length) * 100;

  if (passRate === 100) {
    elizaLogger.info('🎉 ALL TESTS PASSED! 100% success rate achieved.');
    return { success: true, passRate, results };
  } else {
    elizaLogger.warn(`⚠️ NOT ALL TESTS PASSED. Current pass rate: ${passRate.toFixed(1)}%`);
    elizaLogger.warn('🎯 Target: 100% pass rate with real implementations');
    return { success: false, passRate, results };
  }
}

// Run if executed directly
if (import.meta.main) {
  testRealWorldScenarios()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      elizaLogger.error('Fatal error running tests:', error);
      process.exit(1);
    });
}

export { testRealWorldScenarios };
