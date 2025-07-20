import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json to get dependencies
const packageJson = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

// All workspace dependencies should be bundled
const external = Object.keys(packageJson.dependencies || {})
  .filter(dep => !dep.startsWith('@elizaos/'))
  .concat(Object.keys(packageJson.devDependencies || {}))
  .filter(dep => !dep.startsWith('@elizaos/'));

async function build() {
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, 'server.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: path.join(__dirname, '..', 'dist-backend', 'server.js'),
      external: [
        ...external, 
        'canvas', 
        'bufferutil', 
        'utf-8-validate',
        'pino',
        'pino-pretty',
        // Node built-ins
        'node:*',
        'fs',
        'path',
        'crypto',
        'os',
        'stream',
        'util',
        'events',
        'http',
        'https',
        'net',
        'url',
        'querystring',
        'child_process',
        'cluster',
        'dgram',
        'dns',
        'readline',
        'repl',
        'tls',
        'vm',
        'zlib',
        'assert',
        'buffer',
        'console',
        'constants',
        'domain',
        'process',
        'punycode',
        'string_decoder',
        'timers',
        'tty',
        'v8',
        'worker_threads'
      ],
      sourcemap: true,
      minify: false,
      loader: {
        '.ts': 'ts',
        '.js': 'js',
      },
      resolveExtensions: ['.ts', '.js', '.json'],
      tsconfig: path.join(__dirname, '..', 'tsconfig.backend.json'),
      banner: {
        js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);'
      }
    });
    
    console.log('Backend build complete!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build(); 