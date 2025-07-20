#!/usr/bin/env node

/**
 * Comprehensive Test Runner for ELIZA Game
 * 
 * This script orchestrates the execution of all Cypress tests in a methodical way,
 * ensuring proper test isolation, error reporting, and comprehensive coverage.
 */

import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Test configuration
const TEST_CONFIG = {
  testSuites: [
    {
      name: 'Boot Sequence Tests',
      file: 'boot-sequence-complete.cy.ts',
      priority: 1,
      timeout: 120000,
      description: 'Tests complete boot sequence including environment detection and configuration'
    },
    {
      name: 'UI Comprehensive Tests', 
      file: 'ui-comprehensive.cy.ts',
      priority: 2,
      timeout: 180000,
      description: 'Tests all UI components, modals, tabs, and interactions'
    },
    {
      name: 'Plugin Capabilities Tests',
      file: 'plugin-capabilities-integration.cy.ts', 
      priority: 3,
      timeout: 240000,
      description: 'Tests all plugin capabilities including shell, browser, vision, and audio'
    },
    {
      name: 'Enhanced Agent Interactions',
      file: 'agent-interactions-enhanced.cy.ts',
      priority: 4, 
      timeout: 300000,
      description: 'Tests goal/todo management, memory persistence, and learning'
    },
    {
      name: 'Error Handling and Recovery',
      file: 'error-handling-recovery.cy.ts',
      priority: 5,
      timeout: 180000,
      description: 'Tests comprehensive error scenarios and recovery mechanisms'
    },
    {
      name: 'Real E2E Integration',
      file: 'real-e2e-test.cy.ts',
      priority: 6,
      timeout: 120000,
      description: 'Legacy integration tests for API connectivity'
    },
    {
      name: 'Knowledge Plugin Tests',
      file: 'knowledge-plugin.cy.ts',
      priority: 7,
      timeout: 90000,
      description: 'Tests knowledge base functionality'
    },
    {
      name: 'Knowledge Upload Fixes Validation',
      file: 'knowledge-upload-fixes-validation.cy.ts',
      priority: 7.1,
      timeout: 120000,
      description: 'Tests knowledge file upload fixes and validation'
    },
    {
      name: 'Knowledge Upload Real Tests',
      file: 'knowledge-upload-real.cy.ts',
      priority: 7.2,
      timeout: 150000,
      description: 'Real file upload and deletion workflow tests'
    },
    {
      name: 'Autonomy System Tests',
      file: 'autonomy-comprehensive.cy.js',
      priority: 8,
      timeout: 120000,
      description: 'Tests autonomous thinking and decision making'
    }
  ],
  screenshots: true,
  video: true,
  retries: 2,
  browser: 'electron'
};

// Test execution state
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  suites: [],
  errors: [],
  startTime: null,
  endTime: null
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '🔍',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    debug: '🐛'
  }[type] || 'ℹ️';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function createProgressBar(current, total, width = 40) {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return `[${bar}] ${percentage}% (${current}/${total})`;
}

async function checkPrerequisites() {
  log('Checking prerequisites...');
  
  try {
    // Check if Cypress is installed
    await new Promise((resolve, reject) => {
      exec('npx cypress version', (error, stdout, stderr) => {
        if (error) {
          reject(new Error('Cypress not found. Run: npm install cypress'));
        } else {
          log(`Cypress version: ${stdout.trim()}`);
          resolve();
        }
      });
    });
    
    // Check if backend is available
    const { default: fetch } = await import('node-fetch');
    try {
      const response = await fetch('http://localhost:7777/api/health', { timeout: 5000 });
      if (!response.ok) {
        throw new Error(`Backend health check failed: ${response.status}`);
      }
      log('Backend is accessible');
    } catch (error) {
      log('Backend is not running. Starting backend...', 'warning');
      await startBackend();
    }
    
    // Check test files exist
    for (const suite of TEST_CONFIG.testSuites) {
      const testPath = path.join(projectRoot, 'cypress', 'e2e', suite.file);
      try {
        await fs.access(testPath);
        log(`✓ Test file found: ${suite.file}`);
      } catch {
        log(`✗ Test file missing: ${suite.file}`, 'error');
        throw new Error(`Missing test file: ${suite.file}`);
      }
    }
    
    log('All prerequisites met', 'success');
    
  } catch (error) {
    log(`Prerequisites check failed: ${error.message}`, 'error');
    throw error;
  }
}

