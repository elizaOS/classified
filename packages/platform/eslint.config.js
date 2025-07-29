import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

// Next.js 15 compatible flat config
const config = [
  // Ignore patterns first
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      'dist/**',
      '.turbo/**',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.ts',
      'cypress/**',
      '__tests__/**',
      'tests/**',
      'scripts/**',
    ],
  },

  // Use compat to extend Next.js config
  ...compat.config({
    extends: ['next/core-web-vitals'],
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      '@next/next/no-html-link-for-pages': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  }),
];

export default config;
