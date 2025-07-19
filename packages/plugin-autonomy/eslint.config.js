import pluginConfig from '../core/configs/eslint/eslint.config.plugin.js';

/**
 * ESLint configuration for @elizaos/plugin-autonomy
 * Uses the standardized plugin configuration from core/configs
 */
export default [
  ...pluginConfig,
  {
    // Autonomy plugin specific overrides
    files: ['**/*.{js,ts,tsx}'],
    rules: {
      // Autonomous agents need operational flexibility
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
    },
  },
];
