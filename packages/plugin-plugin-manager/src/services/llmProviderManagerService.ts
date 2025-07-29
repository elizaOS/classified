import {
  Service,
  type IAgentRuntime,
  type ServiceTypeName,
  type Metadata,
  logger,
} from '@elizaos/core';
import { PluginManagerService } from './pluginManagerService';
import { PluginManagerServiceType } from '../types';

export interface LLMProviderInfo {
  id: string;
  name: string;
  package: string;
  status: 'available' | 'loaded' | 'error' | 'missing';
  isDefault?: boolean;
  priority: number;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  capabilities: string[];
}

export interface LLMProviderConfig extends Metadata {
  activeProvider: string | null;
  providers: Record<string, LLMProviderInfo>;
  embeddingProvider: string;
  loadOrder: string[];
}

/**
 * Service for managing LLM provider plugins with dynamic switching capabilities
 */
export class LLMProviderManagerService extends Service {
  static serviceType: ServiceTypeName = PluginManagerServiceType.LLM_PROVIDER_MANAGER;

  // Use public config to match Service base class
  config: LLMProviderConfig = {
    activeProvider: null,
    embeddingProvider: 'ollama',
    providers: {},
    loadOrder: [],
  };
  private pluginManager: PluginManagerService | null = null;

  // Required abstract property from Service base class
  capabilityDescription =
    'Manages dynamic LLM provider switching with priority-based loading and embedding provider management';

  constructor(runtime: IAgentRuntime) {
    super(runtime);

    // Initialize providers configuration
    this.config.providers = {
      ollama: {
        id: 'plugin-ollama',
        name: 'Ollama',
        package: '@elizaos/plugin-ollama',
        status: 'available',
        isDefault: true,
        priority: 100, // Highest priority for default
        requiredEnvVars: [],
        optionalEnvVars: ['OLLAMA_BASE_URL', 'OLLAMA_MODEL'],
        capabilities: ['text-generation', 'local-inference'],
      },
      openai: {
        id: 'plugin-openai',
        name: 'OpenAI',
        package: '@elizaos/plugin-openai',
        status: 'available',
        isDefault: false,
        priority: 80,
        requiredEnvVars: ['OPENAI_API_KEY'],
        optionalEnvVars: ['OPENAI_BASE_URL', 'OPENAI_SMALL_MODEL', 'OPENAI_LARGE_MODEL'],
        capabilities: ['text-generation', 'embeddings', 'vision', 'tts'],
      },
      anthropic: {
        id: 'plugin-anthropic',
        name: 'Anthropic',
        package: '@elizaos/plugin-anthropic',
        status: 'available',
        isDefault: false,
        priority: 70,
        requiredEnvVars: ['ANTHROPIC_API_KEY'],
        optionalEnvVars: ['ANTHROPIC_SMALL_MODEL', 'ANTHROPIC_LARGE_MODEL'],
        capabilities: ['text-generation', 'analysis'],
      },
    };

    this.config.loadOrder = ['plugin-ollama'];
  }

