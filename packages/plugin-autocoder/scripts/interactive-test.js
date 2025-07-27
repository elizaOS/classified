#!/usr/bin/env node

// Simple script to run the interactive test
const { exec } = require('child_process');
const path = require('path');

const testPath = path.join(__dirname, '../src/interactive-test.ts');

console.log('🚀 Starting Interactive Claude Code Test...\n');

// Run the TypeScript file directly with bun
exec(`bun run ${testPath}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Error: ${error}`);
    return;
  }

  if (stderr) {
    console.error(`⚠️ Stderr: ${stderr}`);
  }

  console.log(stdout);
});
