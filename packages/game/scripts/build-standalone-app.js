#!/usr/bin/env node
/**
 * Build Standalone ELIZA App
 *
 * This script creates a complete standalone Tauri application with:
 * - Bundled container runtime (Podman)
 * - Pre-built container images (PostgreSQL, Ollama)
 * - Node.js backend bundle
 * - React frontend build
 * - All resources for offline operation
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');

class StandaloneAppBuilder {
  constructor() {
    this.buildSteps = [
      { name: 'Clean Build Directory', fn: this.cleanBuild },
      { name: 'Build Frontend', fn: this.buildFrontend },
      { name: 'Build Backend', fn: this.buildBackend },
      { name: 'Bundle Container Runtime', fn: this.bundleContainerRuntime },
      { name: 'Build Container Images', fn: this.buildContainerImages },
      { name: 'Prepare Tauri Resources', fn: this.prepareTauriResources },
      { name: 'Build Tauri Application', fn: this.buildTauriApp },
      { name: 'Verify Build', fn: this.verifyBuild },
    ];
  }

  async build() {
    console.log('🚀 Building Standalone ELIZA Application');
    console.log('='.repeat(60));
    console.log('This will create a complete offline-capable desktop app');
    console.log('');

    const startTime = Date.now();
    let currentStep = 0;

    try {
      for (const step of this.buildSteps) {
        currentStep++;
        console.log(`\n📦 Step ${currentStep}/${this.buildSteps.length}: ${step.name}`);
        console.log('-'.repeat(40));

        await step.fn.call(this);
        console.log(`✅ ${step.name} completed`);
      }

      const buildTime = Math.round((Date.now() - startTime) / 1000);

      console.log('\n🎉 ELIZA Standalone App Build Complete!');
      console.log('='.repeat(60));
      console.log(`⏱️  Total build time: ${buildTime}s`);
      console.log('📦 Build artifacts:');
      console.log('   • Frontend: dist/');
      console.log('   • Backend: dist-backend/');
      console.log('   • Container Runtime: src-tauri/resources/bin/');
      console.log('   • Container Images: src-tauri/resources/container-images/');
      console.log('   • Tauri App: src-tauri/target/release/bundle/');
      console.log('');
      console.log('✨ The app is now ready for distribution!');
      console.log('🎮 Users can run ELIZA with a single click');
    } catch (error) {
      console.error(
        `\n❌ Build failed at step ${currentStep}: ${this.buildSteps[currentStep - 1]?.name}`
      );
      console.error(error.message);
      console.error('\n🔧 Build troubleshooting:');
      console.error('   1. Ensure all dependencies are installed (npm install)');
      console.error('   2. Verify Podman/Docker is available for container builds');
      console.error('   3. Check Node.js and Rust toolchain versions');
      console.error('   4. Ensure sufficient disk space (2GB+ required)');
      process.exit(1);
    }
  }

  async cleanBuild() {
    console.log('🧹 Cleaning previous build artifacts...');

    const dirsToClean = [
      path.join(PROJECT_ROOT, 'dist'),
      path.join(PROJECT_ROOT, 'dist-backend'),
      path.join(PROJECT_ROOT, 'src-tauri', 'resources'),
      path.join(PROJECT_ROOT, 'src-tauri', 'target'),
    ];

    for (const dir of dirsToClean) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        console.log(`   Cleaned: ${path.relative(PROJECT_ROOT, dir)}`);
      } catch (error) {
        // Directory might not exist, that's ok
      }
    }
  }

  async buildFrontend() {
    console.log('⚛️  Building React frontend...');

    try {
      execSync('npm run build:frontend', {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });

      // Verify frontend build
      const distDir = path.join(PROJECT_ROOT, 'dist');
      const indexPath = path.join(distDir, 'index.html');

      await fs.access(indexPath);
      console.log('   Frontend build verified: index.html exists');
    } catch (error) {
      throw new Error(`Frontend build failed: ${error.message}`);
    }
  }

  async buildBackend() {
    console.log('🖥️  Building Node.js backend...');

    try {
      execSync('npm run build:backend', {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });

      // Verify backend build
      const backendDir = path.join(PROJECT_ROOT, 'dist-backend');
      const serverPath = path.join(backendDir, 'server.js');

      await fs.access(serverPath);
      console.log('   Backend build verified: server.js exists');
    } catch (error) {
      throw new Error(`Backend build failed: ${error.message}`);
    }
  }

  async bundleContainerRuntime() {
    console.log('📦 Bundling container runtime...');

    try {
      // Check if we should build for all platforms or just current
      const buildAllPlatforms = process.argv.includes('--all-platforms');

      if (buildAllPlatforms) {
        console.log('   Building for all platforms...');
        execSync('npm run bundle:container-runtime:all', {
          cwd: PROJECT_ROOT,
          stdio: 'inherit',
        });
      } else {
        console.log('   Building for current platform...');
        execSync('npm run bundle:container-runtime', {
          cwd: PROJECT_ROOT,
          stdio: 'inherit',
        });
      }

      // Verify bundled runtime
      const binDir = path.join(PROJECT_ROOT, 'src-tauri', 'resources', 'bin');
      await fs.access(binDir);

      const files = await fs.readdir(binDir);
      console.log(`   Container runtime bundled: ${files.length} files in bin/`);
    } catch (error) {
      console.warn('⚠️  Container runtime bundling failed, app will use system Podman');
      console.warn(`   Error: ${error.message}`);
      // Don't fail the build - system Podman is acceptable fallback
    }
  }

  async buildContainerImages() {
    console.log('🐳 Building container images...');

    try {
      // Check if we should build lightweight images
      const buildLightweight = process.argv.includes('--lightweight');

      if (buildLightweight) {
        console.log('   Building lightweight images (no pre-downloaded models)...');
        execSync('npm run build:container-images:lightweight', {
          cwd: PROJECT_ROOT,
          stdio: 'inherit',
        });
      } else {
        console.log('   Building full images with pre-downloaded AI models...');
        console.log('   ⚠️  This may take 10-30 minutes and use significant bandwidth');
        execSync('npm run build:container-images', {
          cwd: PROJECT_ROOT,
          stdio: 'inherit',
        });
      }

      // Verify container images
      const imagesDir = path.join(PROJECT_ROOT, 'src-tauri', 'resources', 'container-images');
      await fs.access(imagesDir);

      const images = await fs.readdir(imagesDir);
      const tarFiles = images.filter((f) => f.endsWith('.tar'));
      console.log(`   Container images built: ${tarFiles.length} image(s)`);

      // Check total size
      let totalSize = 0;
      for (const file of tarFiles) {
        const filePath = path.join(imagesDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      const sizeMB = Math.round(totalSize / 1024 / 1024);
      console.log(`   Total image size: ${sizeMB}MB`);

      if (sizeMB > 2000) {
        console.log('   ⚠️  Large image size may affect app distribution');
      }
    } catch (error) {
      console.warn('⚠️  Container image building failed, app will download images on first run');
      console.warn(`   Error: ${error.message}`);
      // Don't fail the build - images can be pulled at runtime
    }
  }

  async prepareTauriResources() {
    console.log('📁 Preparing Tauri resources...');

    const resourcesDir = path.join(PROJECT_ROOT, 'src-tauri', 'resources');

    // Ensure resources directory structure
    const dirs = [
      path.join(resourcesDir, 'bin'),
      path.join(resourcesDir, 'container-images'),
      path.join(resourcesDir, 'dist-backend'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Copy backend to resources (for Tauri bundling)
    const backendSrc = path.join(PROJECT_ROOT, 'dist-backend');
    const backendDst = path.join(resourcesDir, 'dist-backend');

    try {
      await fs.rm(backendDst, { recursive: true, force: true });
      await this.copyDirectory(backendSrc, backendDst);
      console.log('   Backend copied to Tauri resources');
    } catch (error) {
      throw new Error(`Failed to copy backend to resources: ${error.message}`);
    }

    // Create version info
    const packageJson = JSON.parse(
      await fs.readFile(path.join(PROJECT_ROOT, 'package.json'), 'utf8')
    );
    const versionInfo = {
      version: packageJson.version,
      buildTime: new Date().toISOString(),
      features: {
        containerRuntime: await this.checkResourceExists(path.join(resourcesDir, 'bin')),
        containerImages: await this.checkResourceExists(
          path.join(resourcesDir, 'container-images')
        ),
        backend: await this.checkResourceExists(path.join(resourcesDir, 'dist-backend')),
      },
    };

    await fs.writeFile(
      path.join(resourcesDir, 'build-info.json'),
      JSON.stringify(versionInfo, null, 2)
    );

    console.log(`   Build info created: v${versionInfo.version}`);
  }

  async buildTauriApp() {
    console.log('🦀 Building Tauri application...');

    try {
      // Check if this is a debug or release build
      const isDebug = process.argv.includes('--debug');
      const buildCommand = isDebug ? 'tauri:dev' : 'tauri:build';

      console.log(`   Running: npm run ${buildCommand}`);
      execSync(`npm run ${buildCommand}`, {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });

      // Find the built application
      const targetDir = path.join(PROJECT_ROOT, 'src-tauri', 'target');
      const releaseDir = isDebug ? path.join(targetDir, 'debug') : path.join(targetDir, 'release');

      await fs.access(releaseDir);
      console.log(`   Tauri build completed in: ${path.relative(PROJECT_ROOT, releaseDir)}`);
    } catch (error) {
      throw new Error(`Tauri build failed: ${error.message}`);
    }
  }

  async verifyBuild() {
    console.log('✅ Verifying build integrity...');

    const checks = [
      { name: 'Frontend dist', path: path.join(PROJECT_ROOT, 'dist', 'index.html') },
      { name: 'Backend build', path: path.join(PROJECT_ROOT, 'dist-backend', 'server.js') },
      { name: 'Tauri resources', path: path.join(PROJECT_ROOT, 'src-tauri', 'resources') },
      {
        name: 'Build info',
        path: path.join(PROJECT_ROOT, 'src-tauri', 'resources', 'build-info.json'),
      },
    ];

    let allGood = true;

    for (const check of checks) {
      try {
        await fs.access(check.path);
        console.log(`   ✅ ${check.name}: OK`);
      } catch (error) {
        console.log(`   ❌ ${check.name}: MISSING`);
        allGood = false;
      }
    }

    if (!allGood) {
      throw new Error('Build verification failed - some artifacts are missing');
    }

    // Read and display build info
    try {
      const buildInfoPath = path.join(PROJECT_ROOT, 'src-tauri', 'resources', 'build-info.json');
      const buildInfo = JSON.parse(await fs.readFile(buildInfoPath, 'utf8'));

      console.log('\n📋 Build Summary:');
      console.log(`   Version: ${buildInfo.version}`);
      console.log(`   Build Time: ${buildInfo.buildTime}`);
      console.log(
        `   Container Runtime: ${buildInfo.features.containerRuntime ? 'Bundled' : 'System'}`
      );
      console.log(
        `   Container Images: ${buildInfo.features.containerImages ? 'Bundled' : 'Online'}`
      );
      console.log(`   Backend: ${buildInfo.features.backend ? 'Bundled' : 'Missing'}`);
    } catch (error) {
      console.log('   ⚠️  Could not read build info');
    }
  }

  // Helper methods
  async copyDirectory(src, dst) {
    const entries = await fs.readdir(src, { withFileTypes: true });

    await fs.mkdir(dst, { recursive: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, dstPath);
      } else {
        await fs.copyFile(srcPath, dstPath);
      }
    }
  }

  async checkResourceExists(resourcePath) {
    try {
      await fs.access(resourcePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Command line interface
const builder = new StandaloneAppBuilder();

console.log('Options:');
console.log('  --all-platforms    Bundle container runtime for all platforms');
console.log('  --lightweight      Build lightweight container images (faster)');
console.log('  --debug           Build debug version instead of release');
console.log('');

builder.build().catch(console.error);
