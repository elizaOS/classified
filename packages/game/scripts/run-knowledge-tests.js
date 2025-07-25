#!/usr/bin/env node

/**
 * Knowledge Management Tests Runner
 *
 * This script ensures that both backend and frontend are running,
 * then executes the Cypress tests for knowledge management functionality.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BACKEND_PORT = 7777;
const FRONTEND_PORT = 5173;
const MAX_RETRIES = 60; // Increased to 2 minutes
const RETRY_DELAY = 2000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isServiceRunning(port, serviceName) {
  try {
    // Use 127.0.0.1 instead of localhost for better compatibility
    const url = port === BACKEND_PORT ?
      `http://127.0.0.1:${port}/api/server/health` :
      `http://127.0.0.1:${port}`;

    const response = await fetch(url, {
      timeout: 5000,
      signal: AbortSignal.timeout(5000)
    });

    if (response.status < 500) { // Accept any non-5xx status
      console.log(`✅ ${serviceName} is running on port ${port} (status: ${response.status})`);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function waitForService(port, serviceName, maxRetries = MAX_RETRIES) {
  console.log(`🔄 Waiting for ${serviceName} on port ${port}...`);

  for (let i = 0; i < maxRetries; i++) {
    if (await isServiceRunning(port, serviceName)) {
      return true;
    }

    if (i < maxRetries - 1) {
      console.log(`⏳ ${serviceName} not ready yet, retrying in ${RETRY_DELAY/1000}s... (${i + 1}/${maxRetries})`);
      await sleep(RETRY_DELAY);
    }
  }

  console.error(`❌ ${serviceName} failed to start after ${maxRetries} attempts`);
  return false;
}

async function killProcessOnPort(port) {
  try {
    await execAsync(`lsof -ti:${port} | xargs kill -9`);
    console.log(`🔪 Killed any existing process on port ${port}`);
    await sleep(1000);
  } catch (error) {
    // Ignore errors - no process was running
  }
}

async function startBackend() {
  console.log('🚀 Starting backend server...');

  // Kill any existing backend process
  await killProcessOnPort(BACKEND_PORT);

  // Start backend server
  const backend = spawn('npm', ['run', 'dev:backend'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    shell: true
  });

  let backendReady = false;

  backend.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[BACKEND] ${output.trim()}`);

    if (output.includes('Game backend is ready!') || output.includes('Server started on port')) {
      backendReady = true;
    }
  });

  backend.stderr.on('data', (data) => {
    const error = data.toString();
    if (!error.includes('objc[') && !error.includes('Class GNotificationCenterDelegate')) {
      console.log(`[BACKEND ERR] ${error.trim()}`);
    }
  });

  // Wait for backend to be ready
  const backendStarted = await waitForService(BACKEND_PORT, 'Backend Server');

  if (!backendStarted) {
    backend.kill('SIGTERM');
    throw new Error('Failed to start backend server');
  }

  // Additional check for specific API endpoints
  await sleep(5000); // Give backend extra time to fully initialize
  console.log('🔍 Verifying backend API endpoints are ready...');

  try {
    const healthCheck = await fetch(`http://127.0.0.1:${BACKEND_PORT}/knowledge/documents`);
    console.log(`✅ Knowledge API endpoint ready (status: ${healthCheck.status})`);
  } catch (error) {
    console.log('⚠️ Knowledge API endpoint not yet ready, but continuing...');
  }

  return backend;
}

async function startFrontend() {
  console.log('🚀 Starting frontend server...');

  // Kill any existing frontend process
  await killProcessOnPort(FRONTEND_PORT);

  // Start frontend server
  const frontend = spawn('npm', ['run', 'dev:frontend'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    shell: true
  });

  frontend.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[FRONTEND] ${output.trim()}`);
  });

  frontend.stderr.on('data', (data) => {
    const error = data.toString();
    console.log(`[FRONTEND ERR] ${error.trim()}`);
  });

  // Wait for frontend to be ready
  const frontendStarted = await waitForService(FRONTEND_PORT, 'Frontend Server');

  if (!frontendStarted) {
    frontend.kill('SIGTERM');
    throw new Error('Failed to start frontend server');
  }

  return frontend;
}

async function runCypressTests() {
  console.log('🧪 Running Knowledge Management Cypress Tests...');

  try {
    const { stdout, stderr } = await execAsync(
      'npx cypress run --spec "cypress/e2e/knowledge-api-fixes-validation.cy.ts" --reporter spec',
      { timeout: 120000 }
    );

    console.log('✅ CYPRESS TEST OUTPUT:');
    console.log(stdout);

    if (stderr) {
      console.log('⚠️ CYPRESS STDERR:');
      console.log(stderr);
    }

    console.log('🎉 Knowledge Management tests completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Cypress tests failed:');
    console.error(error.stdout || error.message);

    if (error.stderr) {
      console.error('STDERR:', error.stderr);
    }

    return false;
  }
}

async function main() {
  console.log('🎯 Knowledge Management API Fixes Test Runner');
  console.log('================================================');

  let backendProcess = null;
  let frontendProcess = null;

  try {
    // Start backend server
    backendProcess = await startBackend();

    // Start frontend server
    frontendProcess = await startFrontend();

    // Run the tests
    const success = await runCypressTests();

    console.log('================================================');
    if (success) {
      console.log('🎉 ALL TESTS PASSED! Knowledge Management API fixes are working correctly.');
    } else {
      console.log('❌ TESTS FAILED! Please check the output above for details.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);

  } finally {
    // Cleanup processes
    console.log('🧹 Cleaning up processes...');

    if (backendProcess) {
      backendProcess.kill('SIGTERM');
      console.log('🔪 Backend server stopped');
    }

    if (frontendProcess) {
      frontendProcess.kill('SIGTERM');
      console.log('🔪 Frontend server stopped');
    }

    // Kill any remaining processes on the ports
    await killProcessOnPort(BACKEND_PORT);
    await killProcessOnPort(FRONTEND_PORT);

    console.log('✅ Cleanup completed');
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { main };
