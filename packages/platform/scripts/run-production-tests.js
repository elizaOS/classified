#!/usr/bin/env node

/**
 * ElizaOS Platform - Production Test Runner
 * Runs all comprehensive tests to ensure production readiness
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 ElizaOS Platform - Production Readiness Test Runner');
console.log('=====================================================\n');

const testSuites = [
  {
    name: 'Final Production Validation',
    file: '00-FINAL-PRODUCTION-VALIDATION.cy.ts',
    description: 'Quick validation of critical systems',
  },
  {
    name: 'API Keys Complete Testing',
    file: '03-api-keys-complete.cy.ts',
    description: 'Comprehensive API key functionality',
  },
  {
    name: 'API Keys Edge Cases',
    file: '03-api-keys-edge-cases.cy.ts',
    description: 'Edge cases and security testing',
  },
  {
    name: 'Missing Routes Coverage',
    file: '00-missing-routes-coverage.cy.ts',
    description: 'Additional routes from sidebar',
  },
  {
    name: 'Production Readiness Master',
    file: '00-production-readiness-master.cy.ts',
    description: 'Master production validation suite',
  },
  {
    name: 'Complete Test Coverage Report',
    file: '00-COMPLETE-TEST-COVERAGE-REPORT.cy.ts',
    description: 'Full coverage inventory',
  },
];

const results = {
  passed: [],
  failed: [],
  startTime: Date.now(),
};

// Check if server is running
console.log('📡 Checking if development server is running...');
try {
  execSync('curl -s http://localhost:3333 > /dev/null', { stdio: 'ignore' });
  console.log('✅ Development server is running\n');
} catch (error) {
  console.log('❌ Development server is not running!');
  console.log('Please start the server with: npm run dev\n');
  process.exit(1);
}

// Run each test suite
testSuites.forEach((suite, index) => {
  console.log(
    `\n📋 Test Suite ${index + 1}/${testSuites.length}: ${suite.name}`,
  );
  console.log(`📄 File: ${suite.file}`);
  console.log(`📝 ${suite.description}`);
  console.log('─'.repeat(50));

  try {
    const startTime = Date.now();

    // Run the test
    execSync(
      `npx cypress run --spec "cypress/e2e/${suite.file}" --reporter json`,
      {
        stdio: 'pipe',
        encoding: 'utf8',
      },
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ PASSED (${duration}s)`);

    results.passed.push({
      name: suite.name,
      file: suite.file,
      duration,
    });
  } catch (error) {
    console.log('❌ FAILED');
    console.error(error.stdout || error.message);

    results.failed.push({
      name: suite.name,
      file: suite.file,
      error: error.message,
    });
  }
});

// Generate summary report
const totalDuration = ((Date.now() - results.startTime) / 1000).toFixed(2);
const totalTests = testSuites.length;
const passedTests = results.passed.length;
const failedTests = results.failed.length;

console.log('\n' + '='.repeat(60));
console.log('📊 PRODUCTION READINESS TEST SUMMARY');
console.log('='.repeat(60));

console.log(`\n⏱️  Total Duration: ${totalDuration}s`);
console.log(`📋 Total Test Suites: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);

if (results.passed.length > 0) {
  console.log('\n✅ PASSED TESTS:');
  results.passed.forEach((test) => {
    console.log(`   ✓ ${test.name} (${test.duration}s)`);
  });
}

if (results.failed.length > 0) {
  console.log('\n❌ FAILED TESTS:');
  results.failed.forEach((test) => {
    console.log(`   ✗ ${test.name}`);
    console.log(`     Error: ${test.error}`);
  });
}

// Generate detailed report file
const reportPath = path.join(__dirname, '..', 'PRODUCTION_TEST_RESULTS.md');
const reportContent = `# ElizaOS Platform - Production Test Results

Generated: ${new Date().toISOString()}

## Summary

- **Total Test Suites**: ${totalTests}
- **Passed**: ${passedTests}
- **Failed**: ${failedTests}
- **Total Duration**: ${totalDuration}s

## Test Results

${results.passed
  .map(
    (test) => `### ✅ ${test.name}
- File: \`${test.file}\`
- Duration: ${test.duration}s
- Status: **PASSED**
`,
  )
  .join('\n')}

${results.failed
  .map(
    (test) => `### ❌ ${test.name}
- File: \`${test.file}\`
- Status: **FAILED**
- Error: ${test.error}
`,
  )
  .join('\n')}

## Platform Status

${failedTests === 0 ? '### 🎉 PLATFORM IS PRODUCTION READY!' : '### ⚠️ PLATFORM NEEDS ATTENTION'}

${
  failedTests === 0
    ? `All critical systems have been tested and validated:
- ✅ API Key system fully functional
- ✅ All routes accessible
- ✅ All pages loading correctly
- ✅ Security measures in place
- ✅ Performance benchmarks met`
    : `Please fix the failing tests before deploying to production.`
}

## Next Steps

${
  failedTests === 0
    ? `1. Review the detailed test logs
2. Check production environment variables
3. Run database migrations
4. Enable monitoring and alerting
5. Deploy with confidence! 🚀`
    : `1. Fix failing tests
2. Re-run the test suite
3. Review error logs for details`
}
`;

fs.writeFileSync(reportPath, reportContent);
console.log(`\n📄 Detailed report saved to: ${reportPath}`);

// Final status
console.log('\n' + '='.repeat(60));
if (failedTests === 0) {
  console.log('🎉 ALL TESTS PASSED - PLATFORM IS PRODUCTION READY!');
  console.log('='.repeat(60));
  process.exit(0);
} else {
  console.log('⚠️  SOME TESTS FAILED - PLEASE REVIEW AND FIX');
  console.log('='.repeat(60));
  process.exit(1);
}