async function startBackend() {
  return new Promise((resolve, reject) => {
    log('Starting backend server...');
    
    const backend = spawn('npm', ['run', 'dev:backend'], {
      cwd: projectRoot,
      stdio: 'pipe'
    });
    
    let healthCheckAttempts = 0;
    const maxHealthChecks = 30;
    
    const checkHealth = async () => {
      try {
        const { default: fetch } = await import('node-fetch');
        const response = await fetch('http://localhost:7777/api/health', { timeout: 2000 });
        if (response.ok) {
          log('Backend is ready', 'success');
          resolve(backend);
        } else {
          throw new Error('Health check failed');
        }
      } catch (error) {
        healthCheckAttempts++;
        if (healthCheckAttempts < maxHealthChecks) {
          setTimeout(checkHealth, 2000);
        } else {
          reject(new Error('Backend failed to start within timeout'));
        }
      }
    };
    
    backend.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running') || output.includes('ready')) {
        setTimeout(checkHealth, 2000);
      }
    });
    
    backend.stderr.on('data', (data) => {
      log(`Backend stderr: ${data.toString()}`, 'debug');
    });
    
    backend.on('error', (error) => {
      reject(new Error(`Failed to start backend: ${error.message}`));
    });
    
    // Start health checking after initial delay
    setTimeout(checkHealth, 5000);
  });
}

async function runTestSuite(suite, suiteIndex) {
  log(`\n${'='.repeat(60)}`);
  log(`Running: ${suite.name} (${suiteIndex + 1}/${TEST_CONFIG.testSuites.length})`);
  log(`Description: ${suite.description}`);
  log(`File: ${suite.file}`);
  log(`Timeout: ${suite.timeout / 1000}s`);
  log(`${'='.repeat(60)}`);
  
  const suiteResult = {
    name: suite.name,
    file: suite.file,
    startTime: Date.now(),
    endTime: null,
    passed: false,
    error: null,
    screenshots: [],
    attempts: 0
  };
  
  let attempts = 0;
  const maxAttempts = TEST_CONFIG.retries + 1;
  
  while (attempts < maxAttempts) {
    attempts++;
    suiteResult.attempts = attempts;
    
    if (attempts > 1) {
      log(`Retry attempt ${attempts - 1}/${TEST_CONFIG.retries}`, 'warning');
      // Wait between retries
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    try {
      const cypressArgs = [
        'cypress', 'run',
        '--spec', `cypress/e2e/${suite.file}`,
        '--browser', TEST_CONFIG.browser,
        '--config', `defaultCommandTimeout=15000,requestTimeout=20000,responseTimeout=20000,pageLoadTimeout=${suite.timeout}`,
        '--reporter', 'json',
        '--reporter-options', `output=cypress/results/${suite.file}.json`
      ];
      
      if (TEST_CONFIG.screenshots) {
        cypressArgs.push('--config', 'screenshotOnRunFailure=true');
      }
      
      if (TEST_CONFIG.video) {
        cypressArgs.push('--config', 'video=true');
      }
      
      log(`Executing: npx ${cypressArgs.join(' ')}`);
      
      const result = await new Promise((resolve, reject) => {
        const cypress = spawn('npx', cypressArgs, {
          cwd: projectRoot,
          stdio: 'pipe',
          timeout: suite.timeout
        });
        
        let stdout = '';
        let stderr = '';
        
        cypress.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          
          // Log important output in real-time
          if (output.includes('Running:') || output.includes('✓') || output.includes('✗')) {
            log(output.trim(), 'debug');
          }
        });
        
        cypress.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        cypress.on('close', (code) => {
          resolve({ code, stdout, stderr });
        });
        
        cypress.on('error', (error) => {
          reject(error);
        });
        
        // Handle timeout
        setTimeout(() => {
          cypress.kill('SIGTERM');
          reject(new Error(`Test suite timed out after ${suite.timeout / 1000}s`));
        }, suite.timeout);
      });
      
      suiteResult.endTime = Date.now();
      
      if (result.code === 0) {
        suiteResult.passed = true;
        log(`✅ ${suite.name} PASSED (attempt ${attempts})`, 'success');
        
        // Parse test results if available
        try {
          const resultPath = path.join(projectRoot, 'cypress', 'results', `${suite.file}.json`);
          const testData = JSON.parse(await fs.readFile(resultPath, 'utf8'));
          testResults.total += testData.stats?.tests || 0;
          testResults.passed += testData.stats?.passes || 0;
          testResults.failed += testData.stats?.failures || 0;
          testResults.skipped += testData.stats?.skipped || 0;
        } catch (error) {
          log(`Could not parse test results for ${suite.file}`, 'warning');
        }
        
        break; // Success, exit retry loop
        
      } else {
        const error = new Error(`Test failed with exit code ${result.code}`);
        error.stdout = result.stdout;
        error.stderr = result.stderr;
        throw error;
      }
      
    } catch (error) {
      suiteResult.error = error.message;
      
      if (attempts === maxAttempts) {
        log(`❌ ${suite.name} FAILED after ${attempts} attempts`, 'error');
        log(`Error: ${error.message}`, 'error');
        
        if (error.stdout) {
          log('STDOUT:', 'debug');
          log(error.stdout, 'debug');
        }
        
        if (error.stderr) {
          log('STDERR:', 'debug');
          log(error.stderr, 'debug');
        }
        
        testResults.errors.push({
          suite: suite.name,
          error: error.message,
          stdout: error.stdout,
          stderr: error.stderr
        });
        
        break; // Exit retry loop on final failure
      } else {
        log(`⚠️ ${suite.name} failed on attempt ${attempts}, retrying...`, 'warning');
      }
    }
  }
  
  testResults.suites.push(suiteResult);
  
  // Update progress
  const progress = createProgressBar(suiteIndex + 1, TEST_CONFIG.testSuites.length);
  log(`\nProgress: ${progress}\n`);
  
  return suiteResult;
}

