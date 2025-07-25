#!/usr/bin/env node

/**
 * Cross-platform container runtime manager
 * Supports both Docker and Podman with automatic detection
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

export class ContainerManager {
  constructor() {
    this.runtime = null;
    this.isRootless = false;
    this.platform = this.detectPlatform();
  }

  detectPlatform() {
    const platform = process.platform;
    if (platform === 'win32') {
      // Check if running in WSL
      try {
        const releaseInfo = readFileSync('/proc/version', 'utf8');
        if (releaseInfo.toLowerCase().includes('microsoft')) {
          return 'wsl';
        }
      } catch (e) {
        // Not in WSL, pure Windows
      }
      return 'windows';
    }
    return platform; // 'darwin', 'linux', etc.
  }

  async detectContainerRuntime() {
    const runtimes = ['podman', 'docker'];

    for (const runtime of runtimes) {
      try {
        const { stdout } = await execAsync(`${runtime} --version`);
        if (stdout) {
          this.runtime = runtime;

          // Check if running rootless
          if (runtime === 'podman') {
            try {
              const { stdout: infoOutput } = await execAsync('podman info --format json');
              const info = JSON.parse(infoOutput);
              this.isRootless = !info.host.security.rootless === false;
            } catch (e) {
              // Assume rootless if we can't determine
              this.isRootless = true;
            }
          } else if (runtime === 'docker') {
            try {
              await execAsync('docker info');
              this.isRootless = false; // Docker typically runs with daemon
            } catch (e) {
              // Docker daemon might not be running
              console.warn('Docker daemon may not be running');
            }
          }

          console.log(`✅ Container runtime detected: ${runtime} (${this.isRootless ? 'rootless' : 'daemon-based'})`);
          return runtime;
        }
      } catch (error) {
        // Runtime not available, continue checking
      }
    }

    console.error('❌ No container runtime found. Please install Docker or Podman.');
    return null;
  }

  async installContainerRuntime() {
    console.log('🔧 Installing container runtime...');

    switch (this.platform) {
      case 'darwin':
        return this.installMacOS();
      case 'linux':
        return this.installLinux();
      case 'wsl':
        return this.installWSL();
      case 'windows':
        return this.installWindows();
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  async installMacOS() {
    console.log('📦 Installing on macOS...');

    // Check for Homebrew
    try {
      await execAsync('brew --version');
    } catch (e) {
      console.log('Installing Homebrew first...');
      await execAsync('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
    }

    // Prefer Podman for better security and rootless operation
    try {
      console.log('Installing Podman...');
      await execAsync('brew install podman');

      // Initialize Podman machine (required on macOS)
      await execAsync('podman machine init');
      await execAsync('podman machine start');

      this.runtime = 'podman';
      this.isRootless = true;
      return 'podman';
    } catch (e) {
      console.log('Podman installation failed, trying Docker Desktop...');
      await execAsync('brew install --cask docker');
      console.log('⚠️  Please start Docker Desktop manually and try again');
      this.runtime = 'docker';
      return 'docker';
    }
  }

  async installLinux() {
    console.log('📦 Installing on Linux...');

    // Detect package manager
    const packageManagers = [
      { cmd: 'apt-get', install: 'apt-get install -y', update: 'apt-get update' },
      { cmd: 'dnf', install: 'dnf install -y', update: 'dnf check-update' },
      { cmd: 'yum', install: 'yum install -y', update: 'yum check-update' },
      { cmd: 'zypper', install: 'zypper install -y', update: 'zypper refresh' },
      { cmd: 'pacman', install: 'pacman -S --noconfirm', update: 'pacman -Sy' }
    ];

    let pm = null;
    for (const manager of packageManagers) {
      try {
        await execAsync(`which ${manager.cmd}`);
        pm = manager;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!pm) {
      throw new Error('No supported package manager found');
    }

    // Prefer Podman on Linux for rootless containers
    try {
      console.log('Installing Podman...');
      if (pm.update) {
        await execAsync(`sudo ${pm.update}`);
      }
      await execAsync(`sudo ${pm.install} podman`);

      // Enable user namespaces for rootless operation
      try {
        await execAsync('sudo sysctl user.max_user_namespaces=1000');
        await execAsync('echo "user.max_user_namespaces=1000" | sudo tee -a /etc/sysctl.conf');
      } catch (e) {
        console.warn('Could not configure user namespaces, rootless mode may not work');
      }

      this.runtime = 'podman';
      this.isRootless = true;
      return 'podman';
    } catch (e) {
      console.log('Podman installation failed, trying Docker...');

      // Install Docker
      if (pm.cmd === 'apt-get') {
        // Ubuntu/Debian
        await execAsync('curl -fsSL https://get.docker.com -o get-docker.sh');
        await execAsync('sudo sh get-docker.sh');
        await execAsync(`sudo usermod -aG docker ${process.env.USER}`);
        console.log('⚠️  Please log out and back in to use Docker without sudo');
      } else {
        // Other distributions
        await execAsync(`sudo ${pm.install} docker`);
        await execAsync('sudo systemctl enable --now docker');
        await execAsync(`sudo usermod -aG docker ${process.env.USER}`);
      }

      this.runtime = 'docker';
      return 'docker';
    }
  }

  async installWSL() {
    console.log('📦 Installing on WSL...');

    // In WSL, prefer Docker Desktop integration
    console.log('For WSL, please install Docker Desktop on Windows and enable WSL2 integration');
    console.log('Download from: https://docker.com/products/docker-desktop');
    console.log('');
    console.log('Alternatively, install Podman in WSL:');

    return this.installLinux(); // Use Linux installation in WSL
  }

  async installWindows() {
    console.log('📦 Installing on Windows...');
    console.log('Please install Docker Desktop from: https://docker.com/products/docker-desktop');
    console.log('Or install WSL2 and use the Linux installation method');
    throw new Error('Automatic installation not supported on Windows. Please install manually.');
  }

  async buildImages() {
    if (!this.runtime) {
      await this.detectContainerRuntime();
    }

    if (!this.runtime) {
      throw new Error('No container runtime available');
    }

    console.log(`🔨 Building ELIZA containers with ${this.runtime}...`);

    // Build from the game package directory
    const gameDir = join(__dirname, '..');
    const projectRoot = join(__dirname, '../../..');
    const dockerfilePath = join(gameDir, 'src-backend/Dockerfile.simple');

    if (!existsSync(dockerfilePath)) {
      throw new Error(`Dockerfile not found at ${dockerfilePath}`);
    }

    // First ensure backend is built
    console.log('🔧 Building backend before container...');
    try {
      await execAsync('npm run build:backend', { cwd: gameDir });
      console.log('✅ Backend built successfully');
    } catch (error) {
      console.error('❌ Backend build failed:', error.message);
      throw new Error('Backend build is required for container');
    }

    // Build the main application image from project root
    const buildCmd = `${this.runtime} build -t eliza-game:latest -f ${dockerfilePath} ${projectRoot}`;
    console.log(`Running: ${buildCmd}`);

    return new Promise((resolve, reject) => {
      const buildProcess = spawn(this.runtime, [
        'build',
        '-t', 'eliza-game:latest',
        '-f', dockerfilePath,
        projectRoot
      ], {
        stdio: 'inherit',
        cwd: projectRoot
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Container image built successfully');
          resolve();
        } else {
          reject(new Error(`Build failed with exit code ${code}`));
        }
      });

      buildProcess.on('error', reject);
    });
  }

  async startServices() {
    if (!this.runtime) {
      await this.detectContainerRuntime();
    }

    console.log(`🚀 Starting ELIZA services with ${this.runtime}...`);

    const composeFile = join(__dirname, '../docker-compose.yml');

    if (existsSync(composeFile)) {
      // Use compose if available
      const composeCmd = this.runtime === 'podman' ? 'podman-compose' : 'docker-compose';

      try {
        await execAsync(`${composeCmd} --version`);
        const startCmd = `${composeCmd} -f ${composeFile} up -d`;
        console.log(`Running: ${startCmd}`);
        await execAsync(startCmd);
        console.log('✅ Services started with compose');
        return;
      } catch (e) {
        console.log('Compose not available, starting containers individually...');
      }
    }

    // Start containers individually
    await this.startPostgreSQL();
    await this.startElizaGame();
  }

  async startPostgreSQL() {
    const postgresCmd = [
      this.runtime, 'run', '-d',
      '--name', 'eliza-postgres',
      '--network', 'eliza-network',
      '-e', 'POSTGRES_DB=eliza',
      '-e', 'POSTGRES_USER=eliza',
      '-e', 'POSTGRES_PASSWORD=eliza',
      '-p', '5432:5432',
      '-v', 'eliza-postgres-data:/var/lib/postgresql/data',
      'pgvector/pgvector:pg15'
    ];

    try {
      // Create network if it doesn't exist
      await execAsync(`${this.runtime} network create eliza-network`).catch(() => {});

      // Remove existing container if running
      await execAsync(`${this.runtime} rm -f eliza-postgres`).catch(() => {});

      console.log('Starting PostgreSQL container...');
      await execAsync(postgresCmd.join(' '));
      console.log('✅ PostgreSQL started');
    } catch (error) {
      console.error('❌ Failed to start PostgreSQL:', error.message);
      throw error;
    }
  }

  async startElizaGame() {
    const elizaCmd = [
      this.runtime, 'run', '-d',
      '--name', 'eliza-game',
      '--network', 'eliza-network',
      '-p', '7777:7777',
      '-e', 'DATABASE_URL=postgresql://eliza:eliza@eliza-postgres:5432/eliza',
      '-e', 'NODE_ENV=production',
      'eliza-game:latest'
    ];

    try {
      // Remove existing container if running
      await execAsync(`${this.runtime} rm -f eliza-game`).catch(() => {});

      console.log('Starting ELIZA game container...');
      await execAsync(elizaCmd.join(' '));
      console.log('✅ ELIZA game started on http://localhost:7777');
    } catch (error) {
      console.error('❌ Failed to start ELIZA game:', error.message);
      throw error;
    }
  }

  async stopServices() {
    if (!this.runtime) {
      await this.detectContainerRuntime();
    }

    console.log('🛑 Stopping ELIZA services...');

    const containers = ['eliza-game', 'eliza-postgres'];

    for (const container of containers) {
      try {
        await execAsync(`${this.runtime} stop ${container}`);
        await execAsync(`${this.runtime} rm ${container}`);
        console.log(`✅ Stopped ${container}`);
      } catch (e) {
        console.log(`ℹ️  Container ${container} was not running`);
      }
    }
  }

  async getStatus() {
    if (!this.runtime) {
      await this.detectContainerRuntime();
    }

    console.log(`📊 ELIZA Services Status (${this.runtime}):`);
    console.log('═'.repeat(50));

    const containers = ['eliza-postgres', 'eliza-game'];

    for (const container of containers) {
      try {
        const { stdout } = await execAsync(`${this.runtime} ps --filter name=${container} --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"`);
        console.log(stdout);
      } catch (e) {
        console.log(`${container}: Not running`);
      }
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new ContainerManager();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'detect':
        await manager.detectContainerRuntime();
        break;
      case 'install':
        await manager.installContainerRuntime();
        break;
      case 'build':
        await manager.buildImages();
        break;
      case 'start':
        await manager.startServices();
        break;
      case 'stop':
        await manager.stopServices();
        break;
      case 'status':
        await manager.getStatus();
        break;
      case 'restart':
        await manager.stopServices();
        await manager.startServices();
        break;
      default:
        console.log('ELIZA Container Manager');
        console.log('');
        console.log('Usage:');
        console.log('  node container-manager.js detect   - Detect available container runtime');
        console.log('  node container-manager.js install  - Install container runtime');
        console.log('  node container-manager.js build    - Build ELIZA container images');
        console.log('  node container-manager.js start    - Start all services');
        console.log('  node container-manager.js stop     - Stop all services');
        console.log('  node container-manager.js restart  - Restart all services');
        console.log('  node container-manager.js status   - Show service status');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

export default ContainerManager;
