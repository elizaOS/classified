#!/usr/bin/env node

/**
 * E2E Test Runner for ElizaOS Game
 * Manages backend and frontend servers, runs Cypress tests, and cleans up
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

// Configuration
const BACKEND_PORT = 7777;
const FRONTEND_PORT = 5173;
const BACKEND_DIR = join(__dirname, '..', 'agentserver');
const TIMEOUT_SECONDS = 60;

let backendProcess = null;
let frontendProcess = null;
let exitCode = 0;

// Helper function to check if a server is running
async function checkServer(url, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  return false;
}

// Start backend server
async function startBackend() {
  console.log(`${colors.yellow}Starting backend server...${colors.reset}`);

  return new Promise((resolve, reject) => {
    backendProcess = spawn('bun', ['run', 'dev'], {
      cwd: BACKEND_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    backendProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    backendProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    backendProcess.on('error', (error) => {
      console.error(`${colors.red}Backend failed to start:${colors.reset}`, error);
      reject(error);
    });

    // Check if backend is ready
    process.stdout.write('Waiting for backend to start');
    checkServer(`http://localhost:${BACKEND_PORT}/api/server/health`).then((isRunning) => {
      if (isRunning) {
        console.log(`\n${colors.green}✓ Backend is ready!${colors.reset}`);
        resolve();
      } else {
        console.log(`\n${colors.red}✗ Backend failed to start${colors.reset}`);
        console.log('Last output:', output.slice(-500));
        reject(new Error('Backend failed to start'));
      }
    });
  });
}

// Start frontend server
async function startFrontend() {
  console.log(`${colors.yellow}Starting frontend server...${colors.reset}`);

  return new Promise((resolve, reject) => {
    frontendProcess = spawn('npx', ['vite', '--host'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    frontendProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    frontendProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    frontendProcess.on('error', (error) => {
      console.error(`${colors.red}Frontend failed to start:${colors.reset}`, error);
      reject(error);
    });

    // Check if frontend is ready
    process.stdout.write('Waiting for frontend to start');
    checkServer(`http://localhost:${FRONTEND_PORT}`).then((isRunning) => {
      if (isRunning) {
        console.log(`\n${colors.green}✓ Frontend is ready!${colors.reset}`);
        resolve();
      } else {
        console.log(`\n${colors.red}✗ Frontend failed to start${colors.reset}`);
        console.log('Last output:', output.slice(-500));
        reject(new Error('Frontend failed to start'));
      }
    });
  });
}

// Run Cypress tests
function runTests() {
  console.log(`\n${colors.yellow}Running E2E tests...${colors.reset}`);
  console.log('=================================');

  return new Promise((resolve) => {
    const cypress = spawn(
      'npx',
      ['cypress', 'run', '--spec', 'cypress/e2e/**/*.cy.ts', '--reporter', 'spec'],
      {
        cwd: __dirname,
        stdio: 'inherit',
      }
    );

    cypress.on('close', (code) => {
      exitCode = code || 0;
      resolve();
    });

    cypress.on('error', (error) => {
      console.error(`${colors.red}Cypress failed:${colors.reset}`, error);
      exitCode = 1;
      resolve();
    });
  });
}

// Cleanup function
function cleanup() {
  console.log(`\n${colors.yellow}Cleaning up...${colors.reset}`);

  if (backendProcess) {
    console.log('Stopping backend server...');
    backendProcess.kill('SIGTERM');
  }

  if (frontendProcess) {
    console.log('Stopping frontend server...');
    frontendProcess.kill('SIGTERM');
  }

  // Force kill after 5 seconds if processes don't exit gracefully
  setTimeout(() => {
    if (backendProcess) backendProcess.kill('SIGKILL');
    if (frontendProcess) frontendProcess.kill('SIGKILL');
    process.exit(exitCode);
  }, 5000);
}

// Handle exit signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Main execution
async function main() {
  console.log(`${colors.yellow}🚀 Starting E2E Test Suite...${colors.reset}\n`);

  try {
    // Check if servers are already running
    const backendRunning = await checkServer(
      `http://localhost:${BACKEND_PORT}/api/server/health`,
      3
    );
    const frontendRunning = await checkServer(`http://localhost:${FRONTEND_PORT}`, 3);

    if (!backendRunning) {
      await startBackend();
    } else {
      console.log(`${colors.green}✓ Backend is already running${colors.reset}`);
    }

    if (!frontendRunning) {
      await startFrontend();
    } else {
      console.log(`${colors.green}✓ Frontend is already running${colors.reset}`);
    }

    // Run the tests
    await runTests();

    // Summary
    console.log('\n=================================');
    if (exitCode === 0) {
      console.log(`${colors.green}✓ All E2E tests passed!${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Some tests failed (exit code: ${exitCode})${colors.reset}`);
      console.log(
        `${colors.yellow}Check the screenshots and videos in cypress/screenshots and cypress/videos${colors.reset}`
      );
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    exitCode = 1;
  } finally {
    cleanup();
  }
}

// Run the main function
main().catch((error) => {
  console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
  exitCode = 1;
  cleanup();
});