async function generateReport() {
  log('\n' + '='.repeat(80));
  log('COMPREHENSIVE TEST EXECUTION REPORT');
  log('='.repeat(80));
  
  const totalDuration = (testResults.endTime - testResults.startTime) / 1000;
  const successRate = testResults.total > 0 ? (testResults.passed / testResults.total * 100).toFixed(1) : 0;
  
  log(`\n📊 SUMMARY:`);
  log(`   Total Execution Time: ${totalDuration.toFixed(1)}s`);
  log(`   Test Suites: ${testResults.suites.length}`);
  log(`   Total Tests: ${testResults.total}`);
  log(`   Passed: ${testResults.passed} (${successRate}%)`);
  log(`   Failed: ${testResults.failed}`);
  log(`   Skipped: ${testResults.skipped}`);
  log(`   Errors: ${testResults.errors.length}`);
  
  log(`\n📋 SUITE RESULTS:`);
  testResults.suites.forEach((suite, index) => {
    const duration = suite.endTime ? ((suite.endTime - suite.startTime) / 1000).toFixed(1) : 'N/A';
    const status = suite.passed ? '✅ PASSED' : '❌ FAILED';
    const attempts = suite.attempts > 1 ? ` (${suite.attempts} attempts)` : '';
    
    log(`   ${index + 1}. ${suite.name}: ${status}${attempts} - ${duration}s`);
    
    if (suite.error) {
      log(`      Error: ${suite.error}`, 'error');
    }
  });
  
  if (testResults.errors.length > 0) {
    log(`\n🚨 ERROR DETAILS:`);
    testResults.errors.forEach((error, index) => {
      log(`   ${index + 1}. ${error.suite}:`);
      log(`      ${error.error}`, 'error');
    });
  }
  
  // Generate detailed HTML report
  try {
    await generateHTMLReport();
    log(`\n📄 Detailed report generated: cypress/reports/comprehensive-test-report.html`);
  } catch (error) {
    log(`Failed to generate HTML report: ${error.message}`, 'warning');
  }
  
  log('\n' + '='.repeat(80));
  
  // Exit with appropriate code
  const hasFailures = testResults.failed > 0 || testResults.errors.length > 0;
  if (hasFailures) {
    log('❌ TESTS FAILED - Some tests did not pass', 'error');
    process.exit(1);
  } else {
    log('✅ ALL TESTS PASSED - Comprehensive testing completed successfully!', 'success');
    process.exit(0);
  }
}

