#!/usr/bin/env node

/**
 * Production Test Runner for ELIZA Game
 *
 * Follows CLAUDE.md testing rules:
 * - NO MOCKS
 * - NO UNIT TESTS
 * - REAL RUNTIME ONLY
 * - FAIL FAST
 * - 100% PASS REQUIRED
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables for API keys
async function loadEnv() {
  const envPath = path.resolve(projectRoot, '../../.env');
  try {
    const envContent = await fs.readFile(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('='); // Handle values with '=' in them
          process.env[key.trim()] = value.trim();
        }
      }
    });
    console.log('📝 Environment loaded from:', envPath);
    console.log('🔑 Found API keys:', {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    });
  } catch (err) {
    console.warn('Warning: Could not load .env file:', err.message);
  }
}

// Core tests only - no duplicates, no mocks
const PRODUCTION_TESTS = [
  'complete-game-test.cy.ts', // Comprehensive test with 100% coverage
  'capability-controls-tests.cy.ts', // Capability toggling and message flow tests
];

// Runtime integration tests - run separately with direct server/agent interaction
const INTEGRATION_TESTS = [
  'integration-runtime-tests.ts', // Direct runtime tests without frontend
];

class ProductionTestRunner {
  constructor() {
    this.errors = [];
    this.testResults = new Map();
  }

  async validateEnvironment() {
    console.log('🔍 Validating test environment...');

    // Check for API keys (fail fast if missing)
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

    if (!hasOpenAI && !hasAnthropic) {
      throw new Error('FATAL: No API keys found. Tests require REAL API keys in .env file');
    }

    console.log('✅ API keys found:', {
      openai: hasOpenAI,
      anthropic: hasAnthropic,
    });
  }

  async killExistingProcesses() {
    console.log('🔫 Killing existing processes on ports 7777 and 5173...');

    const ports = [7777, 5173];
    for (const port of ports) {
      try {
        await new Promise((resolve, reject) => {
          const kill = spawn('lsof', [`-ti:${port}`], { stdio: 'pipe' });
          let pids = '';

          kill.stdout.on('data', (data) => {
            pids += data.toString();
          });

          kill.on('close', async (code) => {
            if (pids.trim()) {
              const pidList = pids.trim().split('\n').filter(Boolean);
              console.log(`Found processes on port ${port}:`, pidList);

              for (const pid of pidList) {
                try {
                  await new Promise((resolve) => {
                    const killProcess = spawn('kill', ['-9', pid.trim()]);
                    killProcess.on('close', () => resolve());
                  });
                  console.log(`Killed process ${pid} on port ${port}`);
                } catch (err) {
                  console.warn(`Failed to kill process ${pid}:`, err.message);
                }
              }
            }
            resolve();
          });

          kill.on('error', () => resolve()); // Ignore errors
        });
      } catch (err) {
        // Ignore errors - process may not exist
      }
    }

    // Wait a moment for processes to die
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  async startBackend() {
    console.log('🚀 Starting real backend (no mocks)...');

    // Kill existing processes first
    await this.killExistingProcesses();

    // Wait longer to ensure cleanup completes
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Ensure API keys are explicitly passed
    const backendEnv = {
      ...process.env,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      MODEL_PROVIDER: process.env.MODEL_PROVIDER || 'openai',
    };

    console.log('🔑 Backend environment keys:', {
      hasOpenAI: !!backendEnv.OPENAI_API_KEY,
      hasAnthropic: !!backendEnv.ANTHROPIC_API_KEY,
      modelProvider: backendEnv.MODEL_PROVIDER,
    });

    return new Promise((resolve, reject) => {
      const backend = spawn('bun', ['run', 'dev:backend'], {
        cwd: projectRoot,
        stdio: 'pipe',
        env: backendEnv,
      });

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          backend.kill();
          reject(new Error('Backend failed to start in 60 seconds'));
        }
      }, 60000);

      backend.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[Backend]', output.trim());

        if (
          (output.includes('Server running') || output.includes('AgentServer is listening')) &&
          !started
        ) {
          started = true;
          clearTimeout(timeout);
          setTimeout(resolve, 5000); // Give it more time to fully initialize
        }
      });

      backend.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        console.error('[Backend Error]', errorOutput);
        // Also log to stdout to ensure it's captured
        console.log('[Backend Stderr]', errorOutput);
      });

      backend.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      backend.on('exit', (code, signal) => {
        console.log(`[Backend Exit] Process exited with code ${code} and signal ${signal}`);
        if (!started) {
          clearTimeout(timeout);
          reject(new Error(`Backend exited early with code ${code}`));
        }
      });

      this.backendProcess = backend;
    });
  }

  async startFrontend() {
    console.log('🚀 Starting real frontend (no mocks)...');

    return new Promise((resolve, reject) => {
      const frontend = spawn('bun', ['run', 'dev:frontend'], {
        cwd: projectRoot,
        stdio: 'pipe',
        env: { ...process.env },
      });

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          frontend.kill();
          reject(new Error('Frontend failed to start in 30 seconds'));
        }
      }, 30000);

      frontend.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[Frontend]', output.trim());

        if ((output.includes('ready in') || output.includes('Local:')) && !started) {
          started = true;
          clearTimeout(timeout);
          setTimeout(resolve, 3000); // Give it time to fully initialize
        }
      });

      frontend.stderr.on('data', (data) => {
        const errorStr = data.toString();
        console.log('[Frontend Stderr]', errorStr.trim());

        // Check stderr for startup patterns too (Vite might output to stderr)
        if ((errorStr.includes('ready in') || errorStr.includes('Local:')) && !started) {
          started = true;
          clearTimeout(timeout);
          setTimeout(resolve, 3000);
        }

        // Only log actual errors, not warnings or normal Vite output
        if (
          !errorStr.includes('warning') &&
          !errorStr.includes('ready in') &&
          !errorStr.includes('Local:') &&
          !errorStr.includes('VITE')
        ) {
          console.error('[Frontend Error]', errorStr);
        }
      });

      frontend.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.frontendProcess = frontend;
    });
  }

  async runCypressTests() {
    console.log('🧪 Running Cypress E2E tests...');

    for (const testFile of PRODUCTION_TESTS) {
      console.log(`\n📋 Running test: ${testFile}`);

      const testPath = path.join(projectRoot, 'cypress/e2e', testFile);
      const startTime = Date.now();

      try {
        await this.runSingleTest(testPath);
        const duration = Date.now() - startTime;
        this.testResults.set(testFile, {
          passed: true,
          duration,
          error: null,
        });
        console.log(`✅ ${testFile} passed in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - startTime;
        this.testResults.set(testFile, {
          passed: false,
          duration,
          error: error.message,
        });
        this.errors.push({
          test: testFile,
          error: error.message,
          duration,
        });
        console.error(`❌ ${testFile} failed: ${error.message}`);
        // FAIL FAST - throw immediately
        throw error;
      }
    }
  }

  async runIntegrationTests() {
    console.log('🔧 Running Integration Runtime tests...');

    for (const testFile of INTEGRATION_TESTS) {
      console.log(`\n📋 Running integration test: ${testFile}`);

      const testPath = path.join(projectRoot, 'tests', testFile);
      const startTime = Date.now();

      try {
        await this.runSingleIntegrationTest(testPath);
        const duration = Date.now() - startTime;
        this.testResults.set(testFile, {
          passed: true,
          duration,
          error: null,
        });
        console.log(`✅ ${testFile} passed in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - startTime;
        this.testResults.set(testFile, {
          passed: false,
          duration,
          error: error.message,
        });
        this.errors.push({
          test: testFile,
          error: error.message,
          duration,
        });
        console.error(`❌ ${testFile} failed: ${error.message}`);
        // FAIL FAST - throw immediately
        throw error;
      }
    }
  }

  runSingleTest(testPath) {
    return new Promise((resolve, reject) => {
      const cypress = spawn(
        'npx',
        [
          'cypress',
          'run',
          '--spec',
          testPath,
          '--browser',
          'chrome',
          '--config',
          'video=true,screenshotOnRunFailure=true',
        ],
        {
          cwd: projectRoot,
          stdio: 'pipe',
          env: {
            ...process.env,
            CYPRESS_OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            CYPRESS_ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          },
        }
      );

      let output = '';
      let errorOutput = '';

      cypress.stdout.on('data', (data) => {
        const str = data.toString();
        output += str;
        // Only show test results, not verbose output
        if (str.includes('✓') || str.includes('✗') || str.includes('failed')) {
          console.log(str.trim());
        }
      });

      cypress.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      cypress.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Test failed with code ${code}\n${errorOutput}`));
        }
      });
    });
  }

  runSingleIntegrationTest(testPath) {
    return new Promise((resolve, reject) => {
      const integrationTest = spawn(
        'bun',
        [testPath],
        {
          cwd: projectRoot,
          stdio: 'pipe',
          env: {
            ...process.env,
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
            MODEL_PROVIDER: process.env.MODEL_PROVIDER || 'openai',
          },
        }
      );

      let output = '';
      let errorOutput = '';

      integrationTest.stdout.on('data', (data) => {
        const str = data.toString();
        output += str;
        console.log(str.trim());
      });

      integrationTest.stderr.on('data', (data) => {
        const str = data.toString();
        errorOutput += str;
        console.error(str.trim());
      });

      integrationTest.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Integration test failed with code ${code}\n${errorOutput}`));
        }
      });

      integrationTest.on('error', (err) => {
        reject(new Error(`Failed to start integration test: ${err.message}`));
      });
    });
  }

  generateReport() {
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 PRODUCTION TEST REPORT');
    console.log('='.repeat(80));

    const totalTests = this.testResults.size;
    const passedTests = Array.from(this.testResults.values()).filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Pass Rate: ${passRate}%`);

    if (this.errors.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.errors.forEach((error, idx) => {
        console.log(`\n${idx + 1}. ${error.test}`);
        console.log(`   Error: ${error.error}`);
        console.log(`   Duration: ${error.duration}ms`);
      });
    }

    console.log(`\n${'='.repeat(80)}`);

    // REQUIRE 100% PASS RATE
    if (passRate !== '100.0') {
      throw new Error(`FATAL: Pass rate is ${passRate}%. 100% required per CLAUDE.md rules.`);
    }

    console.log('✅ ALL TESTS PASSED - 100% SUCCESS RATE');
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');

    if (this.frontendProcess) {
      this.frontendProcess.kill();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (this.backendProcess) {
      this.backendProcess.kill();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async run() {
    console.log('🏁 ELIZA Game Production Test Runner');
    console.log('Following CLAUDE.md rules: NO MOCKS, REAL RUNTIME, FAIL FAST\n');

    try {
      await loadEnv(); // Load environment variables first
      await this.validateEnvironment();

      // Run integration tests first (they start their own server)
      console.log('🔧 Phase 1: Integration Runtime Tests');
      await this.runIntegrationTests();

      // Now start servers for Cypress tests
      console.log('🌐 Phase 2: E2E Cypress Tests');
      await this.startBackend();
      await this.startFrontend();
      await this.runCypressTests();

      this.generateReport();
    } catch (error) {
      console.error('\n💥 FATAL ERROR:', error.message);
      this.generateReport();
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the tests
const runner = new ProductionTestRunner();
runner.run().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
