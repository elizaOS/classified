#!/usr/bin/env node

/**
 * Comprehensive Clean Script
 * Removes all build artifacts, dependencies, and temporary files
 */

import { execSync } from 'child_process';
import { existsSync, rmSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (color, message) => console.log(`${color}${message}${colors.reset}`);
const success = (message) => log(colors.green, `✅ ${message}`);
const error = (message) => log(colors.red, `❌ ${message}`);
const warning = (message) => log(colors.yellow, `⚠️  ${message}`);
const info = (message) => log(colors.blue, `ℹ️  ${message}`);

// Directories and files to clean
const cleanTargets = [
  // Root level
  { path: 'dist', type: 'dir', description: 'Root dist directory' },
  { path: '.turbo', type: 'dir', description: 'Turbo cache' },
  { path: 'node_modules', type: 'dir', description: 'Root node_modules' },
  { path: '.turbo-tsconfig.json', type: 'file', description: 'Turbo TypeScript config' },
  { path: 'tsconfig.tsbuildinfo', type: 'file', description: 'TypeScript build info' },
  { path: 'bun.lockb', type: 'file', description: 'Bun lockfile' },
  { path: '.eliza', type: 'dir', description: 'Eliza cache directory' },
  { path: '.elizadb', type: 'dir', description: 'Eliza database directory' },
  
  // Build artifacts in packages
  { path: 'packages/*/dist', type: 'glob', description: 'Package dist directories' },
  { path: 'packages/*/dist-*', type: 'glob', description: 'Package build directories' },
  { path: 'packages/*/node_modules', type: 'glob', description: 'Package node_modules' },
  { path: 'packages/*/.turbo', type: 'glob', description: 'Package turbo cache' },
  { path: 'packages/*/tsconfig.tsbuildinfo', type: 'glob', description: 'Package TS build info' },
  
  // Specific to agentserver
  { path: 'packages/agentserver/data', type: 'dir', description: 'AgentServer data directory' },
  { path: 'packages/agentserver/backend.pid', type: 'file', description: 'Backend PID file' },
  { path: 'packages/agentserver/server-log*.txt', type: 'glob', description: 'Server log files' },
  
  // Specific to game
  { path: 'packages/game/src-tauri/target', type: 'dir', description: 'Rust build artifacts' },
  { path: 'packages/game/cypress/videos', type: 'dir', description: 'Cypress videos' },
  { path: 'packages/game/cypress/screenshots', type: 'dir', description: 'Cypress screenshots' },
  { path: 'packages/game/cypress/reports', type: 'dir', description: 'Cypress reports' },
  
  // Test artifacts
  { path: 'packages/*/coverage', type: 'glob', description: 'Test coverage reports' },
  { path: 'packages/*/.eslintcache', type: 'glob', description: 'ESLint cache files' },
];

function removeDirectory(dirPath) {
  try {
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
      return true;
    }
    return false;
  } catch (err) {
    error(`Failed to remove directory ${dirPath}: ${err.message}`);
    return false;
  }
}

function removeFile(filePath) {
  try {
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true });
      return true;
    }
    return false;
  } catch (err) {
    error(`Failed to remove file ${filePath}: ${err.message}`);
    return false;
  }
}

function expandGlob(pattern) {
  const parts = pattern.split('/');
  let currentDir = rootDir;
  let results = [currentDir];
  
  for (const part of parts) {
    if (part === '*') {
      // Expand wildcard
      const newResults = [];
      for (const dir of results) {
        if (existsSync(dir)) {
          try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
              const fullPath = join(dir, entry);
              if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
                newResults.push(fullPath);
              }
            }
          } catch (err) {
            // Skip directories we can't read
          }
        }
      }
      results = newResults;
    } else if (part.includes('*')) {
      // Handle glob patterns in filenames
      const newResults = [];
      for (const dir of results) {
        if (existsSync(dir)) {
          try {
            const entries = readdirSync(dir);
            const regex = new RegExp(part.replace(/\*/g, '.*'));
            for (const entry of entries) {
              if (regex.test(entry)) {
                newResults.push(join(dir, entry));
              }
            }
          } catch (err) {
            // Skip directories we can't read
          }
        }
      }
      results = newResults;
    } else {
      // Regular path component
      results = results.map(dir => join(dir, part));
    }
  }
  
  return results.filter(path => existsSync(path));
}

async function cleanAll() {
  console.log(`${colors.bold}${colors.cyan}ELIZA Comprehensive Clean${colors.reset}\n`);
  
  let totalCleaned = 0;
  let totalSize = 0;
  
  for (const target of cleanTargets) {
    let paths = [];
    
    if (target.type === 'glob') {
      paths = expandGlob(target.path);
    } else {
      const fullPath = resolve(rootDir, target.path);
      if (existsSync(fullPath)) {
        paths = [fullPath];
      }
    }
    
    if (paths.length === 0) {
      continue;
    }
    
    info(`Cleaning ${target.description}...`);
    
    for (const path of paths) {
      try {
        let size = 0;
        let removed = false;
        
        if (existsSync(path)) {
          // Calculate size before removal
          try {
            const stats = statSync(path);
            if (stats.isDirectory()) {
              // Estimate directory size (this is a rough approximation)
              try {
                const result = execSync(`du -sk "${path}" 2>/dev/null || echo "0"`, { encoding: 'utf8' });
                size = parseInt(result.split('\t')[0]) * 1024;
              } catch {
                size = 0;
              }
            } else {
              size = stats.size;
            }
          } catch {
            size = 0;
          }
          
          // Remove the path
          if (statSync(path).isDirectory()) {
            removed = removeDirectory(path);
          } else {
            removed = removeFile(path);
          }
          
          if (removed) {
            totalCleaned++;
            totalSize += size;
            const sizeStr = size > 1024 * 1024 
              ? `${(size / (1024 * 1024)).toFixed(1)}MB`
              : size > 1024 
                ? `${(size / 1024).toFixed(1)}KB`
                : `${size}B`;
            success(`Removed: ${path.replace(rootDir, '.')} (${sizeStr})`);
          }
        }
      } catch (err) {
        error(`Failed to clean ${path}: ${err.message}`);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  info(`Cleanup Summary:`);
  console.log(`Items cleaned: ${totalCleaned}`);
  const totalSizeStr = totalSize > 1024 * 1024 * 1024
    ? `${(totalSize / (1024 * 1024 * 1024)).toFixed(1)}GB`
    : totalSize > 1024 * 1024 
      ? `${(totalSize / (1024 * 1024)).toFixed(1)}MB`
      : totalSize > 1024 
        ? `${(totalSize / 1024).toFixed(1)}KB`
        : `${totalSize}B`;
  console.log(`Space freed: ${totalSizeStr}`);
  
  if (totalCleaned > 0) {
    success('🧹 Cleanup completed successfully!');
  } else {
    info('✨ No cleanup needed - already clean!');
  }
}

await cleanAll();