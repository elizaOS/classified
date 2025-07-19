// Shell plugin -- give an agent shell access
import { type Plugin } from '@elizaos/core';
import {
  runShellCommandAction,
  clearShellHistoryAction,
  killAutonomousAction,
} from './action';
import { shellProvider } from './provider';
import { ShellService } from './service';
import './types'; // Ensure module augmentation is loaded

// Import e2e test suites
import shellBasicE2ETests from './tests/e2e/shell-basic';
import shellStatefulE2ETests from './tests/e2e/shell-stateful';
import shellAdvancedE2ETests from './tests/e2e/shell-advanced';
import shellSecurityE2ETests from './tests/e2e/shell-security';

export const shellPlugin: Plugin = {
  name: 'plugin-shell',
  description:
    'Provides shell access to the agent, allowing it to run commands and view history.',
  actions: [
    runShellCommandAction, // Has enabled: false property
    killAutonomousAction, // Has enabled: false property
    clearShellHistoryAction, // Has enabled: false property
  ],
  providers: [shellProvider],
  services: [ShellService],
  tests: [
    shellBasicE2ETests,
    shellStatefulE2ETests,
    shellAdvancedE2ETests,
    shellSecurityE2ETests,
  ],
  init: async (_config, _runtime) => {
    // You could add specific initialization logic here if needed
    // For example, checking for required system dependencies for the shell
    // or setting up initial CWD based on config.
    // Ensure the ShellService is registered if not done automatically by core.
    // However, with `services: [ShellService]`, the runtime should handle registration.
  },
};

export default shellPlugin;
