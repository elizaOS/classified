import pluginConfig from '../core/configs/eslint/eslint.config.plugin.js';

export default [
  ...pluginConfig,
  {
    files: ['**/*.{js,ts,tsx}'],
    rules: {
      // Plugin-specific overrides
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];