  static async start(runtime: IAgentRuntime): Promise<LLMProviderManagerService> {
    const instance = new LLMProviderManagerService(runtime);
    await instance.initialize();
    return instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Get plugin manager service
      this.pluginManager = this.runtime.getService<PluginManagerService>(
        PluginManagerServiceType.PLUGIN_MANAGER
      );

      if (!this.pluginManager) {
        logger.warn(
          'Plugin manager service not available - LLM provider management will be limited'
        );
        return;
      }

      // Initialize with local embeddings first, then default to Ollama
      await this.initializeDefaultProviders();

      logger.info('LLM Provider Manager Service initialized');
    } catch (error) {
      logger.error('Failed to initialize LLM Provider Manager Service:', error);
    }
  }

  /**
   * Initialize default providers in correct order
   */
  private async initializeDefaultProviders(): Promise<void> {
    try {
      // 1. Always load local embeddings first
      await this.ensureEmbeddingProvider();

      // 2. Load default LLM provider (Ollama)
      const defaultProvider = Object.values(this.config.providers).find((p) => p.isDefault);

      if (defaultProvider) {
        const result = await this.switchProvider(defaultProvider.id.replace('plugin-', ''));
        if (result.success) {
          logger.info(`Default LLM provider ${defaultProvider.name} loaded successfully`);
        } else {
          logger.warn(`Failed to load default LLM provider: ${result.error}`);
        }
      }
    } catch (error) {
      logger.error('Error initializing default providers:', error);
    }
  }

  /**
   * Ensure local embeddings provider is loaded with highest priority
   */
  private async ensureEmbeddingProvider(): Promise<void> {
    if (!this.pluginManager) return;

    const embeddingProvider = this.config.providers['local-embedding'];
    const plugin = this.pluginManager.getPlugin(embeddingProvider.id);

    if (!plugin || plugin.status !== 'loaded') {
      try {
        await this.loadProvider('local-embedding');
        logger.info('Local embeddings provider loaded');
      } catch (error) {
        logger.error('Failed to load local embeddings provider:', error);
      }
    }
  }

  /**
   * Switch to a different LLM provider
   */
  async switchProvider(
    providerKey: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.pluginManager) {
      return { success: false, error: 'Plugin manager not available' };
    }

    const provider = this.config.providers[providerKey];
    if (!provider) {
      return { success: false, error: `Unknown provider: ${providerKey}` };
    }

    try {
      // 1. Ensure embeddings provider stays loaded
      await this.ensureEmbeddingProvider();

      // 2. Unload current active LLM provider (but not embeddings)
      if (this.config.activeProvider && this.config.activeProvider !== provider.id) {
        await this.unloadProvider(this.config.activeProvider);
      }

      // 3. Load the new provider
      await this.loadProvider(providerKey);

      // 4. Update active provider
      this.config.activeProvider = provider.id;

      // 5. Update provider status
      this.updateProviderStatus();

      logger.info(`Successfully switched to LLM provider: ${provider.name}`);

      return {
        success: true,
        message: `Switched to ${provider.name}. Embeddings remain local.`,
      };
    } catch (error) {
      logger.error(`Error switching to provider ${providerKey}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load a specific provider
   */
  private async loadProvider(providerKey: string): Promise<void> {
    if (!this.pluginManager) {
      throw new Error('Plugin manager not available');
    }

    const provider = this.config.providers[providerKey];
    if (!provider) {
      throw new Error(`Provider ${providerKey} not found`);
    }

    let plugin = this.pluginManager.getPlugin(provider.id);

    // Try to install from registry if not found
    if (!plugin) {
      const registryService = this.runtime.getService('registry');
      if (registryService) {
        try {
          await (registryService as any).installPlugin(provider.package);
          plugin = this.pluginManager.getPlugin(provider.id);
        } catch (error) {
          logger.warn(`Could not install ${provider.package} from registry:`, error.message);
        }
      }
    }

    if (!plugin) {
      throw new Error(`Plugin ${provider.package} not available`);
    }

    // Load the plugin if not already loaded
    if (plugin.status !== 'loaded') {
      await this.pluginManager.loadPlugin({ pluginId: provider.id });
    }

    provider.status = 'loaded';
  }

  /**
   * Unload a provider (except embeddings)
   */
  private async unloadProvider(providerId: string): Promise<void> {
    if (!this.pluginManager) return;

    // Never unload embeddings provider
    if (providerId === this.config.embeddingProvider) {
      return;
    }

    try {
      await this.pluginManager.unloadPlugin({ pluginId: providerId });

      // Update provider status
      const provider = Object.values(this.config.providers).find((p) => p.id === providerId);
      if (provider) {
        provider.status = 'available';
      }
    } catch (error) {
      logger.warn(`Error unloading provider ${providerId}:`, error.message);
    }
  }

  /**
   * Update provider statuses based on current plugin manager state
   */
  private updateProviderStatus(): void {
    if (!this.pluginManager) return;

    const loadedPlugins = this.pluginManager.getLoadedPlugins();
    const loadedIds = new Set(loadedPlugins.map((p) => p.id));

    for (const provider of Object.values(this.config.providers)) {
      if (loadedIds.has(provider.id)) {
        provider.status = 'loaded';
      } else {
        const plugin = this.pluginManager.getPlugin(provider.id);
        if (plugin) {
          provider.status = plugin.status === 'error' ? 'error' : 'available';
        } else {
          provider.status = 'missing';
        }
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): LLMProviderConfig {
    this.updateProviderStatus();
    return { ...this.config };
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): LLMProviderInfo[] {
    this.updateProviderStatus();
    return Object.values(this.config.providers).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get current active provider
   */
  getActiveProvider(): LLMProviderInfo | null {
    if (!this.config.activeProvider) return null;

    return (
      Object.values(this.config.providers).find((p) => p.id === this.config.activeProvider) || null
    );
  }

  /**
   * Check if a provider has required environment variables
   */
  checkProviderEnvironment(providerKey: string): { valid: boolean; missing: string[] } {
    const provider = this.config.providers[providerKey];
    if (!provider) {
      return { valid: false, missing: [] };
    }

    const missing = provider.requiredEnvVars.filter((envVar) => {
      const value = this.runtime.getSetting(envVar);
      return !value || value.trim() === '';
    });

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  async stop(): Promise<void> {
    logger.info('LLM Provider Manager Service stopped');
  }
}
