#!/usr/bin/env node
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { generateTestConfig } from './port-utils.js';

const execAsync = promisify(exec);

class RandomPortTestRunner {
  constructor() {
    this.backendProcess = null;
    this.frontendProcess = null;
    this.config = null;
    this.portManager = null;
  }

  log(message) {
    console.log(`[RANDOM-TEST-RUNNER] ${message}`);
  }

  error(message) {
    console.error(`[RANDOM-TEST-RUNNER] ❌ ${message}`);
  }

  success(message) {
    console.log(`[RANDOM-TEST-RUNNER] ✅ ${message}`);
  }

  async initializePorts() {
    this.log('🎲 Generating random port configuration...');
    this.config = await generateTestConfig();
    this.portManager = this.config.portManager;
    
    this.log(`Backend will use port: ${this.config.backendPort}`);
    this.log(`Frontend will use port: ${this.config.frontendPort}`);
    
    // Clear any existing processes on these ports
    await this.portManager.clearPorts([this.config.backendPort, this.config.frontendPort]);
    
    return this.config;
  }

  async killAllProcesses() {
    this.log('🧹 Killing all existing processes...');
    
    try {
      // Kill specific processes
      await execAsync('pkill -f "src-backend" || true');
      await execAsync('pkill -f "vite dev" || true');
      await execAsync('pkill -f "cypress" || true');
      
      // Clear our specific ports if they exist
      if (this.config) {
        await this.portManager.clearPorts([this.config.backendPort, this.config.frontendPort]);
      }
      
      // Wait for processes to die
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.success('All processes killed');
    } catch (error) {
      this.log('No processes to kill or already dead');
    }
  }

  async startBackend() {
    this.log(`🚀 Starting backend on port ${this.config.backendPort}...`);
    
    return new Promise((resolve, reject) => {
      this.backendProcess = spawn('bun', ['run', 'src-backend/server.ts'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: this.config.env
      });

      let hasStarted = false;
      const timeout = setTimeout(() => {
        if (!hasStarted) {
          reject(new Error('Backend failed to start within 30 seconds'));
        }
      }, 30000);

      this.backendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[BACKEND-${this.config.backendPort}] ${output.trim()}`);
        
        if (output.includes(`AgentServer is listening on port ${this.config.backendPort}`) && !hasStarted) {
          hasStarted = true;
          clearTimeout(timeout);
          this.success(`Backend started successfully on port ${this.config.backendPort}`);
          resolve();
        }
      });

      this.backendProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.log(`[BACKEND-${this.config.backendPort}-ERR] ${error.trim()}`);
      });

      this.backendProcess.on('exit', (code) => {
        if (code !== 0 && !hasStarted) {
          reject(new Error(`Backend exited with code ${code}`));
        }
      });
    });
  }

  async startFrontend() {
    this.log(`🌐 Starting frontend on port ${this.config.frontendPort}...`);
    
    return new Promise((resolve, reject) => {
      this.frontendProcess = spawn('npm', ['run', 'dev:frontend'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: this.config.env
      });

      let hasStarted = false;
      const timeout = setTimeout(() => {
        if (!hasStarted) {
          reject(new Error('Frontend failed to start within 20 seconds'));
        }
      }, 20000);

      this.frontendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[FRONTEND-${this.config.frontendPort}] ${output.trim()}`);
        
        if ((output.includes('Local:') || output.includes(`localhost:${this.config.frontendPort}`)) && !hasStarted) {
          hasStarted = true;
          clearTimeout(timeout);
          this.success(`Frontend started successfully on port ${this.config.frontendPort}`);
          resolve();
        }
      });

