#!/usr/bin/env node

/**
 * Build Client Integration Script
 * Builds the @elizaos/client package and copies it to platform's public directory
 */

import { execSync } from 'child_process';
import { copyFileSync, rmSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLATFORM_ROOT = join(__dirname, '..');
const CLIENT_ROOT = join(PLATFORM_ROOT, '..', 'client');
const CLIENT_DIST = join(CLIENT_ROOT, 'dist');
const PLATFORM_PUBLIC_CLIENT = join(PLATFORM_ROOT, 'public', 'client-static');

function logStep(message) {
  console.log(`\n🔧 ${message}`);
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message) {
  console.error(`❌ ${message}`);
}

function copyRecursive(src, dest) {
  try {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src);

    for (const entry of entries) {
      const srcPath = join(src, entry);
      const destPath = join(dest, entry);

      if (statSync(srcPath).isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  } catch (error) {
    throw new Error(`Failed to copy ${src} to ${dest}: ${error.message}`);
  }
}

async function buildClient() {
  try {
    logStep('Building @elizaos/client package...');

    // Try to build the client package
    try {
      execSync('bun run build', {
        cwd: CLIENT_ROOT,
        stdio: 'inherit',
      });
      logSuccess('Client package built successfully');
    } catch (buildError) {
      logError(`Build failed: ${buildError.message}`);

      // Check if there's an existing dist folder we can use
      try {
        if (statSync(CLIENT_DIST).isDirectory()) {
          logStep('Using existing client build...');
        } else {
          throw new Error('No existing client build found and build failed');
        }
      } catch {
        throw new Error('No existing client build found and build failed');
      }
    }

    logStep('Cleaning previous client static files...');

    // Clean existing client static files
    try {
      rmSync(PLATFORM_PUBLIC_CLIENT, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }

    logStep('Copying client build to platform public directory...');

    // Copy built client to platform public directory
    copyRecursive(CLIENT_DIST, PLATFORM_PUBLIC_CLIENT);

    logSuccess('Client build copied to platform');

    logStep('Verifying integration...');

    // Verify key files exist
    const requiredFiles = ['index.html', 'assets'];
    const missingFiles = requiredFiles.filter((file) => {
      try {
        statSync(join(PLATFORM_PUBLIC_CLIENT, file));
        return false;
      } catch {
        return true;
      }
    });

    if (missingFiles.length > 0) {
      throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
    }

    logSuccess('Client integration verified');
    logSuccess('🎉 Client build integration completed successfully!');
  } catch (error) {
    logError(`Client import failed: ${error.message}`);
    // process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildClient();
}

export { buildClient };
