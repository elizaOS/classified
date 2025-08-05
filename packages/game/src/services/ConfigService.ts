/**
 * Configuration Service
 * Handles configuration management, validation, and provider operations
 * Extracted from the monolithic TauriService for better maintainability
 */

import { BaseTauriService } from './BaseTauriService';
import { ValidationResponse, TestConfigurationResponse } from '../types/shared';

export class ConfigService extends BaseTauriService {
  // Settings management
  public async getSettings(): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_settings');
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {};
    }
  }

  public async updateSettings(settings: Partial<any>): Promise<void> {
    return this.ensureInitializedAndInvoke('update_settings', { settings }) as Promise<void>;
  }

  // Configuration validation
  public async validateConfiguration(): Promise<ValidationResponse> {
    try {
      const response = await this.ensureInitializedAndInvoke('validate_configuration');
      return response as ValidationResponse;
    } catch (error) {
      console.error('Configuration validation failed:', error);
      return { valid: false, errors: [`Validation failed: ${error}`] };
    }
  }

  public async testConfiguration(): Promise<TestConfigurationResponse> {
    try {
      const response = await this.ensureInitializedAndInvoke('test_configuration');
      return response as TestConfigurationResponse;
    } catch (error) {
      console.error('Configuration test failed:', error);
      return { success: false, results: { error: `Test failed: ${error}` } };
    }
  }

  // Configuration persistence
  public async saveConfiguration(config: Record<string, unknown>): Promise<void> {
    return this.ensureInitializedAndInvoke('save_configuration', { config }) as Promise<void>;
  }

  public async loadConfiguration(): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('load_configuration');
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to load configuration:', error);
      return {};
    }
  }

  // Agent configuration
  public async getAgentConfiguration(): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_agent_configuration', {
        agentId: this.agentId,
      });
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to get agent configuration:', error);
      return {};
    }
  }

  public async updateAgentConfiguration(
    config: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('update_agent_configuration', {
        agentId: this.agentId,
        config,
      });
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to update agent configuration:', error);
      throw error;
    }
  }

  // Provider management
  public async getAvailableProviders(): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_available_providers');
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to get available providers:', error);
      return {};
    }
  }

  // Plugin configuration
  public async fetchPlugins(): Promise<Record<string, unknown>[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_plugins');
      if (Array.isArray(response)) {
        return response as Record<string, unknown>[];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch plugins:', error);
      return [];
    }
  }

  public async updatePluginConfig(
    pluginId: string,
    config: Record<string, unknown>
  ): Promise<void> {
    return this.ensureInitializedAndInvoke('update_plugin_config', {
      pluginName: pluginId,
      config,
    }) as Promise<void>;
  }

  public async togglePlugin(pluginId: string, enabled: boolean): Promise<void> {
    return this.ensureInitializedAndInvoke('toggle_plugin', {
      pluginId,
      enabled,
    }) as Promise<void>;
  }

  public async fetchPluginConfigs(): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_plugin_configs');
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to fetch plugin configs:', error);
      return {};
    }
  }
}

// Export singleton instance
export const configService = new ConfigService();
export default configService;