      this.frontendProcess.stderr.on('data', (data) => {
        const error = data.toString();
        // Only log actual errors
        if (error.includes('Error') && !error.includes('Warning')) {
          console.log(`[FRONTEND-${this.config.frontendPort}-ERR] ${error.trim()}`);
        }
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
    
    for (let i = 0; i < 20; i++) {
      try {
        const response = await fetch(`http://localhost:${this.config.backendPort}/api/server/health`);
        if (response.ok) {
          this.success('Backend health check passed');
          return true;
        }
      } catch (e) {
        // Backend not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Backend health check failed after 20 seconds');
  }

  async waitForFrontend() {
    this.log('🔍 Waiting for frontend to be accessible...');
    
    for (let i = 0; i < 20; i++) {
      try {
        const response = await fetch(`http://localhost:${this.config.frontendPort}/`);
        if (response.ok) {
          this.success('Frontend is accessible');
          return true;
        }
      } catch (e) {
        // Frontend not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Frontend not accessible after 20 seconds');
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
        const response = await fetch(`http://localhost:${this.config.backendPort}${test.url}`);
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

  async runCypressTests(specificTest = null) {
    const testFile = specificTest || 'cypress/e2e/**/*.cy.ts';
    this.log(`🧪 Running Cypress tests: ${testFile}`);
    
    return new Promise((resolve, reject) => {
      const args = ['cypress', 'run'];
      
      if (specificTest) {
        args.push('--spec', specificTest);
      }
      
      // Add config overrides for our random ports
      args.push('--config');
      args.push(`baseUrl=http://localhost:${this.config.frontendPort}`);
      
      const cypress = spawn('npx', args, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: this.config.env
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
    
    // Clear the ports we used
    if (this.config && this.portManager) {
      await this.portManager.clearPorts([this.config.backendPort, this.config.frontendPort]);
      this.portManager.releasePort(this.config.backendPort);
      this.portManager.releasePort(this.config.frontendPort);
    }
    
    await this.killAllProcesses();
  }

  async run(specificTest = null) {
    console.log('🎲 ELIZA Game E2E Test Runner (Random Ports)');
    console.log('=============================================');
    
    try {
      // Step 1: Initialize random ports
      await this.initializePorts();
      
      // Step 2: Clean slate
      await this.killAllProcesses();
      
      // Step 3: Start backend and wait for it to be ready
      await this.startBackend();
      await this.waitForBackendHealth();
      
      // Step 4: Start frontend and wait for it to be ready
      await this.startFrontend();
      await this.waitForFrontend();
      
      // Step 5: Verify APIs are working
      await this.verifyAPIs();
      
      // Step 6: Run Cypress tests
      const testsPassed = await this.runCypressTests(specificTest);
      
      if (testsPassed) {
        this.success('🏆 ALL TESTS PASSED!');
        this.success(`🎯 Backend ran on port: ${this.config.backendPort}`);
        this.success(`🎯 Frontend ran on port: ${this.config.frontendPort}`);
        await this.cleanup();
        process.exit(0);
      } else {
        this.error('💥 SOME TESTS FAILED!');
        this.error(`🎯 Backend was on port: ${this.config.backendPort}`);
        this.error(`🎯 Frontend was on port: ${this.config.frontendPort}`);
        await this.cleanup();
        process.exit(1);
      }
      
    } catch (error) {
      this.error(`Test run failed: ${error.message}`);
      if (this.config) {
        this.error(`🎯 Backend was on port: ${this.config.backendPort}`);
        this.error(`🎯 Frontend was on port: ${this.config.frontendPort}`);
      }
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Handle cleanup on exit
const runner = new RandomPortTestRunner();

process.on('SIGINT', async () => {
  console.log('\\n[RANDOM-TEST-RUNNER] Received SIGINT, cleaning up...');
  await runner.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\\n[RANDOM-TEST-RUNNER] Received SIGTERM, cleaning up...');
  await runner.cleanup();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('[RANDOM-TEST-RUNNER] Uncaught exception:', error);
  await runner.cleanup();
  process.exit(1);
});

// Parse command line arguments
const specificTest = process.argv[2];

// Run if called directly
runner.run(specificTest).catch(async (error) => {
  console.error('[RANDOM-TEST-RUNNER] Fatal error:', error);
  await runner.cleanup();
  process.exit(1);
});