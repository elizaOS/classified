#!/usr/bin/env bun

// Production build script with logger polyfills for containerized deployment
import { $ } from 'bun';

const polyfill = `
// Comprehensive polyfill for pino-pretty issues in compiled Bun
if (typeof global !== 'undefined') {
  global.process = global.process || {};
  global.process.env = global.process.env || {};
  global.process.env.NODE_ENV = 'production';
  global.process.env.LOG_LEVEL = 'info';
  
  // Override module resolution for pino-pretty
  const originalRequire = global.require;
  if (typeof originalRequire !== 'undefined') {
    global.require = function(id) {
      if (id === 'pino-pretty') {
        // Return a stub function instead of trying to load pino-pretty
        return function() { return process.stdout; };
      }
      return originalRequire.apply(this, arguments);
    };
  }
  
  // Override import resolution as well
  const originalImport = global.import;
  if (typeof originalImport !== 'undefined') {
    global.import = function(id) {
      if (id === 'pino-pretty') {
        return Promise.resolve({ default: function() { return process.stdout; } });
      }
      return originalImport.apply(this, arguments);
    };
  }
}
`;

try {
  console.log('Building production server with logger polyfills...');

  await $`bun build --compile --target=bun-linux-arm64-baseline --banner:js=${polyfill} ./server.ts --outfile server-linux-arm64-baseline`;

  console.log('✅ Production build completed successfully!');
  console.log('Binary size:', (await Bun.file('server-linux-arm64-baseline').size()) / 1024 / 1024, 'MB');

} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
