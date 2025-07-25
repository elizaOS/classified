#!/usr/bin/env node
/**
 * Comprehensive Test Suite for ELIZA Game
 *
 * Runs all tests in sequence:
 * 1. TypeScript compilation check
 * 2. Build verification
 * 3. E2E tests with real runtime
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

class ComprehensiveTestRunner {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
  }

  async run() {
    console.log(chalk.blue.bold('\n🚀 ELIZA Game Comprehensive Test Suite\n'));

    try {
      // Step 1: TypeScript compilation check
      await this.runTypeScriptCheck();

      // Step 2: Build verification
      await this.runBuild();

      // Step 3: Start services for E2E tests
      const { backend, frontend } = await this.startServices();

      // Step 4: Run E2E tests
      await this.runE2ETests();

      // Step 5: Cleanup
      await this.cleanup(backend, frontend);

      // Step 6: Report results
      this.reportResults();
    } catch (error) {
      console.error(chalk.red('\n❌ Test suite failed:'), error.message);
      process.exit(1);
    }
  }

  async runTypeScriptCheck() {
    console.log(chalk.yellow('📝 Step 1: TypeScript Compilation Check\n'));

    const startTime = Date.now();

    try {
      await this.runCommand('npx', ['tsc', '--noEmit', '-p', 'tsconfig.backend.json'], {
        cwd: projectRoot,
        silent: true,
      });

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'TypeScript Compilation',
        status: 'PASSED',
        duration,
      });

      console.log(chalk.green(`✅ TypeScript compilation successful (${duration}ms)\n`));
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'TypeScript Compilation',
        status: 'FAILED',
        duration,
        error: error.message,
      });

      console.log(chalk.red(`❌ TypeScript compilation failed (${duration}ms)`));
      console.log(chalk.red('Error output:'), error.message);

      // Continue with warning instead of failing
      console.log(chalk.yellow('\n⚠️  Continuing with type errors present...\n'));
    }
  }

  async runBuild() {
    console.log(chalk.yellow('🔨 Step 2: Build Verification\n'));

    const startTime = Date.now();

    try {
      await this.runCommand('npm', ['run', 'build'], {
        cwd: projectRoot,
      });

      // Verify build outputs exist
      const requiredFiles = ['dist-backend/server.js', 'dist-backend/agent.js', 'dist/index.html'];

      for (const file of requiredFiles) {
        const filePath = path.join(projectRoot, file);
        const stats = await fs.stat(filePath);
        console.log(chalk.gray(`  ✓ ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`));
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Build Process',
        status: 'PASSED',
        duration,
      });

      console.log(chalk.green(`\n✅ Build successful (${duration}ms)\n`));
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Build Process',
        status: 'FAILED',
        duration,
        error: error.message,
      });

      throw new Error(`Build failed: ${error.message}`);
    }
  }

  async startServices() {
    console.log(chalk.yellow('🚀 Step 3: Starting Services\n'));

    // Start backend
    console.log(chalk.gray('  Starting backend server...'));
    const backend = spawn('bun', ['run', 'src-backend/server.ts'], {
      cwd: projectRoot,
      env: { ...process.env, NODE_ENV: 'test', PORT: '7777' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Wait for backend to be ready
    await this.waitForService('http://localhost:7777/api/server/health', 'Backend');

    // Start frontend
    console.log(chalk.gray('  Starting frontend server...'));
    const frontend = spawn('npm', ['run', 'dev:frontend'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Wait for frontend to be ready
    await this.waitForService('http://localhost:5173', 'Frontend');

    console.log(chalk.green('\n✅ Services started successfully\n'));

    return { backend, frontend };
  }

  async runE2ETests() {
    console.log(chalk.yellow('🧪 Step 4: Running E2E Tests\n'));

    const startTime = Date.now();

    try {
      // Load environment for API keys
      await this.loadEnvironment();

      // Run Cypress tests
      await this.runCommand(
        'npx',
        ['cypress', 'run', '--spec', 'cypress/e2e/system-integration.cy.ts'],
        {
          cwd: projectRoot,
          env: {
            ...process.env,
            CYPRESS_BASE_URL: 'http://localhost:5173',
            CYPRESS_OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            CYPRESS_ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          },
        }
      );

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'E2E Tests',
        status: 'PASSED',
        duration,
      });

      console.log(chalk.green(`\n✅ E2E tests passed (${duration}ms)\n`));
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'E2E Tests',
        status: 'FAILED',
        duration,
        error: error.message,
      });

      throw new Error(`E2E tests failed: ${error.message}`);
    }
  }

  async cleanup(backend, frontend) {
    console.log(chalk.yellow('🧹 Step 5: Cleanup\n'));

    // Kill processes
    if (backend) {backend.kill();}
    if (frontend) {frontend.kill();}

    // Stop containers
    await this.runCommand('npm', ['run', 'containers:stop'], {
      cwd: projectRoot,
      silent: true,
    }).catch(() => {}); // Ignore errors

    console.log(chalk.green('✅ Cleanup complete\n'));
  }

  reportResults() {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.testResults.filter((r) => r.status === 'PASSED').length;
    const failed = this.testResults.filter((r) => r.status === 'FAILED').length;

    console.log(chalk.blue.bold('\n📊 Test Results Summary\n'));
    console.log(chalk.gray('═'.repeat(60)));

    for (const result of this.testResults) {
      const status = result.status === 'PASSED' ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED');
      const duration = chalk.gray(`(${result.duration}ms)`);

      console.log(`${result.name.padEnd(30)} ${status} ${duration}`);

      if (result.error) {
        console.log(chalk.red(`  Error: ${result.error.substring(0, 100)}...`));
      }
    }

    console.log(chalk.gray('═'.repeat(60)));
    console.log(`\nTotal: ${this.testResults.length} tests`);
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(chalk.gray(`Duration: ${(totalDuration / 1000).toFixed(2)}s`));

    if (failed > 0) {
      console.log(chalk.red('\n❌ Test suite failed'));
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ All tests passed!'));
      process.exit(0);
    }
  }

  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: options.cwd || projectRoot,
        env: options.env || process.env,
        stdio: options.silent ? 'pipe' : 'inherit',
      });

      let output = '';

      if (options.silent) {
        proc.stdout?.on('data', (data) => (output += data));
        proc.stderr?.on('data', (data) => (output += data));
      }

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(output || `Command failed with code ${code}`));
        }
      });
    });
  }

  async waitForService(url, name, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          console.log(chalk.gray(`  ✓ ${name} is ready`));
          return;
        }
      } catch (error) {
        // Service not ready yet
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`${name} failed to start within ${maxAttempts} seconds`);
  }

  async loadEnvironment() {
    const envPath = path.resolve(projectRoot, '../../.env');
    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      envContent.split('\n').forEach((line) => {
        if (line && !line.startsWith('#') && line.includes('=')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not load .env file'));
    }
  }
}

// Handle missing chalk gracefully
if (!chalk) {
  global.chalk = {
    blue: { bold: (s) => s },
    yellow: (s) => s,
    green: (s) => s,
    red: (s) => s,
    gray: (s) => s,
  };
}

// Run the test suite
const runner = new ComprehensiveTestRunner();
runner.run();
