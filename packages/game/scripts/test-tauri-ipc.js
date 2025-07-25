#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Tauri IPC Integration');
console.log('================================\n');

// Configuration
const STARTUP_DELAY = 30000; // 30 seconds for full system startup
const TEST_TIMEOUT = 120000; // 2 minutes for tests

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n📌 Running: ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  let tauriProcess;
  let cypressProcess;

  try {
    // Step 1: Build the Tauri app
    console.log('\n🔨 Building Tauri app...');
    await runCommand('npm', ['run', 'build:tauri'], {
      cwd: path.join(__dirname, '..')
    });

    // Step 2: Start Tauri dev server
    console.log('\n🚀 Starting Tauri development server...');
    tauriProcess = spawn('npm', ['run', 'dev:tauri'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true
    });

    // Wait for everything to start up
    console.log(`\n⏳ Waiting ${STARTUP_DELAY/1000} seconds for full system startup...`);
    await delay(STARTUP_DELAY);

    // Step 3: Run the Tauri IPC integration test
    console.log('\n🧪 Running Tauri IPC integration tests...');
    await runCommand('npx', [
      'cypress', 'run',
      '--spec', 'cypress/e2e/tauri-ipc-integration.cy.ts',
      '--browser', 'chrome',
      '--config', 'video=true,screenshotOnRunFailure=true'
    ], {
      cwd: path.join(__dirname, '..'),
      timeout: TEST_TIMEOUT
    });

    console.log('\n✅ All Tauri IPC tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up...');

    if (tauriProcess) {
      console.log('Stopping Tauri process...');
      tauriProcess.kill();
    }

    // Give processes time to clean up
    await delay(2000);
  }
}

// Run the test
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
