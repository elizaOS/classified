#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');

console.log('🚀 Preparing plugin-vision for compilation...');

// Step 1: Create a wrapper for sharp that handles missing binaries gracefully
const sharpWrapperContent = `
// Sharp wrapper for graceful fallback
let sharp;
let sharpAvailable = false;

try {
  sharp = require('sharp');
  sharpAvailable = true;
  console.log('[SHARP] Sharp module loaded successfully');
} catch (error) {
  console.warn('[SHARP] Sharp module not available, image processing will be limited');
  console.warn('[SHARP] Error:', error.message);
  
  // Create a mock sharp object with no-op functions
  sharp = new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'available') return false;
      return () => {
        console.warn(\`[SHARP] Sharp method '\${prop}' called but sharp is not available\`);
        return Promise.reject(new Error('Sharp is not available'));
      };
    }
  });
}

// Add availability check
sharp.available = sharpAvailable;

module.exports = sharp;
`;

const sharpWrapperPath = join(packageRoot, 'src', 'utils', 'sharp-wrapper.js');
mkdirSync(dirname(sharpWrapperPath), { recursive: true });
writeFileSync(sharpWrapperPath, sharpWrapperContent);
console.log('✅ Created sharp wrapper');

// Step 2: Create a canvas wrapper
const canvasWrapperContent = `
// Canvas wrapper for graceful fallback
let canvasModule;
let canvasAvailable = false;

try {
  // Try @napi-rs/canvas first
  canvasModule = require('@napi-rs/canvas');
  canvasAvailable = true;
  console.log('[CANVAS] @napi-rs/canvas loaded successfully');
} catch (error1) {
  try {
    // Fallback to regular canvas
    canvasModule = require('canvas');
    canvasAvailable = true;
    console.log('[CANVAS] canvas module loaded successfully');
  } catch (error2) {
    console.warn('[CANVAS] No canvas module available');
    
    // Create mock canvas
    canvasModule = {
      createCanvas: (width, height) => {
        console.warn('[CANVAS] Using mock canvas');
        return {
          width,
          height,
          getContext: () => ({
            drawImage: () => {},
            fillRect: () => {},
            clearRect: () => {},
            save: () => {},
            restore: () => {},
            scale: () => {},
            translate: () => {},
            rotate: () => {},
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            font: '10px sans-serif'
          }),
          toBuffer: () => Promise.resolve(Buffer.from('')),
          toDataURL: () => 'data:image/png;base64,'
        };
      },
      loadImage: () => Promise.reject(new Error('Canvas not available')),
      Image: class MockImage {
        constructor() {
          this.width = 0;
          this.height = 0;
          this.src = '';
        }
      }
    };
  }
}

canvasModule.available = canvasAvailable;
module.exports = canvasModule;
`;

const canvasWrapperPath = join(packageRoot, 'src', 'utils', 'canvas-wrapper.js');
writeFileSync(canvasWrapperPath, canvasWrapperContent);
console.log('✅ Created canvas wrapper');

// Step 3: Update build configuration to handle native modules better
const updatedBuildConfig = `import type { BuildConfig } from 'bun';

// Main build configuration
export const buildConfig: BuildConfig = {
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  splitting: false,
  sourcemap: 'external',
  external: [
    // Node built-ins
    'fs',
    'path',
    'http',
    'https',
    'crypto',
    'child_process',
    'os',
    'util',
    'stream',
    'buffer',
    'events',
    'url',
    'node:fs',
    'node:path',
    'node:http',
    'node:https',
    'node:crypto',
    'node:child_process',
    'node:os',
    'node:util',
    'node:stream',
    'node:buffer',
    'node:events',
    'node:url',
    // Test framework
    'bun:test',
    // Core dependencies
    'dotenv',
    'zod',
    '@elizaos/core',
    '@elizaos/plugin-bootstrap',
    // Other dependencies
    'axios',
    // Native modules - DO NOT BUNDLE
    'sharp',
    'canvas',
    '@napi-rs/canvas',
    'face-api.js',
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  naming: '[dir]/[name].[ext]',
};

// Workers build configuration
export const workersConfig: BuildConfig = {
  entrypoints: [
    './src/workers/screen-capture-worker.ts',
    './src/workers/florence2-worker.ts',
    './src/workers/ocr-worker.ts',
  ],
  outdir: './dist/workers',
  target: 'node',
  format: 'cjs',
  splitting: false,
  sourcemap: true,
  external: [
    // All native modules must be external
    'sharp',
    'canvas',
    '@napi-rs/canvas',
    'face-api.js',
    '@tensorflow/tfjs-node',
    '@tensorflow-models/mobilenet',
    '@mapbox/node-pre-gyp',
    'mock-aws-s3',
    'aws-sdk',
    'nock',
  ],
  naming: '[name].[ext]',
};
`;

const buildConfigPath = join(packageRoot, 'build.config.ts');
writeFileSync(buildConfigPath, updatedBuildConfig);
console.log('✅ Updated build configuration');

// Step 4: Try to install platform-specific binaries
console.log('📦 Installing platform-specific dependencies...');
try {
  const platform = process.platform;
  const arch = process.arch;
  console.log(`Platform: ${platform}, Architecture: ${arch}`);

  // Install sharp with platform binaries
  execSync(`npm install --force --platform=${platform} --arch=${arch} sharp@0.34.3`, {
    cwd: packageRoot,
    stdio: 'inherit',
  });

  // Try to install canvas alternatives
  try {
    execSync(`npm install --force @napi-rs/canvas`, {
      cwd: packageRoot,
      stdio: 'inherit',
    });
  } catch (e) {
    console.warn('⚠️  @napi-rs/canvas installation failed, vision features may be limited');
  }
} catch (error) {
  console.warn('⚠️  Failed to install some native dependencies:', error.message);
}

console.log('✅ Preparation complete!');
console.log('');
console.log('📝 Next steps:');
console.log('1. Update your imports to use the wrappers:');
console.log('   - Replace: import sharp from "sharp"');
console.log('   - With:    import sharp from "./utils/sharp-wrapper"');
console.log('2. Run your build/compile command');
console.log('3. Native modules will gracefully fallback if not available');
