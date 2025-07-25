#!/usr/bin/env node

/**
 * Build backend using Bun for standalone container deployment
 * Creates a single executable with all dependencies bundled
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

class BunBackendBuilder {
  constructor() {
    this.gameDir = join(__dirname, '..');
    this.srcBackendDir = join(this.gameDir, 'src-backend');
    this.distDir = join(this.gameDir, 'dist-backend');
    this.packagePath = join(this.gameDir, 'package.json');
  }

  async checkBun() {
    try {
      const { stdout } = await execAsync('bun --version');
      console.log(`✅ Bun detected: ${stdout.trim()}`);
      return true;
    } catch (error) {
      console.error('❌ Bun not found. Installing Bun...');
      return this.installBun();
    }
  }

  async installBun() {
    try {
      console.log('📦 Installing Bun...');
      await execAsync('curl -fsSL https://bun.sh/install | bash');

      // Add bun to PATH for current session
      process.env.PATH = `${process.env.HOME}/.bun/bin:${process.env.PATH}`;

      const { stdout } = await execAsync('bun --version');
      console.log(`✅ Bun installed: ${stdout.trim()}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to install Bun:', error.message);
      console.log('Please install Bun manually: https://bun.sh/');
      return false;
    }
  }

  async installDependencies() {
    console.log('📦 Installing dependencies with Bun...');

    // Skip dependency installation in monorepo - dependencies should already be installed
    console.log('ℹ️  Skipping dependency installation (assuming monorepo setup)');

    // Verify that node_modules exists
    const nodeModulesPath = join(this.gameDir, 'node_modules');
    if (!existsSync(nodeModulesPath)) {
      console.log('⚠️  node_modules not found, attempting to install...');

      return new Promise((resolve, reject) => {
        const bunInstall = spawn('bun', ['install'], {
          cwd: this.gameDir,
          stdio: 'inherit'
        });

        bunInstall.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Dependencies installed');
            resolve();
          } else {
            console.log('⚠️  Bun install failed, but continuing...');
            resolve(); // Continue anyway - dependencies might be available via workspace
          }
        });

        bunInstall.on('error', () => {
          console.log('⚠️  Bun install error, but continuing...');
          resolve(); // Continue anyway
        });
      });
    }

    console.log('✅ Dependencies check complete');
  }

  async buildStandalone() {
    console.log('🔨 Building standalone backend with Bun...');

    // Ensure dist directory exists
    if (!existsSync(this.distDir)) {
      mkdirSync(this.distDir, { recursive: true });
    }

    // Build server as standalone executable
    await this.buildExecutable('server.ts', 'eliza-server');

    // Build agent as standalone executable
    await this.buildExecutable('agent.ts', 'eliza-agent');

    // Copy essential files
    this.copyEssentialFiles();

    console.log('✅ Standalone backend built successfully');
  }

  async buildExecutable(entryFile, outputName) {
    const entryPath = join(this.srcBackendDir, entryFile);
    const outputPath = join(this.distDir, outputName);

    if (!existsSync(entryPath)) {
      throw new Error(`Entry file not found: ${entryPath}`);
    }

    console.log(`   Building ${entryFile} -> ${outputName}...`);

    return new Promise((resolve, reject) => {
      const bunBuild = spawn('bun', [
        'build',
        '--compile',
        '--minify',
        '--sourcemap',
        '--target=bun',
        '--outfile', outputPath,
        entryPath
      ], {
        cwd: this.gameDir,
        stdio: 'inherit'
      });

      bunBuild.on('close', (code) => {
        if (code === 0) {
          console.log(`   ✅ ${outputName} built successfully`);
          resolve();
        } else {
          reject(new Error(`Build failed for ${entryFile} with exit code ${code}`));
        }
      });

      bunBuild.on('error', reject);
    });
  }

  copyEssentialFiles() {
    console.log('📄 Copying essential files...');

    const filesToCopy = [
      'terminal-character.json',
      '.env.example'
    ];

    for (const file of filesToCopy) {
      const sourcePath = join(this.srcBackendDir, file);
      const destPath = join(this.distDir, file);

      if (existsSync(sourcePath)) {
        copyFileSync(sourcePath, destPath);
        console.log(`   ✅ Copied ${file}`);
      }
    }

    // Create container-optimized package.json
    this.createContainerPackageJson();
  }

  createContainerPackageJson() {
    const originalPackage = JSON.parse(readFileSync(this.packagePath, 'utf-8'));

    const containerPackage = {
      name: '@elizaos/game-backend',
      version: originalPackage.version,
      type: 'module',
      scripts: {
        start: './eliza-server',
        'start:agent': './eliza-agent'
      },
      // Only include essential runtime dependencies
      dependencies: {
        // Core dependencies needed at runtime
        'pg': '^8.11.0',
        'dotenv': '^16.0.0',
        'uuid': '^9.0.0'
      }
    };

    const containerPackagePath = join(this.distDir, 'package.json');
    writeFileSync(containerPackagePath, JSON.stringify(containerPackage, null, 2));
    console.log('   ✅ Created container package.json');
  }

  async createStartupScript() {
    console.log('📝 Creating startup script...');

    const startupScript = `#!/bin/bash

# ELIZA Backend Startup Script
# Handles data persistence and container initialization

set -e

echo "🎮 Starting ELIZA Backend..."

# Set default environment variables
export NODE_ENV=\${NODE_ENV:-production}
export SERVER_PORT=\${SERVER_PORT:-7777}
export DATABASE_PATH=\${DATABASE_PATH:-/app/data}
export PGLITE_DATA_DIR=\${PGLITE_DATA_DIR:-/app/data}

# Create data directory if it doesn't exist
mkdir -p "\$DATABASE_PATH"
mkdir -p "\$PGLITE_DATA_DIR"

echo "💾 Data directory: \$DATABASE_PATH"
echo "🗄️  Database directory: \$PGLITE_DATA_DIR"

# Ensure proper permissions
chown -R \$(id -u):\$(id -g) "\$DATABASE_PATH" 2>/dev/null || true
chown -R \$(id -u):\$(id -g) "\$PGLITE_DATA_DIR" 2>/dev/null || true

# Check if this is a fresh start
if [ "\$CLEAN_START" = "true" ]; then
  echo "🧹 CLEAN_START=true - Will remove existing data on server start"
fi

# Start the server
echo "🚀 Starting ELIZA server on port \$SERVER_PORT..."
exec ./eliza-server
`;

    const scriptPath = join(this.distDir, 'start.sh');
    writeFileSync(scriptPath, startupScript);

    // Make executable
    await execAsync(`chmod +x "${scriptPath}"`);
    console.log('   ✅ Created startup script');
  }

  async build() {
    try {
      console.log('🔨 ELIZA Backend Builder (Bun)');
      console.log('===============================');

      // Check/install Bun
      const bunAvailable = await this.checkBun();
      if (!bunAvailable) {
        throw new Error('Bun is required but not available');
      }

      // Install dependencies
      await this.installDependencies();

      // Build standalone executables
      await this.buildStandalone();

      // Create startup script
      await this.createStartupScript();

      console.log('');
      console.log('🎉 Backend build complete!');
      console.log('');
      console.log('Built files:');
      console.log(`   📁 ${this.distDir}/`);
      console.log('   🔧 eliza-server (standalone executable)');
      console.log('   🤖 eliza-agent (standalone executable)');
      console.log('   📜 start.sh (startup script)');
      console.log('   📄 package.json (container-optimized)');
      console.log('');
      console.log('Ready for container deployment! 🐳');

    } catch (error) {
      console.error('❌ Build failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const builder = new BunBackendBuilder();
  builder.build();
}

export { BunBackendBuilder };
