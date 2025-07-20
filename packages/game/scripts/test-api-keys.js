#!/usr/bin/env node

/**
 * Test runner for API key setup and database verification
 * Runs comprehensive Cypress tests to verify API key storage and usage
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

class APIKeyTestRunner {
  constructor() {
    this.serverProcess = null;
    this.testResults = [];
    this.startTime = Date.now();
  }

  async run() {
    console.log('🔑 Starting API Key and Database Verification Tests');
    console.log('=' .repeat(60));
    
    try {
      await this.prepareEnvironment();
      await this.startServer();
      await this.waitForServer();
      await this.runTests();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async prepareEnvironment() {
    console.log('📋 Preparing test environment...');
    
    // Clear any existing API keys
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.MODEL_PROVIDER;
    
    // Clean data directory
    const dataDir = path.join(process.cwd(), 'data');
    if (fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true, force: true });
      console.log('  ✓ Cleaned data directory');
    }
    
    // Ensure Cypress directories exist
    const cypressDir = path.join(process.cwd(), 'cypress');
    if (!fs.existsSync(cypressDir)) {
      console.log('  ❌ Cypress directory not found');
      throw new Error('Cypress not configured');
    }
    
    console.log('  ✓ Environment prepared');
  }

  async startServer() {
    console.log('🚀 Starting development server...');
    
    return new Promise((resolve, reject) => {
      // Build first
      exec('npm run build', (error) => {
        if (error) {
          reject(new Error(`Build failed: ${error.message}`));
          return;
        }
        
        // Start the dev server
        this.serverProcess = spawn('npm', ['run', 'dev'], {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env }
        });

        this.serverProcess.stdout.on('data', (data) => {
          const output = data.toString();
          console.log('  📡', output.trim());
          
          if (output.includes('Local:   http://localhost:5174')) {
            console.log('  ✓ Frontend server ready');
          }
          if (output.includes('[BACKEND] Server listening on port 7777')) {
            console.log('  ✓ Backend server ready');
            resolve();
          }
        });

        this.serverProcess.stderr.on('data', (data) => {
          const error = data.toString();
          if (!error.includes('warn') && !error.includes('deprecated')) {
            console.error('  ⚠️ Server error:', error.trim());
          }
        });

        this.serverProcess.on('error', (error) => {
          reject(new Error(`Server failed to start: ${error.message}`));
        });
        
        // Timeout after 60 seconds
        setTimeout(() => {
          if (!this.serverReady) {
            reject(new Error('Server startup timeout'));
          }
        }, 60000);
      });
    });
  }

  async waitForServer() {
    console.log('⏳ Waiting for server to be fully ready...');
    
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch('http://localhost:7777/api/server/health');
        if (response.ok) {
          console.log('  ✓ Backend health check passed');
          
          // Also check frontend
          const frontendResponse = await fetch('http://localhost:5174');
          if (frontendResponse.ok) {
            console.log('  ✓ Frontend accessible');
            return;
          }
        }
      } catch (error) {
        // Server not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      process.stdout.write(`.`);
    }
    
    throw new Error('Server failed to become ready');
  }

  async runTests() {
    console.log('\n🧪 Running API Key and Database Tests...');
    
    const testSuites = [
      {
        name: 'API Key Setup Flow',
        spec: 'cypress/e2e/api-key-setup-comprehensive.cy.ts',
        critical: true
      },
      {
        name: 'Database Verification',
        spec: 'cypress/e2e/api-key-database-verification.cy.ts', 
        critical: true
      }
    ];

    for (const suite of testSuites) {
      console.log(`\n📝 Running: ${suite.name}`);
      console.log('-'.repeat(40));
      
      try {
        const result = await this.runCypressTest(suite.spec);
        this.testResults.push({
          name: suite.name,
          spec: suite.spec,
          success: result.success,
          duration: result.duration,
          details: result.details,
          critical: suite.critical
        });
        
        if (result.success) {
          console.log(`  ✅ ${suite.name} - PASSED (${result.duration}ms)`);
        } else {
          console.log(`  ❌ ${suite.name} - FAILED`);
          console.log(`     Error: ${result.error}`);
          
          if (suite.critical) {
            throw new Error(`Critical test failed: ${suite.name}`);
          }
        }
      } catch (error) {
        console.error(`  💥 ${suite.name} - ERROR: ${error.message}`);
        this.testResults.push({
          name: suite.name,
          spec: suite.spec,
          success: false,
          error: error.message,
          critical: suite.critical
        });
        
        if (suite.critical) {
          throw error;
        }
      }
    }
  }

  async runCypressTest(spec) {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const cypress = spawn('npx', ['cypress', 'run', '--spec', spec, '--browser', 'chrome', '--headless'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      cypress.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Show real-time progress for key events
        if (text.includes('✓') || text.includes('✗') || text.includes('ELIZA OS Configuration')) {
          console.log('    ', text.trim());
        }
      });

      cypress.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      cypress.on('close', (code) => {
        const duration = Date.now() - startTime;
        const success = code === 0;
        
        resolve({
          success,
          duration,
          code,
          output,
          error: errorOutput,
          details: {
            passedTests: (output.match(/✓/g) || []).length,
            failedTests: (output.match(/✗/g) || []).length,
            totalTests: (output.match(/✓|✗/g) || []).length
          }
        });
      });
    });
  }

  async generateReport() {
    console.log('\n📊 Test Results Summary');
    console.log('=' .repeat(60));
    
    const totalTime = Date.now() - this.startTime;
    let passedTests = 0;
    let failedTests = 0;
    let criticalFailures = 0;

    this.testResults.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const duration = result.duration ? `(${result.duration}ms)` : '';
      
      console.log(`${status} ${result.name} ${duration}`);
      
      if (result.success) {
        passedTests++;
        if (result.details) {
          console.log(`    Tests: ${result.details.passedTests}✓ ${result.details.failedTests}✗`);
        }
      } else {
        failedTests++;
        if (result.critical) criticalFailures++;
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
      }
    });

    console.log('\n' + '=' .repeat(60));
    console.log(`Total Execution Time: ${totalTime}ms`);
    console.log(`Test Suites: ${passedTests} passed, ${failedTests} failed`);
    
    if (criticalFailures > 0) {
      console.log(`❌ ${criticalFailures} critical failures detected`);
      console.log('\n🔍 Key Areas Verified:');
      console.log('  • API key setup flow detection and UI');
      console.log('  • Database storage of configuration');
      console.log('  • Runtime integration with stored keys'); 
      console.log('  • Memory system functionality');
      console.log('  • Service availability and health checks');
      
      process.exit(1);
    } else {
      console.log('✅ All critical tests passed!');
      console.log('\n🎉 API Key and Database Integration Verified:');
      console.log('  ✓ Setup wizard detects missing keys correctly');
      console.log('  ✓ API keys are stored securely in database');
      console.log('  ✓ Keys are available to runtime after setup');
      console.log('  ✓ Database persistence works correctly');
      console.log('  ✓ Agent services can access configured keys');
      console.log('  ✓ Memory system functions with database');
      console.log('  ✓ Configuration APIs work end-to-end');
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      console.log('  ✓ Server process terminated');
    }
    
    // Clean up screenshots and videos
    const screenshotsDir = path.join(process.cwd(), 'cypress', 'screenshots');
    const videosDir = path.join(process.cwd(), 'cypress', 'videos');
    
    [screenshotsDir, videosDir].forEach(dir => {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`  ✓ Cleaned ${path.basename(dir)}`);
        } catch (error) {
          console.log(`  ⚠️ Could not clean ${path.basename(dir)}: ${error.message}`);
        }
      }
    });
    
    console.log('  ✓ Cleanup complete');
  }
}

// Run the tests
const runner = new APIKeyTestRunner();
runner.run().catch(console.error);