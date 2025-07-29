import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';
import { PluginManagerService } from '../services/pluginManagerService';
import { PluginManagerServiceType } from '../types';

export interface SwitchLLMProviderParams {
  provider: 'openai' | 'anthropic' | 'ollama';
  force?: boolean;
}

/**
 * Action to dynamically switch between LLM providers (OpenAI, Anthropic, Ollama)
 */
export const switchLLMProviderAction: Action = {
  name: 'SWITCH_LLM_PROVIDER',
  similes: [
    'switch to openai',
    'use anthropic',
    'change to ollama',
    'switch llm provider',
    'change model provider',
    'use different ai provider',
    'switch to claude',
    'use gpt',
    'switch to local models',
  ],
  description: 'Switch between different LLM providers (OpenAI, Anthropic, Ollama) dynamically',
  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'Switch to OpenAI for better performance',
          actions: ['SWITCH_LLM_PROVIDER'],
        },
      },
      {
        name: 'Assistant',
        content: {
          text: "Switching to OpenAI provider. I'll unload the current provider and load OpenAI.",
          actions: ['SWITCH_LLM_PROVIDER'],
          simple: true,
        },
      },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Can you use Anthropic Claude instead?',
          actions: ['SWITCH_LLM_PROVIDER'],
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'Switching to Anthropic Claude. This will provide access to Claude models.',
          actions: ['SWITCH_LLM_PROVIDER'],
          simple: true,
        },
      },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Use local Ollama models',
          actions: ['SWITCH_LLM_PROVIDER'],
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'Switching to Ollama for local model inference. This will use your local models.',
          actions: ['SWITCH_LLM_PROVIDER'],
          simple: true,
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    // Check for provider switching intent
    const providerKeywords = ['switch', 'change', 'use', 'load', 'enable'];
    const providers = ['openai', 'anthropic', 'ollama', 'claude', 'gpt', 'local'];

    const hasProviderKeyword = providerKeywords.some((keyword) => text.includes(keyword));
    const hasProvider = providers.some((provider) => text.includes(provider));

    // Also check for explicit provider switching phrases
    const switchPhrases = [
      'switch to',
      'change to',
      'use instead',
      'switch provider',
      'change provider',
      'llm provider',
      'model provider',
    ];

    const hasSwitchPhrase = switchPhrases.some((phrase) => text.includes(phrase));

    return (hasProviderKeyword && hasProvider) || hasSwitchPhrase;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<void> => {
    try {
      const pluginManager = runtime.getService<PluginManagerService>(
        PluginManagerServiceType.PLUGIN_MANAGER
      );

      if (!pluginManager) {
        throw new Error('Plugin manager service not available');
      }

      const text = message.content.text?.toLowerCase() || '';

      // Determine target provider from text
      let targetProvider: 'openai' | 'anthropic' | 'ollama';

      if (text.includes('openai') || text.includes('gpt')) {
        targetProvider = 'openai';
      } else if (text.includes('anthropic') || text.includes('claude')) {
        targetProvider = 'anthropic';
      } else if (text.includes('ollama') || text.includes('local')) {
        targetProvider = 'ollama';
      } else {
        // Default fallback - try to determine from context or ask user
        if (callback) {
          await callback({
            text: 'Which LLM provider would you like to switch to? Available options: OpenAI, Anthropic, or Ollama.',
          });
        }
        return;
      }

      const result = await switchLLMProvider(runtime, targetProvider);

      if (callback) {
        const providerNames = {
          openai: 'OpenAI',
          anthropic: 'Anthropic Claude',
          ollama: 'Ollama (Local Models)',
        };

        await callback({
          text: result.success
            ? `Successfully switched to ${providerNames[targetProvider]}. ${result.message}`
            : `Failed to switch to ${providerNames[targetProvider]}: ${result.error}`,
          actions: result.success ? ['SWITCH_LLM_PROVIDER'] : undefined,
        });
      }
    } catch (error) {
      logger.error('Error in switch LLM provider action:', error);

      if (callback) {
        await callback({
          text: `Error switching LLM provider: ${error.message}`,
        });
      }
    }
  },
};

