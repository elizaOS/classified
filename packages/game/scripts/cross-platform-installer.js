#!/usr/bin/env node

/**
 * Cross-Platform ELIZA Installer
 * Provides one-click installation on Mac, Windows, and Linux
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir, platform, arch } from 'os';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

class CrossPlatformInstaller {
  constructor() {
    this.platform = platform();
    this.arch = arch();
    this.homeDir = homedir();
    this.elizaDir = join(this.homeDir, '.eliza');
    this.registryUrl = 'ghcr.io/ai16z/eliza';  // Update this to match your registry

    console.log(`🖥️  Platform: ${this.platform} (${this.arch})`);
  }

  async detectPlatform() {
    console.log('🔍 Detecting platform capabilities...');

    const capabilities = {
      hasDocker: false,
      hasPodman: false,
      hasWSL: false,
      isAdmin: false,
      packageManager: null
    };

    // Check for container runtimes
    try {
      await execAsync('docker --version');
      capabilities.hasDocker = true;
      console.log('   ✅ Docker available');
    } catch (e) {
      console.log('   ❌ Docker not available');
    }

    try {
      await execAsync('podman --version');
      capabilities.hasPodman = true;
      console.log('   ✅ Podman available');
    } catch (e) {
      console.log('   ❌ Podman not available');
    }

    // Platform-specific checks
    if (this.platform === 'win32') {
      capabilities.hasWSL = await this.checkWSL();
    } else if (this.platform === 'linux') {
      capabilities.packageManager = await this.detectLinuxPackageManager();
    }

    return capabilities;
  }

  async checkWSL() {
    try {
      const { stdout } = await execAsync('wsl --list --verbose');
      console.log('   ✅ WSL available');
      return true;
    } catch (e) {
      console.log('   ❌ WSL not available');
      return false;
    }
  }

  async detectLinuxPackageManager() {
    const managers = [
      { cmd: 'apt-get', name: 'apt' },
      { cmd: 'dnf', name: 'dnf' },
      { cmd: 'yum', name: 'yum' },
      { cmd: 'zypper', name: 'zypper' },
      { cmd: 'pacman', name: 'pacman' }
    ];

    for (const manager of managers) {
      try {
        await execAsync(`which ${manager.cmd}`);
        console.log(`   ✅ Package manager: ${manager.name}`);
        return manager.name;
      } catch (e) {
        continue;
      }
    }

    console.log('   ❌ No known package manager found');
    return null;
  }

  async createInstallDirectory() {
    console.log('📁 Creating installation directory...');

    if (!existsSync(this.elizaDir)) {
      mkdirSync(this.elizaDir, { recursive: true });
      console.log(`   Created: ${this.elizaDir}`);
    } else {
      console.log(`   Using existing: ${this.elizaDir}`);
    }
  }

  async installContainerRuntime(capabilities) {
    console.log('🐳 Installing container runtime...');

    if (capabilities.hasDocker || capabilities.hasPodman) {
      console.log('   ✅ Container runtime already available');
      return capabilities.hasDocker ? 'docker' : 'podman';
    }

    switch (this.platform) {
      case 'darwin':
        return this.installMacContainerRuntime();
      case 'linux':
        return this.installLinuxContainerRuntime(capabilities.packageManager);
      case 'win32':
        return this.installWindowsContainerRuntime(capabilities.hasWSL);
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  async installMacContainerRuntime() {
    console.log('   🍎 Installing on macOS...');

    // Check for Homebrew
    try {
      await execAsync('brew --version');
    } catch (e) {
      console.log('   📦 Installing Homebrew...');
      await execAsync('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
    }

    try {
      console.log('   🦭 Installing Podman (recommended for macOS)...');
      await execAsync('brew install podman');

      // Initialize Podman machine
      await execAsync('podman machine init');
      await execAsync('podman machine start');

      console.log('   ✅ Podman installed and configured');
      return 'podman';
    } catch (e) {
      console.log('   🐳 Installing Docker Desktop as fallback...');
      await execAsync('brew install --cask docker');
      console.log('   ⚠️  Please start Docker Desktop manually');
      return 'docker';
    }
  }

  async installLinuxContainerRuntime(packageManager) {
    console.log('   🐧 Installing on Linux...');

    if (!packageManager) {
      throw new Error('No package manager available for automatic installation');
    }

    try {
      console.log('   🦭 Installing Podman (recommended for Linux)...');

      switch (packageManager) {
        case 'apt':
          await execAsync('sudo apt-get update');
          await execAsync('sudo apt-get install -y podman');
          break;
        case 'dnf':
          await execAsync('sudo dnf install -y podman');
          break;
        case 'yum':
          await execAsync('sudo yum install -y podman');
          break;
        case 'zypper':
          await execAsync('sudo zypper install -y podman');
          break;
        case 'pacman':
          await execAsync('sudo pacman -S --noconfirm podman');
          break;
      }

      // Configure rootless Podman
      try {
        await execAsync('sudo sysctl user.max_user_namespaces=10000');
      } catch (e) {
        console.log('   ⚠️  Could not configure user namespaces');
      }

      console.log('   ✅ Podman installed');
      return 'podman';
    } catch (e) {
      console.log('   🐳 Installing Docker as fallback...');

      if (packageManager === 'apt') {
        await execAsync('curl -fsSL https://get.docker.com -o get-docker.sh');
        await execAsync('sudo sh get-docker.sh');
        await execAsync(`sudo usermod -aG docker ${process.env.USER}`);
      } else {
        await execAsync('sudo systemctl enable --now docker');
        await execAsync(`sudo usermod -aG docker ${process.env.USER}`);
      }

      console.log('   ✅ Docker installed');
      console.log('   ⚠️  Please log out and back in to use Docker without sudo');
      return 'docker';
    }
  }

  async installWindowsContainerRuntime(hasWSL) {
    console.log('   🪟 Installing on Windows...');

    if (hasWSL) {
      console.log('   ✅ WSL detected - using Docker Desktop with WSL2 backend');
      console.log('   📥 Please install Docker Desktop manually:');
      console.log('      https://docs.docker.com/desktop/windows/');
      console.log('      Make sure to enable WSL2 integration');
    } else {
      console.log('   📥 Please install Docker Desktop manually:');
      console.log('      https://docs.docker.com/desktop/windows/');
      console.log('   💡 Or install WSL2 first for better performance:');
      console.log('      wsl --install');
    }

    console.log('');
    console.log('   ⏸️  Installation paused - please complete Docker Desktop setup');
    console.log('   ▶️  Then run this installer again');

    return 'docker';
  }

  async pullContainerImages(runtime) {
    console.log('📥 Pulling ELIZA container images...');

    const images = [
      `${this.registryUrl}/eliza-backend:latest`,
      `${this.registryUrl}/eliza-postgres:latest`
    ];

    for (const image of images) {
      console.log(`   📦 Pulling ${image}...`);

      return new Promise((resolve, reject) => {
        const pullProcess = spawn(runtime, ['pull', image], {
          stdio: 'inherit'
        });

        pullProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`   ✅ Pulled ${image}`);
            resolve();
          } else {
            reject(new Error(`Failed to pull ${image}`));
          }
        });

        pullProcess.on('error', reject);
      });
    }
  }

  async createLaunchScripts(runtime) {
    console.log('📜 Creating launch scripts...');

    // Cross-platform start script
    const startScript = this.createStartScript(runtime);
    const stopScript = this.createStopScript(runtime);
    const statusScript = this.createStatusScript(runtime);

    // Write scripts
    const scripts = [
      { name: 'start', content: startScript, description: 'Start ELIZA' },
      { name: 'stop', content: stopScript, description: 'Stop ELIZA' },
      { name: 'status', content: statusScript, description: 'Check ELIZA status' }
    ];

    for (const script of scripts) {
      const extension = this.platform === 'win32' ? '.bat' : '.sh';
      const scriptPath = join(this.elizaDir, `eliza-${script.name}${extension}`);

      writeFileSync(scriptPath, script.content);

      if (this.platform !== 'win32') {
        chmodSync(scriptPath, 0o755);
      }

      console.log(`   ✅ Created: eliza-${script.name}${extension} (${script.description})`);
    }
  }

  createStartScript(runtime) {
    if (this.platform === 'win32') {
      return `@echo off
echo Starting ELIZA...

REM Create network
${runtime} network create eliza-network 2>nul

REM Start PostgreSQL
echo Starting PostgreSQL...
${runtime} run -d ^
  --name eliza-postgres ^
  --network eliza-network ^
  -e POSTGRES_DB=eliza ^
  -e POSTGRES_USER=eliza ^
  -e POSTGRES_PASSWORD=eliza ^
  -p 5432:5432 ^
  -v eliza-postgres-data:/var/lib/postgresql/data ^
  ${this.registryUrl}/eliza-postgres:latest

timeout /t 10 /nobreak

REM Start ELIZA Backend
echo Starting ELIZA Backend...
${runtime} run -d ^
  --name eliza-backend ^
  --network eliza-network ^
  -p 7777:7777 ^
  -e DATABASE_URL=postgresql://eliza:eliza@eliza-postgres:5432/eliza ^
  -e NODE_ENV=production ^
  -v eliza-data:/app/data ^
  ${this.registryUrl}/eliza-backend:latest

echo.
echo ELIZA is starting up!
echo Access at: http://localhost:7777
echo.
pause
`;
    } else {
      return `#!/bin/bash

echo "🚀 Starting ELIZA..."

# Create network
${runtime} network create eliza-network 2>/dev/null || true

# Start PostgreSQL
echo "🗄️  Starting PostgreSQL..."
${runtime} run -d \\
  --name eliza-postgres \\
  --network eliza-network \\
  -e POSTGRES_DB=eliza \\
  -e POSTGRES_USER=eliza \\
  -e POSTGRES_PASSWORD=eliza \\
  -p 5432:5432 \\
  -v eliza-postgres-data:/var/lib/postgresql/data \\
  ${this.registryUrl}/eliza-postgres:latest

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
sleep 10

# Start ELIZA Backend
echo "🎮 Starting ELIZA Backend..."
${runtime} run -d \\
  --name eliza-backend \\
  --network eliza-network \\
  -p 7777:7777 \\
  -e DATABASE_URL=postgresql://eliza:eliza@eliza-postgres:5432/eliza \\
  -e NODE_ENV=production \\
  -v eliza-data:/app/data \\
  ${this.registryUrl}/eliza-backend:latest

echo ""
echo "🎉 ELIZA is starting up!"
echo "📱 Access at: http://localhost:7777"
echo ""
echo "To stop ELIZA, run: ./eliza-stop.sh"
`;
    }
  }

  createStopScript(runtime) {
    if (this.platform === 'win32') {
      return `@echo off
echo Stopping ELIZA...

${runtime} stop eliza-backend eliza-postgres 2>nul
${runtime} rm eliza-backend eliza-postgres 2>nul

echo ELIZA stopped.
pause
`;
    } else {
      return `#!/bin/bash

echo "🛑 Stopping ELIZA..."

${runtime} stop eliza-backend eliza-postgres 2>/dev/null || true
${runtime} rm eliza-backend eliza-postgres 2>/dev/null || true

echo "✅ ELIZA stopped."
`;
    }
  }

  createStatusScript(runtime) {
    if (this.platform === 'win32') {
      return `@echo off
echo ELIZA Status:
echo =============

${runtime} ps --filter name=eliza-postgres --filter name=eliza-backend --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"

pause
`;
    } else {
      return `#!/bin/bash

echo "📊 ELIZA Status:"
echo "==============="

${runtime} ps --filter name=eliza-postgres --filter name=eliza-backend --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
`;
    }
  }

  async createDesktopShortcuts() {
    console.log('🖥️  Creating desktop shortcuts...');

    switch (this.platform) {
      case 'darwin':
        await this.createMacShortcuts();
        break;
      case 'linux':
        await this.createLinuxDesktopFile();
        break;
      case 'win32':
        await this.createWindowsShortcuts();
        break;
    }
  }

  async createMacShortcuts() {
    // Create .app bundle for ELIZA
    const appDir = join(this.homeDir, 'Applications', 'ELIZA.app');
    const contentsDir = join(appDir, 'Contents');
    const macOSDir = join(contentsDir, 'MacOS');

    mkdirSync(macOSDir, { recursive: true });

    // Create Info.plist
    const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>eliza</string>
    <key>CFBundleIdentifier</key>
    <string>ai.eliza.game</string>
    <key>CFBundleName</key>
    <string>ELIZA</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
</dict>
</plist>`;

    writeFileSync(join(contentsDir, 'Info.plist'), infoPlist);

    // Create launcher script
    const launcher = `#!/bin/bash
cd "${this.elizaDir}"
./eliza-start.sh
open http://localhost:7777
`;

    writeFileSync(join(macOSDir, 'eliza'), launcher);
    chmodSync(join(macOSDir, 'eliza'), 0o755);

    console.log('   ✅ Created macOS .app bundle');
  }

  async createLinuxDesktopFile() {
    const desktopFile = `[Desktop Entry]
Name=ELIZA
Comment=AI Sandbox Life Simulation Game
Exec=${this.elizaDir}/eliza-start.sh
Icon=applications-games
Terminal=false
Type=Application
Categories=Game;Simulation;
`;

    const desktopPath = join(this.homeDir, '.local', 'share', 'applications', 'eliza.desktop');
    mkdirSync(dirname(desktopPath), { recursive: true });
    writeFileSync(desktopPath, desktopFile);
    chmodSync(desktopPath, 0o755);

    console.log('   ✅ Created Linux desktop file');
  }

  async createWindowsShortcuts() {
    // Note: Creating Windows shortcuts programmatically is complex
    // For now, provide instructions
    console.log('   📝 Windows shortcut instructions:');
    console.log('      1. Right-click on Desktop → New → Shortcut');
    console.log(`      2. Location: ${join(this.elizaDir, 'eliza-start.bat')}`);
    console.log('      3. Name: ELIZA');
  }

  async install() {
    try {
      console.log('🎮 ELIZA Cross-Platform Installer');
      console.log('==================================');

      // Detect platform capabilities
      const capabilities = await this.detectPlatform();

      // Create installation directory
      await this.createInstallDirectory();

      // Install container runtime if needed
      const runtime = await this.installContainerRuntime(capabilities);

      // Pull container images
      await this.pullContainerImages(runtime);

      // Create launch scripts
      await this.createLaunchScripts(runtime);

      // Create desktop shortcuts
      await this.createDesktopShortcuts();

      console.log('');
      console.log('🎉 Installation complete!');
      console.log('');
      console.log('📁 Installation directory:', this.elizaDir);
      console.log('🚀 To start ELIZA:');

      if (this.platform === 'win32') {
        console.log(`      Double-click: ${join(this.elizaDir, 'eliza-start.bat')}`);
      } else {
        console.log(`      Run: ${join(this.elizaDir, 'eliza-start.sh')}`);
      }

      console.log('🌐 Then visit: http://localhost:7777');
      console.log('');
      console.log('📋 Other commands:');
      console.log(`   Stop:   ${join(this.elizaDir, this.platform === 'win32' ? 'eliza-stop.bat' : 'eliza-stop.sh')}`);
      console.log(`   Status: ${join(this.elizaDir, this.platform === 'win32' ? 'eliza-status.bat' : 'eliza-status.sh')}`);

    } catch (error) {
      console.error('❌ Installation failed:', error.message);

      console.log('');
      console.log('💡 Manual installation options:');
      console.log('   1. Install Docker Desktop: https://docs.docker.com/get-docker/');
      console.log('   2. Pull images manually:');
      console.log(`      docker pull ${this.registryUrl}/eliza-backend:latest`);
      console.log(`      docker pull ${this.registryUrl}/eliza-postgres:latest`);
      console.log('   3. Use docker-compose from the repository');

      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const installer = new CrossPlatformInstaller();
  installer.install();
}

export { CrossPlatformInstaller };
