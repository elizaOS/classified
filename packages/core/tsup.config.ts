import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  clean: true,
  format: ['esm'],
  target: 'node18',
  dts: true,
  tsconfig: './tsconfig.build.json', // Use build-specific tsconfig
  ignoreWatch: ['**/__tests__/**', '**/test_resources/**'],
  external: [
    'dotenv',
    'fs',
    'path',
    'node:fs',
    'node:path',
    'node:crypto',
    'node:web',
    'node:stream',
    'node:buffer',
    'node:util',
    'node:events',
    'node:url',
    'node:http',
    'node:https',
    'http',
    'https',
    'sharp',
    '@solana/web3.js',
    'zod',
    '@hapi/shot',
  ],
  sourcemap: false,
});
