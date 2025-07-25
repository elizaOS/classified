#!/usr/bin/env node
/**
 * Container Setup Verification Script
 *
 * This script verifies that Podman and container orchestration are working correctly.
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class ContainerVerificationRunner {
  constructor() {
    this.results = {
      podman: { status: 'pending', message: '' },
      machine: { status: 'pending', message: '' },
      containers: { status: 'pending', message: '' },
      orchestrator: { status: 'pending', message: '' },
      connectivity: { status: 'pending', message: '' },
    };
  }

  async run() {
    console.log('🐳 ELIZA Container Setup Verification\n');
    console.log('━'.repeat(60));

    try {
      await this.checkPodmanInstallation();
      await this.checkPodmanMachine();
      await this.checkContainerStatus();
      await this.checkOrchestrator();
      await this.checkContainerConnectivity();

      this.generateReport();
    } catch (error) {
      console.error('❌ Container verification failed:', error.message);
      process.exit(1);
    }
  }

  async checkPodmanInstallation() {
    console.log('🔍 Checking Podman installation...');

    try {
      const { stdout } = await execAsync('podman --version');
      this.results.podman = {
        status: 'success',
        message: `Installed: ${stdout.trim()}`,
      };
      console.log(`✅ ${this.results.podman.message}`);
    } catch (error) {
      this.results.podman = {
        status: 'failed',
        message: 'Podman not found or not working',
      };
      console.log(`❌ ${this.results.podman.message}`);
    }
  }

  async checkPodmanMachine() {
    console.log('\n🔍 Checking Podman machine status...');

    try {
      const { stdout } = await execAsync('podman machine list');
      const lines = stdout.trim().split('\n');

      if (lines.length > 1 && stdout.includes('Currently running')) {
        this.results.machine = {
          status: 'success',
          message: 'Podman machine is running',
        };
        console.log('✅ Podman machine is running');

        // Show machine details
        const machineDetails = lines.slice(1).join('\n');
        console.log('📋 Machine details:');
        console.log(machineDetails);
      } else {
        this.results.machine = {
          status: 'warning',
          message: 'Podman machine may not be running',
        };
        console.log('⚠️  Podman machine may not be running');
      }
    } catch (error) {
      this.results.machine = {
        status: 'failed',
        message: 'Could not check Podman machine status',
      };
      console.log(`❌ ${this.results.machine.message}`);
    }
  }

  async checkContainerStatus() {
    console.log('\n🔍 Checking ELIZA container status...');

    try {
      // Check container orchestrator status
      const result = await this.runCommand('bun', [
        'run',
        'src-backend/ContainerOrchestrator.ts',
        'status',
      ]);

      if (result.stdout.includes('running')) {
        const runningContainers = result.stdout.match(/(\w+-\w+): running/g) || [];
        this.results.containers = {
          status: 'success',
          message: `Found ${runningContainers.length} running ELIZA containers`,
        };
        console.log(`✅ ${this.results.containers.message}`);

        runningContainers.forEach((container) => {
          console.log(`  📦 ${container}`);
        });
      } else {
        this.results.containers = {
          status: 'warning',
          message: 'No ELIZA containers currently running',
        };
        console.log(`⚠️  ${this.results.containers.message}`);
      }
    } catch (error) {
      this.results.containers = {
        status: 'failed',
        message: 'Could not check container status',
      };
      console.log(`❌ ${this.results.containers.message}`);
    }
  }

  async checkOrchestrator() {
    console.log('\n🔍 Testing container orchestrator...');

    try {
      // Test basic orchestrator functionality
      const result = await this.runCommand(
        'bun',
        ['run', 'src-backend/ContainerOrchestrator.ts', 'status'],
        15000
      );

      if (result.code === 0) {
        this.results.orchestrator = {
          status: 'success',
          message: 'Container orchestrator is working',
        };
        console.log('✅ Container orchestrator is working');
      } else {
        this.results.orchestrator = {
          status: 'failed',
          message: 'Container orchestrator failed',
        };
        console.log('❌ Container orchestrator failed');
      }
    } catch (error) {
      this.results.orchestrator = {
        status: 'failed',
        message: 'Could not test container orchestrator',
      };
      console.log(`❌ ${this.results.orchestrator.message}`);
    }
  }

  async checkContainerConnectivity() {
    console.log('\n🔍 Testing container service connectivity...');

    const services = [
      { name: 'PostgreSQL', url: 'http://localhost:5432', expected: 'connection' },
      { name: 'Ollama', url: 'http://localhost:11434', expected: 'Ollama is running' },
    ];

    let workingServices = 0;

    for (const service of services) {
      try {
        if (service.name === 'PostgreSQL') {
          // For Postgres, just test if port is open
          const { stdout } = await execAsync(
            'podman exec eliza-postgres pg_isready -U postgres 2>/dev/null || echo "not connected"'
          );
          if (stdout.includes('accepting connections')) {
            console.log(`✅ ${service.name} is accepting connections`);
            workingServices++;
          } else {
            console.log(`⚠️  ${service.name} is not responding`);
          }
        } else if (service.name === 'Ollama') {
          // Test Ollama HTTP endpoint
          const { stdout } = await execAsync(
            'curl -s http://localhost:11434 || echo "not connected"'
          );
          if (stdout.includes('Ollama is running')) {
            console.log(`✅ ${service.name} is responding`);
            workingServices++;
          } else {
            console.log(`⚠️  ${service.name} is not responding`);
          }
        }
      } catch (error) {
        console.log(`⚠️  ${service.name} is not responding`);
      }
    }

    if (workingServices === services.length) {
      this.results.connectivity = {
        status: 'success',
        message: `All ${workingServices} container services are responding`,
      };
    } else if (workingServices > 0) {
      this.results.connectivity = {
        status: 'warning',
        message: `${workingServices}/${services.length} container services are responding`,
      };
    } else {
      this.results.connectivity = {
        status: 'failed',
        message: 'No container services are responding',
      };
    }

    console.log(`📊 ${this.results.connectivity.message}`);
  }

  async runCommand(command, args, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      process.on('error', (error) => {
        reject(error);
      });

      setTimeout(() => {
        process.kill('SIGTERM');
        resolve({ code: -1, stdout, stderr: 'timeout' });
      }, timeout);
    });
  }

  generateReport() {
    console.log(`\n${'━'.repeat(60)}`);
    console.log('📊 CONTAINER VERIFICATION REPORT');
    console.log('━'.repeat(60));

    const checks = Object.keys(this.results);
    let successful = 0;
    let warnings = 0;
    let failed = 0;

    checks.forEach((check) => {
      const result = this.results[check];
      let symbol = '';

      if (result.status === 'success') {
        symbol = '✅';
        successful++;
      } else if (result.status === 'warning') {
        symbol = '⚠️';
        warnings++;
      } else {
        symbol = '❌';
        failed++;
      }

      console.log(`${symbol} ${check}: ${result.message}`);
    });

    console.log('━'.repeat(60));
    console.log(`📈 Summary: ${successful} successful, ${warnings} warnings, ${failed} failed`);

    if (failed === 0 && warnings === 0) {
      console.log('🎉 ALL CONTAINER CHECKS PASSED!');
    } else if (failed === 0) {
      console.log('✅ Container system is working (with minor warnings)');
    } else {
      console.log('⚠️  Container system has issues that need attention');
    }

    console.log('\n💡 To start containers: bun run src-backend/ContainerOrchestrator.ts start');
    console.log('💡 To check status: bun run src-backend/ContainerOrchestrator.ts status');
    console.log('💡 To stop containers: bun run src-backend/ContainerOrchestrator.ts stop');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ContainerVerificationRunner();
  runner.run().catch((error) => {
    console.error('❌ Container verification failed:', error);
    process.exit(1);
  });
}

export default ContainerVerificationRunner;
