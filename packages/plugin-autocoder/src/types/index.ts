/**
 * Core types for Plugin Autocoder V2
 */

export interface PluginRequirements {
  name: string;
  description: string;
  capabilities: PluginCapabilities;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedDevelopmentTime: string;
}

export interface PluginCapabilities {
  actions: ActionCapability[];
  providers: ProviderCapability[];
  services: ServiceCapability[];
  evaluators: EvaluatorCapability[];
  apiIntegrations: APIIntegration[];
  envVars: EnvironmentVariable[];
}

export interface ActionCapability {
  name: string;
  description: string;
  triggers: string[];
}

export interface ProviderCapability {
  name: string;
  description: string;
  dataType: string;
  updateFrequency: 'on-demand' | 'periodic' | 'real-time';
}

export interface ServiceCapability {
  name: string;
  description: string;
  type: 'api-client' | 'database' | 'websocket' | 'background';
}

export interface EvaluatorCapability {
  name: string;
  description: string;
  trigger: 'always' | 'conditional';
  condition?: string;
}

export interface APIIntegration {
  name: string;
  baseUrl: string;
  requiresAuth: boolean;
  authType: 'api-key' | 'oauth' | 'bearer';
  endpoints: APIEndpoint[];
}

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
}

export interface EnvironmentVariable {
  name: string;
  description: string;
  required: boolean;
  sensitive: boolean;
}

export interface GeneratedPluginResult {
  name: string;
  path: string;
  files: GeneratedFile[];
  dependencies: string[];
  buildCommand: string;
  testCommand: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'typescript' | 'json' | 'markdown';
}

export interface BuildResult {
  success: boolean;
  errors: BuildError[];
  warnings: string[];
  outputs: string[];
}

export interface BuildError {
  file: string;
  line: number;
  column: number;
  message: string;
  type: 'typescript' | 'runtime' | 'test';
}

export class PluginCreationError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'PluginCreationError';
  }
}

// Service type constants for proper registration
export const PLUGIN_TEMPLATE_SERVICE = 'PLUGIN_TEMPLATE_SERVICE';
export const PLUGIN_BUILD_SERVICE = 'PLUGIN_BUILD_SERVICE';
export const PLUGIN_CREATION_ORCHESTRATOR = 'PLUGIN_CREATION_ORCHESTRATOR';
export const REGISTRY_INTEGRATION_SERVICE = 'REGISTRY_INTEGRATION_SERVICE';

export type AutocoderServiceType =
  | typeof PLUGIN_TEMPLATE_SERVICE
  | typeof PLUGIN_BUILD_SERVICE
  | typeof PLUGIN_CREATION_ORCHESTRATOR
  | typeof REGISTRY_INTEGRATION_SERVICE;
