#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json to get dependencies
const packageJson = JSON.parse(readFileSync(path.join(__dirname, '.', 'package.json'), 'utf-8'));

// All workspace dependencies should be bundled
// Removed unused 'external' variable - using hardcoded list in esbuild config instead

async function build() {
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, 'server.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: path.join(__dirname, '.', 'dist-backend', 'server.js'),
      external: [
        // Only externalize these specific problematic modules
        'canvas',
        '@napi-rs/canvas',
        '@napi-rs/canvas-darwin-arm64',
        '@napi-rs/canvas-linux-arm64',
        'bufferutil',
        'utf-8-validate',
        // PDF.js and canvas-related dependencies
        'pdfjs-dist',
        'dommatrix',
        'DOMMatrix',
        // TensorFlow and ML-related dependencies that are too large to bundle
        '@tensorflow/tfjs-node',
        '@tensorflow/tfjs',
        'tfjs_binding.node',
        'sharp',
        'opencv4nodejs',
        // Legacy pino-pretty (now using adze logger)
        'pino-pretty',
        // Playwright and its native dependencies
        'playwright',
        'playwright-core',
        'fsevents'
      ],
      sourcemap: true,
      minify: false,
      loader: {
        '.ts': 'ts',
        '.js': 'js',
      },
      resolveExtensions: ['.ts', '.js', '.json'],
      tsconfig: path.join(__dirname, '.', 'tsconfig.backend.json'),
      banner: {
        js: 'import { createRequire as __createRequire } from "module"; const require = __createRequire(import.meta.url);'
      }
    });

    console.log('Backend build complete!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