async function generateHTMLReport() {
  const reportsDir = path.join(projectRoot, 'cypress', 'reports');
  await fs.mkdir(reportsDir, { recursive: true });
  
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ELIZA Game - Comprehensive Test Report</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8fafc; padding: 20px; border-radius: 6px; text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; color: #1f2937; }
        .stat-label { color: #6b7280; font-size: 0.9em; }
        .passed { color: #10b981; }
        .failed { color: #ef4444; }
        .suite-list { margin-top: 30px; }
        .suite-item { background: white; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 10px; padding: 20px; }
        .suite-header { display: flex; justify-content: between; align-items: center; margin-bottom: 10px; }
        .suite-name { font-weight: bold; font-size: 1.1em; }
        .suite-status.passed { color: #10b981; }
        .suite-status.failed { color: #ef4444; }
        .suite-details { font-size: 0.9em; color: #6b7280; }
        .error-details { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 10px; margin-top: 10px; font-family: monospace; font-size: 0.8em; }
        .timestamp { color: #9ca3af; font-size: 0.8em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎮 ELIZA Game - Comprehensive Test Report</h1>
        <div class="timestamp">Generated: ${new Date().toISOString()}</div>
        
        <div class="summary">
            <div class="stat-card">
                <div class="stat-value">${testResults.total}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-value passed">${testResults.passed}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value failed">${testResults.failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${((testResults.endTime - testResults.startTime) / 1000).toFixed(1)}s</div>
                <div class="stat-label">Total Duration</div>
            </div>
        </div>
        
        <div class="suite-list">
            <h2>Test Suite Results</h2>
            ${testResults.suites.map(suite => `
                <div class="suite-item">
                    <div class="suite-header">
                        <span class="suite-name">${suite.name}</span>
                        <span class="suite-status ${suite.passed ? 'passed' : 'failed'}">
                            ${suite.passed ? '✅ PASSED' : '❌ FAILED'}
                        </span>
                    </div>
                    <div class="suite-details">
                        <strong>File:</strong> ${suite.file}<br>
                        <strong>Duration:</strong> ${suite.endTime ? ((suite.endTime - suite.startTime) / 1000).toFixed(1) + 's' : 'N/A'}<br>
                        <strong>Attempts:</strong> ${suite.attempts}
                    </div>
                    ${suite.error ? `<div class="error-details"><strong>Error:</strong> ${suite.error}</div>` : ''}
                </div>
            `).join('')}
        </div>
        
        ${testResults.errors.length > 0 ? `
            <div class="error-section">
                <h2>Error Summary</h2>
                ${testResults.errors.map(error => `
                    <div class="suite-item">
                        <strong>${error.suite}:</strong> ${error.error}
                    </div>
                `).join('')}
            </div>
        ` : ''}
    </div>
</body>
</html>`;

  const reportPath = path.join(reportsDir, 'comprehensive-test-report.html');
  await fs.writeFile(reportPath, htmlContent);
}

// Main execution
async function main() {
  try {
    log('🚀 Starting ELIZA Game Comprehensive Testing', 'info');
    log(`Testing ${TEST_CONFIG.testSuites.length} suites with ${TEST_CONFIG.retries} retries each`);
    
    testResults.startTime = Date.now();
    
    // Check prerequisites
    await checkPrerequisites();
    
    // Run test suites in order
    for (let i = 0; i < TEST_CONFIG.testSuites.length; i++) {
      const suite = TEST_CONFIG.testSuites[i];
      await runTestSuite(suite, i);
    }
    
    testResults.endTime = Date.now();
    
    // Generate comprehensive report
    await generateReport();
    
  } catch (error) {
    log(`Fatal error during test execution: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('Received SIGINT, cleaning up...', 'warning');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, cleaning up...', 'warning');
  process.exit(1);
});

// Run the tests
main().catch((error) => {
  log(`Unhandled error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});