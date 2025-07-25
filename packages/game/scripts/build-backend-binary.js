#!/usr/bin/env node
/**
 * Backend Binary Compilation Script
 *
 * Compiles the TypeScript backend server into standalone binaries using Bun
 * for distribution with Tauri app (no Node.js/Bun runtime required)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

class BackendBinaryBuilder {
  constructor() {
    this.platforms = [
      { name: 'win', target: 'bun-windows-x64', ext: '.exe', bunTarget: 'bun-windows-x64' },
      { name: 'macos', target: 'bun-darwin-x64', ext: '', bunTarget: 'bun-darwin-x64' },
      { name: 'macos-arm64', target: 'bun-darwin-arm64', ext: '', bunTarget: 'bun-darwin-arm64' },
      { name: 'linux', target: 'bun-linux-x64', ext: '', bunTarget: 'bun-linux-x64' },
    ];
    this.outputDir = path.join(projectRoot, 'dist-binaries');
  }

  async build() {
    console.log('🔨 Building ELIZA backend binaries using Bun for Tauri distribution...\n');

    try {
      // Step 1: Ensure Bun is available
      await this.ensureBunAvailable();

      // Step 2: Create output directory
      await this.createOutputDirectory();

      // Step 3: Compile binaries for all platforms
      await this.compileBinaries();

      // Step 4: Verify binaries
      await this.verifyBinaries();

      console.log('\n✅ All backend binaries compiled successfully!');
      console.log(`📦 Binaries available in: ${this.outputDir}`);
    } catch (error) {
      console.error('❌ Backend binary compilation failed:', error.message);
      process.exit(1);
    }
  }

  async ensureBunAvailable() {
    console.log('🔍 Checking for Bun runtime...');

    try {
      const bunVersion = execSync('bun --version', { encoding: 'utf8' }).trim();
      console.log(`✅ Bun is available: v${bunVersion}`);
    } catch (error) {
      throw new Error('Bun is not installed. Please install Bun from https://bun.sh');
    }
  }

  async createOutputDirectory() {
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.outputDir, { recursive: true });

    // Create platform-specific directories
    for (const platform of this.platforms) {
      fs.mkdirSync(path.join(this.outputDir, platform.name), { recursive: true });
    }
  }

  async compileBinaries() {
    console.log('🔨 Compiling backend binaries using Bun for all platforms...\n');

    const serverSourcePath = path.join(projectRoot, '../../packages/agentserver/server.ts');

    for (const platform of this.platforms) {
      console.log(`📦 Compiling for ${platform.name} (${platform.bunTarget})...`);

      const outputPath = path.join(this.outputDir, platform.name, `eliza-backend${platform.ext}`);

      try {
        // Use Bun's --compile flag to create standalone executable
        const buildCommand = [
          'bun',
          'build',
          serverSourcePath,
          '--compile',
          '--target',
          platform.bunTarget,
          '--outfile',
          outputPath,
        ].join(' ');

        console.log(`🔧 Running: ${buildCommand}`);

        execSync(buildCommand, {
          cwd: path.resolve(projectRoot, '../../packages/agentserver'),
          stdio: 'pipe', // Reduce noise, but capture errors
        });

        console.log(`✅ ${platform.name} binary compiled: ${path.basename(outputPath)}`);
      } catch (error) {
        console.error(`❌ Failed to compile ${platform.name} binary:`, error.message);

        // Show stderr for debugging
        if (error.stderr) {
          console.error('Error details:', error.stderr.toString());
        }

        throw error;
      }
    }
  }

  async verifyBinaries() {
    console.log('\n🔍 Verifying compiled binaries...');

    for (const platform of this.platforms) {
      const binaryPath = path.join(this.outputDir, platform.name, `eliza-backend${platform.ext}`);

      if (fs.existsSync(binaryPath)) {
        const stats = fs.statSync(binaryPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`✅ ${platform.name}: ${path.basename(binaryPath)} (${sizeMB} MB)`);

        // Make binary executable on Unix systems
        if (platform.ext === '' && (platform.name === 'macos' || platform.name === 'linux')) {
          try {
            fs.chmodSync(binaryPath, '755');
            console.log(`✅ Made ${platform.name} binary executable`);
          } catch (error) {
            console.warn(
              `⚠️ Failed to set executable permissions for ${platform.name}:`,
              error.message
            );
          }
        }
      } else {
        throw new Error(`Binary not found: ${binaryPath}`);
      }
    }
  }

  async buildForCurrentPlatform() {
    console.log('🔨 Building backend binary for current platform using Bun...\n');

    await this.ensureBunAvailable();
    await this.createOutputDirectory();

    const serverSourcePath = path.join(projectRoot, '../../packages/agentserver/server.ts');

    // Detect current platform
    let currentPlatform;
    const platform = process.platform;
    const arch = process.arch;

    if (platform === 'win32') {
      currentPlatform = this.platforms.find((p) => p.name === 'win');
    } else if (platform === 'darwin') {
      if (arch === 'arm64') {
        currentPlatform = this.platforms.find((p) => p.name === 'macos-arm64');
      } else {
        currentPlatform = this.platforms.find((p) => p.name === 'macos');
      }
    } else if (platform === 'linux') {
      currentPlatform = this.platforms.find((p) => p.name === 'linux');
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`📦 Compiling for current platform: ${currentPlatform.name}`);

    const outputPath = path.join(
      this.outputDir,
      currentPlatform.name,
      `eliza-backend${currentPlatform.ext}`
    );

    const buildCommand = [
      'bun',
      'build',
      serverSourcePath,
      '--compile',
      '--target',
      currentPlatform.bunTarget,
      '--outfile',
      outputPath,
    ].join(' ');

    console.log(`🔧 Running: ${buildCommand}`);

    try {
      execSync(buildCommand, {
        cwd: path.resolve(projectRoot, '../../packages/agentserver'),
        stdio: 'inherit',
      });

      // Make executable on Unix systems
      if (currentPlatform.ext === '') {
        fs.chmodSync(outputPath, '755');
      }

      console.log(`✅ Binary compiled: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`❌ Failed to compile binary for ${currentPlatform.name}:`, error.message);
      throw error;
    }
  }
}

// CLI interface
const builder = new BackendBinaryBuilder();

if (process.argv.includes('--current-platform')) {
  builder.buildForCurrentPlatform();
} else {
  builder.build();
}

export { BackendBinaryBuilder };
