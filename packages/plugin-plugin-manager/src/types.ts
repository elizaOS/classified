import type { Plugin, IAgentRuntime, UUID } from '@elizaos/core';

// Extend the core service types with plugin manager service
declare module '@elizaos/core' {
  interface ServiceTypeRegistry {
    PLUGIN_MANAGER: 'plugin_manager';
    PLUGIN_CONFIGURATION: 'plugin_configuration';
    PLUGIN_USER_INTERACTION: 'plugin_user_interaction';
    REGISTRY: 'registry';
    LLM_PROVIDER_MANAGER: 'llm_provider_manager';
  }
}

// Export service type constant
export const PluginManagerServiceType = {
  PLUGIN_MANAGER: 'plugin_manager' as const,
  PLUGIN_CONFIGURATION: 'plugin_configuration' as const,
  PLUGIN_USER_INTERACTION: 'plugin_user_interaction' as const,
  REGISTRY: 'registry' as const,
  LLM_PROVIDER_MANAGER: 'llm_provider_manager' as const,
} satisfies Partial<import('@elizaos/core').ServiceTypeRegistry>;

export enum PluginStatus {
  BUILDING = 'building',
  READY = 'ready',
  LOADED = 'loaded',
  ERROR = 'error',
  UNLOADED = 'unloaded',
  NEEDS_CONFIGURATION = 'needs_configuration',
  CONFIGURATION_IN_PROGRESS = 'configuration_in_progress',
}

// Configuration-related types
export interface PluginEnvironmentVariable {
  name: string;
  description: string;
  sensitive: boolean;
  required: boolean;
  defaultValue?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    enum?: string[];
  };
}

export interface PluginConfigurationRequest {
  pluginName: string;
  requiredVars: PluginEnvironmentVariable[];
  missingVars: string[];
  optionalVars: PluginEnvironmentVariable[];
}

export interface ConfigurationDialog {
  id: string;
  pluginName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  request: PluginConfigurationRequest;
  responses: Record<string, string>;
  currentVariable?: string;
  startedAt: Date;
  completedAt?: Date;
}

// Component tracking types
export interface PluginComponents {
  actions: Set<string>;
  providers: Set<string>;
  evaluators: Set<string>;
  services: Set<string>;
  eventHandlers: Map<string, Set<(params: any) => Promise<void>>>;
}

export interface ComponentRegistration {
  pluginId: string;
  componentType: 'action' | 'provider' | 'evaluator' | 'service' | 'eventHandler';
  componentName: string;
  timestamp: number;
}

export interface PluginState {
  id: string;
  name: string;
  status: PluginStatus;
  plugin?: Plugin;
  missingEnvVars: string[];
  buildLog: string[];
  sourceCode?: string;
  packageJson?: any;
  error?: string;
  createdAt: number;
  loadedAt?: number;
  unloadedAt?: number;
  version?: string;
  dependencies?: Record<string, string>;
  // Configuration-related fields
  configurationStatus?: 'unconfigured' | 'partial' | 'complete';
  requiredConfiguration?: PluginEnvironmentVariable[];
  configurationErrors?: string[];
  // Component tracking
  components?: PluginComponents;
}

export interface PluginRegistry {
  plugins: Map<string, PluginState>;
  getPlugin(id: string): PluginState | undefined;
  getAllPlugins(): PluginState[];
  getLoadedPlugins(): PluginState[];
  updatePluginState(id: string, update: Partial<PluginState>): void;
}

export interface CreatePluginParams {
  name: string;
  description: string;
  capabilities: string[];
  dependencies?: string[];
}

export interface LoadPluginParams {
  pluginId: string;
  force?: boolean;
}

export interface UnloadPluginParams {
  pluginId: string;
}

export interface PluginManagerConfig {
  maxBuildAttempts?: number;
  buildTimeout?: number;
  pluginDirectory?: string;
  enableHotReload?: boolean;
}

export interface InstallProgress {
  phase: 'downloading' | 'extracting' | 'installing' | 'validating' | 'complete';
  progress: number; // 0-100
  message: string;
}

export const EventType = {
  PLUGIN_BUILDING: 'PLUGIN_BUILDING',
  PLUGIN_READY: 'PLUGIN_READY',
  PLUGIN_LOADED: 'PLUGIN_LOADED',
  PLUGIN_UNLOADED: 'PLUGIN_UNLOADED',
  PLUGIN_ERROR: 'PLUGIN_ERROR',
  PLUGIN_ENV_MISSING: 'PLUGIN_ENV_MISSING',
  PLUGIN_CONFIGURATION_REQUIRED: 'PLUGIN_CONFIGURATION_REQUIRED',
  PLUGIN_CONFIGURATION_STARTED: 'PLUGIN_CONFIGURATION_STARTED',
  PLUGIN_CONFIGURATION_COMPLETED: 'PLUGIN_CONFIGURATION_COMPLETED',
} as const;
