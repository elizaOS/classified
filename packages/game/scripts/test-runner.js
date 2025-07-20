#!/usr/bin/env node
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class TestRunner {
  constructor() {
    this.backendProcess = null;
    this.frontendProcess = null;
    this.BACKEND_PORT = 3000;
    this.FRONTEND_PORT = 5173;
  }

  log(message) {
    console.log(`[TEST-RUNNER] ${message}`);
  }

  error(message) {
    console.error(`[TEST-RUNNER] ❌ ${message}`);
  }

  success(message) {
    console.log(`[TEST-RUNNER] ✅ ${message}`);
  }

  async killAllProcesses() {
    this.log('🧹 Killing all existing processes...');
    
    try {
      // Kill specific processes
      await execAsync('pkill -f "src-backend" || true');
      await execAsync('pkill -f "vite dev" || true');
      await execAsync('pkill -f "cypress" || true');
      
      // Wait for processes to die
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.success('All processes killed');
    } catch (error) {
      // Don't fail if no processes to kill
      this.log('No processes to kill or already dead');
    }
  }

  async startBackend() {
    this.log('🚀 Starting backend...');
    
    return new Promise((resolve, reject) => {
      this.backendProcess = spawn('bun', ['run', 'src-backend/server.ts'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let hasStarted = false;
      const timeout = setTimeout(() => {
        if (!hasStarted) {
          reject(new Error('Backend failed to start within 20 seconds'));
        }
      }, 20000);

      this.backendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('AgentServer is listening on port 3000') && !hasStarted) {
          hasStarted = true;
          clearTimeout(timeout);
          this.success('Backend started successfully');
          resolve();
        }
      });

      this.backendProcess.stderr.on('data', (data) => {
        const error = data.toString();
        // Only log actual errors, not warnings
        if (error.includes('Error:') && !error.includes('Warning')) {
          this.error(`Backend stderr: ${error}`);
        }
      });

      this.backendProcess.on('exit', (code) => {
        if (code !== 0 && !hasStarted) {
          reject(new Error(`Backend exited with code ${code}`));
        }
      });
    });
  }

  async startFrontend() {
    this.log('🌐 Starting frontend...');
    
    return new Promise((resolve, reject) => {
      this.frontendProcess = spawn('npm', ['run', 'dev:frontend'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let hasStarted = false;
      const timeout = setTimeout(() => {
        if (!hasStarted) {
          reject(new Error('Frontend failed to start within 15 seconds'));
        }
      }, 15000);

      this.frontendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if ((output.includes('Local:') || output.includes('localhost:5173')) && !hasStarted) {
          hasStarted = true;
          clearTimeout(timeout);
          this.success('Frontend started successfully');
          resolve();
        }
      });

      this.frontendProcess.stderr.on('data', (data) => {
        // Vite sometimes logs to stderr, ignore unless it's an actual error
      });

      this.frontendProcess.on('exit', (code) => {
        if (code !== 0 && !hasStarted) {
          reject(new Error(`Frontend exited with code ${code}`));
        }
      });
    });
  }

  async waitForBackendHealth() {
    this.log('🔍 Waiting for backend health check...');
    
    for (let i = 0; i < 15; i++) {
      try {
        const response = await fetch(`http://localhost:${this.BACKEND_PORT}/api/server/health`);
        if (response.ok) {
          this.success('Backend health check passed');
          return true;
        }
      } catch (e) {
        // Backend not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Backend health check failed after 15 seconds');
  }

  async waitForFrontend() {
    this.log('🔍 Waiting for frontend to be accessible...');
    
    for (let i = 0; i < 15; i++) {
      try {
        const response = await fetch(`http://localhost:${this.FRONTEND_PORT}/`);
        if (response.ok) {
          this.success('Frontend is accessible');
          return true;
        }
      } catch (e) {
        // Frontend not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Frontend not accessible after 15 seconds');
  }

  async verifyAPIs() {
    this.log('🔧 Verifying critical APIs...');
    
    const tests = [
      { name: 'Health Check', url: '/api/server/health' },
      { name: 'Goals API', url: '/api/goals' },
      { name: 'Todos API', url: '/api/todos' },
      { name: 'Autonomy Status', url: '/autonomy/status' },
      { name: 'Vision Settings', url: '/api/agents/default/settings/vision' }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        const response = await fetch(`http://localhost:${this.BACKEND_PORT}${test.url}`);
        if (response.ok) {
          console.log(`  ✅ ${test.name}`);
          passed++;
        } else {
          console.log(`  ❌ ${test.name} (${response.status})`);
          failed++;
        }
      } catch (error) {
        console.log(`  ❌ ${test.name} (Error: ${error.message})`);
        failed++;
      }
    }

    this.log(`API Verification: ${passed} passed, ${failed} failed`);
    
    if (failed > 0) {
      this.error('Some APIs are not working - tests may fail');
    } else {
      this.success('All critical APIs are working');
    }
  }

  async testAutonomyFunctionality() {
    this.log('🤖 Testing autonomy functionality...');
    
    try {
      // Test autonomy status
      const statusResponse = await fetch(`http://localhost:${this.BACKEND_PORT}/autonomy/status`);
      if (!statusResponse.ok) {
        throw new Error('Autonomy status check failed');
      }
      const statusData = await statusResponse.json();
      console.log(`  ✅ Autonomy status: ${statusData.data.enabled ? 'enabled' : 'disabled'}`);

      // Test enable autonomy
      const enableResponse = await fetch(`http://localhost:${this.BACKEND_PORT}/autonomy/enable`, { 
        method: 'POST' 
      });
      if (!enableResponse.ok) {
        throw new Error('Autonomy enable failed');
      }
      const enableData = await enableResponse.json();
      console.log(`  ✅ Autonomy enable: ${enableData.success ? 'success' : 'failed'}`);

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test disable autonomy
      const disableResponse = await fetch(`http://localhost:${this.BACKEND_PORT}/autonomy/disable`, { 
        method: 'POST' 
      });
      if (!disableResponse.ok) {
        throw new Error('Autonomy disable failed');
      }
      const disableData = await disableResponse.json();
      console.log(`  ✅ Autonomy disable: ${disableData.success ? 'success' : 'failed'}`);

      // Test toggle autonomy
      const toggleResponse = await fetch(`http://localhost:${this.BACKEND_PORT}/autonomy/toggle`, { 
        method: 'POST' 
      });
      if (!toggleResponse.ok) {
        throw new Error('Autonomy toggle failed');
      }
      const toggleData = await toggleResponse.json();
      console.log(`  ✅ Autonomy toggle: ${toggleData.success ? 'success' : 'failed'}`);

      this.success('Autonomy functionality tests passed!');
    } catch (error) {
      this.error(`Autonomy functionality test failed: ${error.message}`);
      throw error;
    }
  }

  async runCypressTests() {
    this.log('🧪 Running Cypress E2E tests...');
    
    return new Promise((resolve, reject) => {
      const cypress = spawn('npx', ['cypress', 'run', '--browser', 'chrome', '--headed'], {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: {
          ...process.env,
          CYPRESS_BACKEND_URL: `http://localhost:${this.BACKEND_PORT}`,
          CYPRESS_FRONTEND_URL: `http://localhost:${this.FRONTEND_PORT}`
        }
      });

      cypress.on('exit', (code) => {
        if (code === 0) {
          this.success('🎉 All Cypress tests passed!');
          resolve(true);
        } else {
          this.error(`Tests failed with exit code ${code}`);
          resolve(false);
        }
      });

      cypress.on('error', (error) => {
        this.error(`Cypress error: ${error.message}`);
        reject(error);
      });
    });
  }

  async cleanup() {
    this.log('🧹 Cleaning up...');
    
    if (this.backendProcess) {
      this.backendProcess.kill('SIGTERM');
    }
    
    if (this.frontendProcess) {
      this.frontendProcess.kill('SIGTERM');
    }
    
    await this.killAllProcesses();
  }

  async run() {
    console.log('🧪 ELIZA Game E2E Test Runner');
    console.log('================================');
    
    try {
      // Step 1: Clean slate
      await this.killAllProcesses();
      
      // Step 2: Start backend and wait for it to be ready
      await this.startBackend();
      await this.waitForBackendHealth();
      
      // Step 3: Start frontend and wait for it to be ready
      await this.startFrontend();
      await this.waitForFrontend();
      
      // Step 4: Verify APIs are working
      await this.verifyAPIs();
      
      // Step 5: Test autonomy functionality
      await this.testAutonomyFunctionality();
      
      // Step 6: Run Cypress tests
      const testsPassed = await this.runCypressTests();
      
      if (testsPassed) {
        this.success('🏆 ALL TESTS PASSED!');
        process.exit(0);
      } else {
        this.error('💥 SOME TESTS FAILED!');
        process.exit(1);
      }
      
    } catch (error) {
      this.error(`Test run failed: ${error.message}`);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Handle cleanup on exit
const runner = new TestRunner();

process.on('SIGINT', async () => {
  console.log('\n[TEST-RUNNER] Received SIGINT, cleaning up...');
  await runner.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[TEST-RUNNER] Received SIGTERM, cleaning up...');
  await runner.cleanup();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('[TEST-RUNNER] Uncaught exception:', error);
  await runner.cleanup();
  process.exit(1);
});

// Run if called directly
runner.run().catch(async (error) => {
  console.error('[TEST-RUNNER] Fatal error:', error);
  await runner.cleanup();
  process.exit(1);
});