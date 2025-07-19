#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '../../../.env');
console.log('Loading environment from:', envPath);
dotenv.config({ path: envPath });

console.log('Environment loaded:', {
  E2B_API_KEY: !!process.env.E2B_API_KEY,
  GITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
});

// Import test runner and scenario
import { ScenarioTestRunner } from '../../scenarios/src/test-runner.js';

console.log('🚀 Starting GitHub + E2B + Autocoder Collaboration scenario test...');

try {
  const runner = new ScenarioTestRunner();

  console.log('⚙️  Running scenario with filter: "github-e2b-autocoder"');
  const result = await runner.runAllScenarios({
    filter: 'github-e2b-autocoder',
    verbose: true,
    continueOnError: true,
    outputFormat: 'console',
  });

  console.log('\n📊 Final Results Summary:');
  console.log('- Total Scenarios:', result.totalScenarios);
  console.log('- Passed:', result.passed);
  console.log('- Failed:', result.failed);
  console.log('- Skipped:', result.skipped);
  console.log('- Pass Rate:', result.summary.passRate.toFixed(1) + '%');
  console.log('- Total Duration:', (result.duration / 1000).toFixed(2) + 's');

  if (result.failed > 0) {
    console.log('\n❌ Failed scenario details:');
    result.results
      .filter((r) => r.status === 'failed')
      .forEach((failedResult, index) => {
        console.log(`  ${index + 1}. Scenario: ${failedResult.scenario}`);
        failedResult.errors.forEach((error) => {
          console.log(`     - ${error}`);
        });
      });
  }

  if (result.validationErrors > 0) {
    console.log('\n⚠️  Validation errors:');
    result.validationResults
      .filter((v) => !v.valid)
      .forEach((validation) => {
        console.log(`  Scenario: ${validation.scenario}`);
        validation.errors.forEach((error) => {
          console.log(`    - ${error.message}`);
        });
      });
  }

  if (result.passed > 0) {
    console.log('🎉 GitHub + E2B + Autocoder Collaboration scenario completed successfully!');
    process.exit(0);
  } else {
    console.log('❌ GitHub + E2B + Autocoder Collaboration scenario failed');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Failed to run GitHub + E2B + Autocoder Collaboration scenario:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack?.split('\n').slice(0, 10).join('\n'));
  process.exit(1);
}
