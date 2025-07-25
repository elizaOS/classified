#!/usr/bin/env node

/**
 * Capability Toggle Testing Script
 * Tests the complete capability toggle flow: Frontend → Tauri IPC → Rust Backend → Node.js Server → Agent Runtime
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const TIMEOUT = 30000; // 30 seconds

/**
 * Test configuration
 */
const TESTS = {
  unit: {
    name: 'Unit Tests (CapabilityService)',
    command: 'npm',
    args: ['run', 'test', 'src/services/__tests__/CapabilityService.test.ts'],
    cwd: process.cwd()
  },
  integration: {
    name: 'IPC Integration Tests',
    command: 'npx',
    args: ['cypress', 'run', '--spec', 'cypress/e2e/ipc-integration.cy.ts'],
    cwd: process.cwd()
  },
  e2e: {
    name: 'End-to-End Capability Tests',
    command: 'npx',
    args: ['cypress', 'run', '--spec', 'cypress/e2e/capability-toggles.cy.ts'],
    cwd: process.cwd()
  },
  rust: {
    name: 'Rust Backend Compilation',
    command: 'cargo',
    args: ['check'],
    cwd: path.join(process.cwd(), 'src-tauri')
  }
};

/**
 * Colors for console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Logger utility
 */
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`${colors.bright}${colors.cyan}${msg}${colors.reset}`),
  divider: () => console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`)
};

/**
 * Run a test command
 */
async function runTest(testConfig) {
  return new Promise((resolve) => {
    log.info(`Running: ${testConfig.name}`);

    const startTime = Date.now();
    const process = spawn(testConfig.command, testConfig.args, {
      cwd: testConfig.cwd,
      stdio: 'pipe',
      shell: true
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      process.kill('SIGKILL');
      resolve({
        success: false,
        error: 'Test timed out',
        duration: TIMEOUT,
        stdout,
        stderr
      });
    }, TIMEOUT);

    process.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      resolve({
        success: code === 0,
        code,
        duration,
        stdout,
        stderr
      });
    });

    process.on('error', (error) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      resolve({
        success: false,
        error: error.message,
        duration,
        stdout,
        stderr
      });
    });
  });
}

/**
 * Check if required files exist
 */
async function checkPrerequisites() {
  const requiredFiles = [
    'src/services/CapabilityService.ts',
    'src/services/__tests__/CapabilityService.test.ts',
    'cypress/e2e/capability-toggles.cy.ts',
    'cypress/e2e/ipc-integration.cy.ts',
    'src-tauri/src/ipc/commands.rs'
  ];

  log.header('Checking Prerequisites');

  for (const file of requiredFiles) {
    try {
      await fs.access(file);
      log.success(`Found: ${file}`);
    } catch {
      log.error(`Missing: ${file}`);
      return false;
    }
  }

  return true;
}

/**
 * Verify Rust IPC commands are registered
 */
async function checkRustIpcCommands() {
  log.header('Verifying Rust IPC Commands');

  try {
    const libRsPath = 'src-tauri/src/lib.rs';
    const libRsContent = await fs.readFile(libRsPath, 'utf8');

    const requiredCommands = [
      'toggle_autonomy',
      'get_autonomy_status',
      'toggle_capability',
      'get_capability_status',
      'update_agent_setting',
      'get_agent_settings',
      'get_vision_settings',
      'refresh_vision_service'
    ];

    for (const command of requiredCommands) {
      if (libRsContent.includes(command)) {
        log.success(`IPC command registered: ${command}`);
      } else {
        log.error(`IPC command missing: ${command}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    log.error(`Failed to check Rust IPC commands: ${error.message}`);
    return false;
  }
}

/**
 * Generate test report
 */
function generateReport(results) {
  log.divider();
  log.header('TEST REPORT');
  log.divider();

  let totalTests = 0;
  let passedTests = 0;
  let totalDuration = 0;

  for (const [testName, result] of Object.entries(results)) {
    totalTests++;
    totalDuration += result.duration;

    if (result.success) {
      passedTests++;
      log.success(`${TESTS[testName].name}: PASSED (${result.duration}ms)`);
    } else {
      log.error(`${TESTS[testName].name}: FAILED (${result.duration}ms)`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.stderr) {
        console.log(`   Stderr: ${result.stderr.substring(0, 200)}...`);
      }
    }
  }

  log.divider();

  if (passedTests === totalTests) {
    log.success(`All tests passed! (${passedTests}/${totalTests}) in ${totalDuration}ms`);
  } else {
    log.error(`${totalTests - passedTests} tests failed (${passedTests}/${totalTests}) in ${totalDuration}ms`);
  }

  log.divider();
}

/**
 * Main test runner
 */
async function main() {
  log.header('ELIZA Capability Toggle Test Suite');
  log.divider();

  // Check prerequisites
  const prerequisitesOk = await checkPrerequisites();
  if (!prerequisitesOk) {
    log.error('Prerequisites check failed. Please ensure all required files exist.');
    process.exit(1);
  }

  // Check Rust IPC commands
  const ipcCommandsOk = await checkRustIpcCommands();
  if (!ipcCommandsOk) {
    log.error('Rust IPC commands check failed. Please ensure all commands are registered.');
    process.exit(1);
  }

  log.divider();

  // Run tests in sequence
  const results = {};

  // 1. Rust compilation check
  log.header('Phase 1: Rust Backend Compilation');
  results.rust = await runTest(TESTS.rust);

  if (!results.rust.success) {
    log.error('Rust compilation failed. Cannot proceed with other tests.');
    generateReport(results);
    process.exit(1);
  }

  // 2. Unit tests
  log.header('Phase 2: Unit Tests');
  results.unit = await runTest(TESTS.unit);

  // 3. Integration tests (can run independently)
  log.header('Phase 3: IPC Integration Tests');
  results.integration = await runTest(TESTS.integration);

  // 4. E2E tests (require full application)
  log.header('Phase 4: End-to-End Tests');
  results.e2e = await runTest(TESTS.e2e);

  // Generate final report
  generateReport(results);

  // Exit with appropriate code
  const allPassed = Object.values(results).every(result => result.success);
  process.exit(allPassed ? 0 : 1);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log.error(`Unhandled rejection: ${error.message}`);
  process.exit(1);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log.error(`Test suite failed: ${error.message}`);
    process.exit(1);
  });
}
