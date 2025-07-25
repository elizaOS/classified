#!/usr/bin/env node
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class SimpleTestRunner {
  constructor() {
    this.backendProcess = null;
    this.frontendProcess = null;
  }

  log(message) {
    console.log(`[TEST] ${message}`);
  }

  async killExistingProcesses() {
    this.log('🧹 Cleaning up existing processes...');
    try {
      await execAsync('pkill -f "src-backend" || true');
      await execAsync('pkill -f "vite dev" || true');
      await execAsync('lsof -ti:7777 | xargs kill -9 || true');
      await execAsync('lsof -ti:5173 | xargs kill -9 || true');
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.log('✅ Cleanup complete');
    } catch (error) {
      this.log('No existing processes to clean up');
    }
  }

  async startServers() {
    this.log('🚀 Starting backend server...');
    this.backendProcess = spawn('bun', ['run', 'src-backend/server.ts'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      detached: false
    });

    // Wait for backend to start
    await new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:7777/api/server/health');
          if (response.ok) {
            this.log('✅ Backend is ready');
            resolve();
          }
        } catch (e) {
          this.log('⏳ Waiting for backend...');
          setTimeout(resolve, 2000);
        }
      }, 7777);
    });

    this.log('🌐 Starting frontend server...');
    this.frontendProcess = spawn('npm', ['run', 'dev:frontend'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      detached: false
    });

    // Wait for frontend to start
    await new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:5173');
          if (response.ok) {
            this.log('✅ Frontend is ready');
            resolve();
          }
        } catch (e) {
          this.log('⏳ Waiting for frontend...');
          setTimeout(resolve, 2000);
        }
      }, 5000);
    });
  }

  async runCypressTests() {
    this.log('🧪 Running Cypress tests in headed mode...');

    return new Promise((resolve, reject) => {
      const cypress = spawn('npx', ['cypress', 'run', '--browser', 'chrome', '--headed'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      cypress.on('exit', (code) => {
        if (code === 0) {
          this.log('🎉 All Cypress tests passed!');
          resolve(true);
        } else {
          this.log(`❌ Tests failed with exit code ${code}`);
          resolve(false);
        }
      });

      cypress.on('error', (error) => {
        this.log(`❌ Cypress error: ${error.message}`);
        reject(error);
      });
    });
  }

  async cleanup() {
    this.log('🧹 Cleaning up processes...');

    if (this.backendProcess) {
      this.backendProcess.kill('SIGTERM');
    }

    if (this.frontendProcess) {
      this.frontendProcess.kill('SIGTERM');
    }

    await this.killExistingProcesses();
  }

  async run() {
    console.log('🧪 ELIZA Game Plugin Testing Suite');
    console.log('==================================');

    try {
      await this.killExistingProcesses();
      await this.startServers();

      // Give servers a moment to stabilize
      await new Promise(resolve => setTimeout(resolve, 7777));

      const testsPassed = await this.runCypressTests();

      if (testsPassed) {
        this.log('🏆 ALL TESTS PASSED!');
        process.exit(0);
      } else {
        this.log('💥 SOME TESTS FAILED!');
        process.exit(1);
      }

    } catch (error) {
      this.log(`Test run failed: ${error.message}`);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Handle cleanup on exit
const runner = new SimpleTestRunner();

process.on('SIGINT', async () => {
  console.log('\n[TEST] Received SIGINT, cleaning up...');
  await runner.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[TEST] Received SIGTERM, cleaning up...');
  await runner.cleanup();
  process.exit(0);
});

runner.run().catch(async (error) => {
  console.error('[TEST] Fatal error:', error);
  await runner.cleanup();
  process.exit(1);
});
