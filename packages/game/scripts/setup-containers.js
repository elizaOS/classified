#!/usr/bin/env node

/**
 * Simple cross-platform container setup for ELIZA
 * Just gets Podman/Docker working and starts our pods
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const platform = os.platform();
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';
const isLinux = platform === 'linux';

console.log('🚀 ELIZA Container Setup');
console.log(`Platform: ${platform}`);

// Simple command execution with better error handling
function run(command, options = {}) {
  try {
    console.log(`Running: ${command}`);
    const result = execSync(command, {
      stdio: 'inherit',
      encoding: 'utf8',
      ...options,
    });
    return result;
  } catch (error) {
    if (!options.allowFailure) {
      console.error(`❌ Command failed: ${command}`);
      console.error(error.message);
      process.exit(1);
    }
    return null;
  }
}

// Check if a command exists
function commandExists(command) {
  try {
    execSync(`${isWindows ? 'where' : 'which'} ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Detect and setup container runtime
function setupContainerRuntime() {
  console.log('\n📦 Setting up container runtime...');

  // Check for existing container runtimes
  const hasPodman = commandExists('podman');
  const hasDocker = commandExists('docker');

  if (hasPodman) {
    console.log('✅ Podman found');

    // Test podman connectivity
    try {
      execSync('podman ps', { stdio: 'ignore' });
      console.log('✅ Podman is working');
      return 'podman';
    } catch {
      console.log('⚠️ Podman found but not working, trying to start...');

      if (isMac) {
        try {
          run('podman machine start', { allowFailure: true });
          execSync('podman ps', { stdio: 'ignore' });
          console.log('✅ Podman machine started');
          return 'podman';
        } catch {
          console.log('❌ Podman machine failed to start');
        }
      }
    }
  }

  if (hasDocker) {
    console.log('✅ Docker found');
    try {
      execSync('docker ps', { stdio: 'ignore' });
      console.log('✅ Docker is working');
      return 'docker';
    } catch {
      console.log('❌ Docker found but not working');
    }
  }

  // Install suggestions
  console.log('\n❌ No working container runtime found!');
  console.log('\n📋 Installation instructions:');

  if (isWindows) {
    console.log('Windows:');
    console.log('1. Install WSL2: wsl --install');
    console.log('2. Install Podman Desktop: https://podman-desktop.io/downloads');
    console.log('3. Or install Docker Desktop: https://docker.com/products/docker-desktop');
  } else if (isMac) {
    console.log('macOS:');
    console.log('1. Install Podman: brew install podman');
    console.log('2. Initialize: podman machine init && podman machine start');
    console.log('3. Or install Docker Desktop: https://docker.com/products/docker-desktop');
  } else {
    console.log('Linux:');
    console.log('1. Install Podman: sudo apt install podman (Ubuntu/Debian)');
    console.log('2. Or: sudo dnf install podman (Fedora/RHEL)');
    console.log('3. Or install Docker: sudo apt install docker.io');
  }

  process.exit(1);
}

// Create container environment
function createContainerEnv() {
  console.log('\n⚙️ Creating container environment...');

  const envContent = `# ELIZA Container Environment
POSTGRES_PASSWORD=eliza_secure_password_2024
POSTGRES_USER=eliza
POSTGRES_DB=eliza
OLLAMA_HOST=http://localhost:11434
PGADMIN_DEFAULT_EMAIL=admin@eliza.local
PGADMIN_DEFAULT_PASSWORD=eliza_admin_2024
`;

  const envPath = path.join(__dirname, '..', 'src-backend', 'sandbox', '.env');
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Container environment created');
}

// Start containers using our Enhanced Sandbox Manager
function startContainers(engine) {
  console.log(`\n🐳 Starting containers with ${engine}...`);

  const sandboxDir = path.join(__dirname, '..', 'src-backend', 'sandbox');
  const composeFile = path.join(sandboxDir, 'steam-container-bundle.yaml');

  if (!fs.existsSync(composeFile)) {
    console.log('❌ Container bundle not found');
    console.log('Run the container orchestration setup first');
    process.exit(1);
  }

  // Use docker-compose command with our engine
  const composeCmd = engine === 'podman' ? 'podman-compose' : 'docker-compose';

  // Check if compose tool exists
  if (!commandExists(composeCmd)) {
    console.log(`Installing ${composeCmd}...`);
    if (engine === 'podman') {
      if (isMac) {
        run('brew install podman-compose');
      } else if (isLinux) {
        run('pip3 install podman-compose');
      } else {
        console.log('Please install podman-compose manually');
        process.exit(1);
      }
    }
  }

  // Start the containers
  process.chdir(sandboxDir);
  run(`${composeCmd} -f steam-container-bundle.yaml up -d`);

  console.log('✅ Containers started');

  // Wait a moment for startup
  console.log('⏳ Waiting for services to initialize...');
  setTimeout(() => {
    checkContainerHealth(engine);
  }, 10000);
}

// Check if containers are healthy
function checkContainerHealth(engine) {
  console.log('\n🔍 Checking container health...');

  const services = [
    { name: 'PostgreSQL', port: 7771 },
    { name: 'Ollama', port: 11434 },
    { name: 'pgAdmin', port: 5050 },
  ];

  services.forEach((service) => {
    try {
      // Simple port check
      const { execSync } = require('child_process');
      if (isWindows) {
        execSync(`netstat -an | findstr :${service.port}`, { stdio: 'ignore' });
      } else {
        execSync(`lsof -i :${service.port}`, { stdio: 'ignore' });
      }
      console.log(`✅ ${service.name} (port ${service.port})`);
    } catch {
      console.log(`❌ ${service.name} (port ${service.port}) - not responding`);
    }
  });

  console.log('\n🎉 Container setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Run: npm run dev:backend');
  console.log('2. Run: npm run dev:frontend');
  console.log('3. Open: http://localhost:1420');

  console.log('\n🔗 Container Services:');
  console.log('- ELIZA API: http://localhost:7777');
  console.log('- pgAdmin: http://localhost:5050');
  console.log('- Ollama: http://localhost:11434');
}

// Main setup flow
function main() {
  console.log('\nStarting simple container setup...\n');

  // 1. Setup container runtime
  const engine = setupContainerRuntime();

  // 2. Create environment
  createContainerEnv();

  // 3. Start containers
  startContainers(engine);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