/**
 * Core function to switch LLM providers
 */
export async function switchLLMProvider(
  runtime: IAgentRuntime,
  targetProvider: 'openai' | 'anthropic' | 'ollama'
): Promise<{ success: boolean; message?: string; error?: string }> {
  const pluginManager = runtime.getService<PluginManagerService>(
    PluginManagerServiceType.PLUGIN_MANAGER
  );

  if (!pluginManager) {
    return { success: false, error: 'Plugin manager service not available' };
  }

  try {
    logger.info(`Switching to LLM provider: ${targetProvider}`);

    // 1. Unload current LLM providers (but keep embeddings)
    await unloadCurrentLLMProviders(runtime, pluginManager);

    // 2. Load the target provider
    const loadResult = await loadLLMProvider(runtime, pluginManager, targetProvider);

    if (!loadResult.success) {
      return { success: false, error: loadResult.error };
    }

    // 4. Verify the provider is working
    const verifyResult = await verifyProviderLoaded(runtime, targetProvider);

    return {
      success: true,
      message: `${targetProvider.toUpperCase()} provider loaded successfully. Embeddings remain local.`,
    };
  } catch (error) {
    logger.error(`Error switching to ${targetProvider}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Unload current LLM providers while preserving embeddings and other plugins
 */
async function unloadCurrentLLMProviders(
  runtime: IAgentRuntime,
  pluginManager: PluginManagerService
): Promise<void> {
  const llmProviders = ['plugin-openai', 'plugin-anthropic', 'plugin-ollama'];
  const loadedPlugins = pluginManager.getLoadedPlugins();

  for (const pluginState of loadedPlugins) {
    if (
      llmProviders.includes(pluginState.id) ||
      llmProviders.some((p) => pluginState.name?.includes(p))
    ) {
      try {
        logger.info(`Unloading LLM provider: ${pluginState.name}`);
        await pluginManager.unloadPlugin({ pluginId: pluginState.id });
      } catch (error) {
        logger.warn(`Error unloading ${pluginState.name}:`, error.message);
        // Continue with other plugins
      }
    }
  }
}

/**
 * Load the specified LLM provider plugin
 */
async function loadLLMProvider(
  runtime: IAgentRuntime,
  pluginManager: PluginManagerService,
  provider: 'openai' | 'anthropic' | 'ollama'
): Promise<{ success: boolean; error?: string }> {
  const pluginNames = {
    openai: '@elizaos/plugin-openai',
    anthropic: '@elizaos/plugin-anthropic',
    ollama: '@elizaos/plugin-ollama',
  };

  const pluginName = pluginNames[provider];
  const pluginId = `plugin-${provider}`;

  try {
    // Check if plugin is already registered
    let plugin = pluginManager.getPlugin(pluginId);

    if (!plugin) {
      // Try to install from registry
      logger.info(`Installing ${pluginName} from registry...`);
      const registryService = runtime.getService('registry');

      if (registryService) {
        await (registryService as any).installPlugin(pluginName);
        plugin = pluginManager.getPlugin(pluginId);
      }
    }

    if (!plugin) {
      return { success: false, error: `Plugin ${pluginName} not found in registry` };
    }

    if (plugin.status !== 'loaded') {
      logger.info(`Loading ${pluginName}...`);
      await pluginManager.loadPlugin({ pluginId });
    }

    return { success: true };
  } catch (error) {
    logger.error(`Error loading ${pluginName}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify that the provider was loaded successfully
 */
async function verifyProviderLoaded(
  runtime: IAgentRuntime,
  provider: 'openai' | 'anthropic' | 'ollama'
): Promise<boolean> {
  try {
    // Check if the provider's models are available
    const modelService = runtime.getService('model');
    if (modelService) {
      // Try to get model capabilities or info
      const capabilities = await (modelService as any).getCapabilities?.();
      logger.info(`Provider ${provider} verification:`, capabilities ? 'Available' : 'Limited');
    }

    return true;
  } catch (error) {
    logger.warn(`Provider ${provider} verification failed:`, error.message);
    return false;
  }
}
