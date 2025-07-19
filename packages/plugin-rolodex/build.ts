#!/usr/bin/env bun

/**
 * Build script using bun build
 * Replaces tsup with native bun build functionality
 */

import { $ } from 'bun';
import { buildConfig } from './build.config';
import { promises as fs } from 'fs';
import { join } from 'path';

async function build() {
  console.log('🏗️  Building package...');

  // Clean dist directory
  await $`rm -rf dist`;

  // Build with bun
  const result = await Bun.build(buildConfig);

  if (!result.success) {
    console.error('❌ Build failed:');
    for (const message of result.logs) {
      console.error(message);
    }
    process.exit(1);
  }

  console.log(`✅ Built ${result.outputs.length} files`);

  // Post-process the index.js to remove createRequire import and CommonJS polyfills
  console.log('🔧 Post-processing for ES module compatibility...');
  const indexPath = join(import.meta.dir, 'dist/index.js');
  let content = await fs.readFile(indexPath, 'utf-8');

  // Remove createRequire import
  content = content.replace(
    /import\s*{\s*createRequire\s*}\s*from\s*["']node:module["'];?\s*\n?/g,
    ''
  );

  // Keep CommonJS polyfills since the bundled code depends on them
  console.log('📝 Keeping CommonJS polyfills for bundled dependencies');

  // Remove createRequire usage
  content = content.replace(/const\s+require\s*=\s*createRequire\([^)]*\);?\s*\n?/g, '');
  content = content.replace(
    /var __require = \/\* @__PURE__ \*\/ createRequire\(import\.meta\.url\);?\s*\n?/g,
    ''
  );
  content = content.replace(
    /createRequire\(import\.meta\.url\)/g,
    '(() => { throw new Error("createRequire not available in browser"); })'
  );

  // Replace any remaining createRequire references
  content = content.replace(
    /createRequire/g,
    '(() => { throw new Error("createRequire not available in browser"); })'
  );

  await fs.writeFile(indexPath, content);
  console.log('✅ Removed CommonJS polyfills and Node.js specific imports');

  // Generate TypeScript declarations
  console.log('📝 Generating TypeScript declarations...');
  try {
    await $`tsc --project tsconfig.build.json`;
    console.log('✅ TypeScript declarations generated');
  } catch (error) {
    console.warn('⚠️ TypeScript declaration generation had issues, but continuing...');
  }

  console.log('✅ Build complete!');
}

build().catch(console.error);
