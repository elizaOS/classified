import type { Plugin, IAgentRuntime } from '@elizaos/core';
import { CodeGenerationService } from './services/CodeGenerationService';
import { SecretsManagerService } from './services/SecretsManagerService';
import { ProjectPlanningService } from './services/ProjectPlanningService';
import { generateCodeAction } from './actions/generate-code';
import { createProjectAction } from './actions/create-project';
import { projectsProvider } from './providers/projects-provider';
import { testSuites } from './__tests__/e2e';

// Export types
export * from './types';

// Export services
export {
  CodeGenerationService,
  type CodeGenerationRequest,
  type GenerationResult,
} from './services/CodeGenerationService';
export { ProjectPlanningService } from './services/ProjectPlanningService';
// SandboxBridge is deprecated - use E2B service directly
export { SecretsManagerService } from './services/SecretsManagerService';

// Export actions
export { generateCodeAction, createProjectAction };

// Export provider
export { projectsProvider };

/**
 * AutoCoder Plugin for ElizaOS
 *
 * Advanced code generation system using Claude Code in E2B sandboxes.
 * Supports creating plugins, agents, workflows, MCP servers, and full-stack apps.
 *
 * Features:
 * - Claude Code integration for intelligent code generation
 * - E2B sandboxed execution environments
 * - Multi-step project planning with forms
 * - Automated QA with linting, type checking, and testing
 * - GitHub repository creation and deployment
 * - API key and secrets management
 * - Real-time code generation with quality assurance
 */
export const autocoderPlugin: Plugin = {
  name: '@elizaos/plugin-autocoder',
  description:
    'Advanced code generation plugin using Claude Code in sandboxed environments. Automates complete project creation with quality assurance.',

  services: [CodeGenerationService, ProjectPlanningService, SecretsManagerService],
  actions: [generateCodeAction, createProjectAction],
  providers: [projectsProvider],

  // Dependencies - required for functionality
  dependencies: ['@elizaos/plugin-forms', '@elizaos/plugin-e2b', '@elizaos/plugin-github'],
  testDependencies: ['@elizaos/plugin-forms', '@elizaos/plugin-e2b'],

  // E2E Test Suites - Real runtime integration tests
  tests: testSuites,
};

// Default export
export default autocoderPlugin;
