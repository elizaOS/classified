import { type Plugin } from '@elizaos/core';
import { PluginManagerService } from './services/pluginManagerService';
import { PluginConfigurationService } from './services/pluginConfigurationService';
import { PluginUserInteractionService } from './services/pluginUserInteractionService';
import { RegistryService } from './services/registryService';
import { LLMProviderManagerService } from './services/llmProviderManagerService';
import { loadPluginAction } from './actions/loadPlugin';
import { unloadPluginAction } from './actions/unloadPlugin';
import { startPluginConfigurationAction } from './actions/startPluginConfiguration';
import { installPluginFromRegistryAction } from './actions/installPluginFromRegistry';
import { switchLLMProviderAction } from './actions/switchLLMProvider';
import { enhancedSearchPluginAction, getPluginDetailsAction } from './actions/searchPluginAction';
import { clonePluginAction } from './actions/clonePluginAction';
import { publishPluginAction } from './actions/publishPluginAction';
import { pluginStateProvider } from './providers/pluginStateProvider';
import { pluginConfigurationStatusProvider } from './providers/pluginConfigurationStatus';
import { registryPluginsProvider } from './providers/registryPluginsProvider';
import { pluginKnowledgeProvider } from './providers/pluginKnowledgeProvider';
import { llmProviderStatusProvider } from './providers/llmProviderStatusProvider';
import { pluginConfigurationEvaluator } from './evaluators/pluginConfigurationEvaluator';
import { llmProviderRoutes } from './routes/llmProviderRoutes';
import { pluginManagerScenariosSuite } from './__tests__/e2e/pluginManagerScenarios';
import './types'; // Ensure module augmentation is loaded
import { IAgentRuntime } from '@elizaos/core';

/**
 * Plugin Manager Plugin for ElizaOS
 *
 * Provides comprehensive plugin management capabilities including:
 * - Dynamic loading and unloading of plugins at runtime
 * - Plugin registry integration for discovering and installing plugins
 * - Secure configuration management with encrypted storage
 * - Interactive dialog system for collecting environment variables
 * - Proactive configuration suggestions and status monitoring
 *
 * Features:
 * - Registry-based plugin discovery and installation
 * - Dynamic plugin loading/unloading without restart
 * - Secure environment variable management with AES-256-CBC encryption
 * - Interactive user dialogs for plugin configuration
 * - Package.json convention for declaring required variables
 * - Validation and secure storage mechanisms
 * - Agent behavior integration for proactive configuration
 * - Complete testing and validation pipeline
 */
export const pluginManagerPlugin: Plugin = {
  name: 'plugin-manager',
  description:
    'Manages dynamic loading and unloading of plugins at runtime, including registry installation and configuration management',

  services: [
    PluginManagerService,
    PluginConfigurationService,
    PluginUserInteractionService,
    RegistryService,
    LLMProviderManagerService,
  ],

  actions: [
    loadPluginAction,
    unloadPluginAction,
    startPluginConfigurationAction,
    installPluginFromRegistryAction,
    enhancedSearchPluginAction,
    getPluginDetailsAction,
    clonePluginAction,
    publishPluginAction,
    switchLLMProviderAction,
  ],

  providers: [
    pluginStateProvider,
    pluginConfigurationStatusProvider,
    registryPluginsProvider,
    pluginKnowledgeProvider,
    llmProviderStatusProvider,
  ],

  evaluators: [pluginConfigurationEvaluator],

  routes: llmProviderRoutes,

  tests: [pluginManagerScenariosSuite],

  init: async (config: Record<string, any>, runtime: IAgentRuntime) => {
    // Any initialization logic if needed
  },
};

// Export services and types for external use
export { PluginManagerService } from './services/pluginManagerService';
export { LLMProviderManagerService } from './services/llmProviderManagerService';
export { switchLLMProvider } from './actions/switchLLMProvider';
export {
  searchPluginsByContent,
  clonePlugin,
  fetchPluginKnowledge,
  publishPlugin,
  type PluginSearchResult,
  type CloneResult,
  type PluginKnowledge,
  type PublishResult,
} from './services/pluginRegistryService';
export * from './types';
