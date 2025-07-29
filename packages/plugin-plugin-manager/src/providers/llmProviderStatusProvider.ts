import { type Provider, type IAgentRuntime, type Memory, type State } from '@elizaos/core';
import { LLMProviderManagerService } from '../services/llmProviderManagerService';

/**
 * Provider that injects current LLM provider status into agent context
 */
export const llmProviderStatusProvider: Provider = {
  name: 'LLM_PROVIDER_STATUS',
  description:
    'Provides information about the current LLM provider configuration and available providers',

  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    try {
      const providerManager = runtime.getService<LLMProviderManagerService>('llm_provider_manager');

      if (!providerManager) {
        return {
          text: '[LLM PROVIDER STATUS]\nLLM Provider Manager not available\n[/LLM PROVIDER STATUS]',
          values: {
            llmProviderManagerAvailable: false,
          },
        };
      }

      const config = providerManager.getConfiguration();
      const activeProvider = providerManager.getActiveProvider();
      const availableProviders = providerManager.getAvailableProviders();

      // Check environment status for each provider
      const providerStatuses = availableProviders.map((provider) => {
        const envCheck = providerManager.checkProviderEnvironment(
          provider.id.replace('plugin-', '')
        );
        return {
          name: provider.name,
          id: provider.id.replace('plugin-', ''),
          status: provider.status,
          isActive: activeProvider?.id === provider.id,
          isDefault: provider.isDefault,
          environmentValid: envCheck.valid,
          missingEnvVars: envCheck.missing,
          capabilities: provider.capabilities,
        };
      });

      // Build status text
      const statusLines = [
        '[LLM PROVIDER STATUS]',
        activeProvider
          ? `Current Provider: ${activeProvider.name} (${activeProvider.id.replace('plugin-', '')})`
          : 'No active LLM provider',
        `Embedding Provider: Local Embeddings (${config.providers['local-embedding']?.status || 'unknown'})`,
        '',
        'Available Providers:',
      ];

      providerStatuses.forEach((provider) => {
        const status = provider.isActive
          ? '🟢 ACTIVE'
          : provider.status === 'loaded'
            ? '🟡 LOADED'
            : provider.status === 'error'
              ? '🔴 ERROR'
              : provider.environmentValid
                ? '⚪ READY'
                : '⚠️  MISSING_CONFIG';

        statusLines.push(`  ${status} ${provider.name} (${provider.id})`);

        if (!provider.environmentValid && provider.missingEnvVars.length > 0) {
          statusLines.push(`    Missing: ${provider.missingEnvVars.join(', ')}`);
        }

        if (provider.capabilities.length > 0) {
          statusLines.push(`    Capabilities: ${provider.capabilities.join(', ')}`);
        }
      });

      statusLines.push('[/LLM PROVIDER STATUS]');

      return {
        text: statusLines.join('\n'),
        values: {
          llmProviderManagerAvailable: true,
          activeProvider: activeProvider
            ? {
                id: activeProvider.id.replace('plugin-', ''),
                name: activeProvider.name,
                status: activeProvider.status,
              }
            : null,
          embeddingProvider: 'local-embedding',
          embeddingProviderStatus: config.providers['local-embedding']?.status || 'unknown',
          availableProviders: providerStatuses.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            isActive: p.isActive,
            environmentValid: p.environmentValid,
            capabilities: p.capabilities,
          })),
          canSwitchProviders: providerStatuses.some((p) => p.environmentValid && !p.isActive),
          totalProviders: providerStatuses.length,
          readyProviders: providerStatuses.filter((p) => p.environmentValid).length,
        },
      };
    } catch (error) {
      console.error('Error in LLM provider status provider:', error);

      return {
        text: '[LLM PROVIDER STATUS]\nError retrieving provider status\n[/LLM PROVIDER STATUS]',
        values: {
          llmProviderManagerAvailable: false,
          error: error.message,
        },
      };
    }
  },
};
