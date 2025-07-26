#!/usr/bin/env bun
// Unified build script for ElizaOS Agent Server
// Builds everything: backend, Linux binary, and Podman image
//
// Environment variables:
// - CLEAN_CACHE=true  : Remove existing images and containers before build
// - NO_CACHE=true     : Disable Podman build cache (--no-cache flag)
//
// Examples:
//   bun build-all.js                       # Normal build (uses cache)
//   CLEAN_CACHE=true bun build-all.js      # Clean existing images first
//   NO_CACHE=true bun build-all.js         # Force rebuild layers
//   CLEAN_CACHE=true NO_CACHE=true bun build-all.js  # Full clean rebuild

import { $ } from 'bun';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanContainerCache() {
  console.log('🧹 Cleaning container cache and removing old agent images...');
  
  try {
    // Check if podman is available
    try {
      await $`podman --version`.quiet();
    } catch {
      console.log('⚠️  Podman not available, skipping container cache cleanup');
      return;
    }

    // Remove existing agent container images to force fresh build
    const agentImages = [
      'eliza-agent-server:latest',
      'eliza-agent:latest',
      'eliza-agent-working:latest'
    ];

    for (const image of agentImages) {
      try {
        console.log(`🗑️  Removing existing image: ${image}`);
        await $`podman rmi ${image}`.quiet();
        console.log(`✅ Removed ${image}`);
      } catch (error) {
        // Image might not exist, which is fine
        console.log(`ℹ️  Image ${image} not found (this is ok)`);
      }
    }

    // Stop and remove any running agent containers
    const containerNames = ['eliza-agent', 'eliza-agent-server'];
    for (const name of containerNames) {
      try {
        console.log(`🛑 Stopping and removing container: ${name}`);
        await $`podman stop ${name}`.quiet();
        await $`podman rm ${name}`.quiet();
        console.log(`✅ Removed container ${name}`);
      } catch (error) {
        // Container might not exist, which is fine
        console.log(`ℹ️  Container ${name} not found (this is ok)`);
      }
    }

    // Clean dangling images and build cache
    try {
      console.log('🧹 Cleaning dangling images and build cache...');
      await $`podman image prune -f`.quiet();
      await $`podman system prune -f`.quiet();
      console.log('✅ Container cache cleaned');
    } catch (error) {
      console.warn('⚠️  Failed to clean build cache:', error.message);
    }

    console.log('✅ Container cache cleanup completed\n');
  } catch (error) {
    console.warn('⚠️  Container cache cleanup failed:', error.message);
    console.log('⚠️  Continuing with build process...\n');
  }
}

async function buildEverything() {
  console.log('🚀 ElizaOS Agent Server - Complete Build Process\n');

  try {
    // Step 0: Clean container cache and remove existing agent images
    // Only clean cache if explicitly requested via CLEAN_CACHE=true
    if (process.env.CLEAN_CACHE === 'true') {
      console.log('🧹 Step 0/4: Cleaning container cache and removing old agent images...');
      await cleanContainerCache();
    } else {
      console.log('💨 Skipping cache cleanup (use CLEAN_CACHE=true to force cleanup)\n');
    }

    // Step 1: Build the backend
    console.log('📦 Step 1/4: Building backend...');
    await $`bun ${path.join(__dirname, 'build.js')}`;

    // Verify backend build
    const backendPath = path.join(__dirname, '..', 'dist-backend', 'server.js');
    if (!existsSync(backendPath)) {
      throw new Error('Backend build failed - server.js not found');
    }
    console.log('✅ Backend built successfully\n');

    // Step 2: Build Linux binary
    console.log('🔨 Step 2/4: Building Linux binary...');

    // Create output directory
    const binariesDir = path.join(__dirname, '..', 'dist-binaries');
    await $`mkdir -p ${binariesDir}`;

    const backendFile = backendPath;
    
    // Build both Linux architectures for containers
    const targets = [
      { target: 'bun-linux-x64', output: path.join(binariesDir, 'server-linux-amd64') },
      { target: 'bun-linux-arm64', output: path.join(binariesDir, 'server-linux-arm64') }
    ];

    for (const { target, output } of targets) {
      try {
        console.log(`📦 Cross-compiling for ${target}...`);
        await $`bun build --compile --target=${target} ${backendFile} --outfile ${output}`;
        await $`chmod +x ${output}`;
        console.log(`✅ Built ${target} successfully`);
      } catch (error) {
        console.warn(`⚠️  Failed to build ${target}: ${error.message}`);
        // Continue with other targets even if one fails
      }
    }

    // Verify at least one binary was created
    const primaryBinary = path.join(binariesDir, 'server-linux-amd64');
    if (!existsSync(primaryBinary)) {
      throw new Error('Binary compilation failed - no usable Linux binary created');
    }

    const stats = await $`ls -lh ${binariesDir}/server-linux-*`.text();
    console.log(`✅ Linux binaries created:\n${stats.trim()}\n`);

    // Step 3: Build Podman image
    console.log('🐳 Step 3/4: Building Podman image...');

    // Verify podman is available
    try {
      await $`podman --version`.quiet();
    } catch {
      throw new Error('Podman not found. Please install Podman.');
    }

    // Build the image for the native platform architecture
    const imageName = 'eliza-agent-server:latest';
    
    // Build for native architecture to avoid Rosetta issues
    const arch = process.arch;
    const platform = arch === 'arm64' ? 'linux/arm64' : 'linux/amd64';
    
    // Allow disabling cache for production builds
    const noCache = process.env.NO_CACHE === 'true';
    const cacheFlag = noCache ? '--no-cache' : '';
    const cacheMsg = noCache ? ' (no cache)' : ' (with cache)';
    
    console.log(`📦 Building container for platform: ${platform}${cacheMsg}`);
    const dockerfileDir = path.join(__dirname, '..');
    await $`cd ${dockerfileDir} && podman build ${cacheFlag} --platform ${platform} -t ${imageName} -f Dockerfile .`;

    // Tag for Rust compatibility
    await $`podman tag ${imageName} eliza-agent:latest`;

    console.log('✅ Podman image built successfully\n');

    // Show final summary
    console.log('🎉 Build completed successfully!\n');
    console.log('📋 Artifacts created:');
    console.log(`   - Backend: ${path.relative(process.cwd(), path.join(__dirname, '..', 'dist-backend', 'server.js'))}`);
    console.log(`   - Binaries: ${path.relative(process.cwd(), path.join(__dirname, '..', 'dist-binaries'))}/server-linux-amd64, server-linux-arm64`);
    console.log('   - Image:   eliza-agent-server:latest');
    console.log('\n🚀 The Rust container manager can now start the agent using:');
    console.log('   podman run -p 7777:7777 eliza-agent-server:latest');

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run the complete build
if (import.meta.main) {
  await buildEverything();
}

// Export functions for use by other scripts
export { cleanContainerCache, buildEverything };
