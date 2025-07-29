import { type Route } from '@elizaos/core';
import { LLMProviderManagerService } from '../services/llmProviderManagerService';

/**
 * API routes for managing LLM providers from frontend
 */
export const llmProviderRoutes: Route[] = [
  {
    type: 'GET',
    path: '/api/llm-providers',
    handler: async (req, res, runtime) => {
      try {
        const providerManager =
          runtime.getService<LLMProviderManagerService>('llm_provider_manager');

        if (!providerManager) {
          return res.status(503).json({
            success: false,
            error: 'LLM Provider Manager service not available',
          });
        }

        const config = providerManager.getConfiguration();
        const providers = providerManager.getAvailableProviders();
        const activeProvider = providerManager.getActiveProvider();

        res.json({
          success: true,
          data: {
            activeProvider: activeProvider?.id.replace('plugin-', '') || null,
            embeddingProvider: config.embeddingProvider,
            providers: providers.map((p) => ({
              id: p.id.replace('plugin-', ''),
              name: p.name,
              status: p.status,
              isDefault: p.isDefault,
              capabilities: p.capabilities,
              environment: providerManager.checkProviderEnvironment(p.id.replace('plugin-', '')),
            })),
          },
        });
      } catch (error) {
        console.error('Error getting LLM providers:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get LLM providers',
          details: error.message,
        });
      }
    },
  },

  {
    type: 'POST',
    path: '/api/llm-providers/switch',
    handler: async (req, res, runtime) => {
      try {
        const { provider } = req.body;

        if (!provider || typeof provider !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Provider parameter is required',
          });
        }

        const validProviders = ['openai', 'anthropic', 'ollama'];
        if (!validProviders.includes(provider)) {
          return res.status(400).json({
            success: false,
            error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
          });
        }

        const providerManager =
          runtime.getService<LLMProviderManagerService>('llm_provider_manager');

        if (!providerManager) {
          return res.status(503).json({
            success: false,
            error: 'LLM Provider Manager service not available',
          });
        }

        // Check environment variables before switching
        const envCheck = providerManager.checkProviderEnvironment(provider);
        if (!envCheck.valid) {
          return res.status(400).json({
            success: false,
            error: 'Missing required environment variables',
            missing: envCheck.missing,
          });
        }

        const result = await providerManager.switchProvider(provider);

        if (result.success) {
          res.json({
            success: true,
            message: result.message,
            activeProvider: provider,
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error,
          });
        }
      } catch (error) {
        console.error('Error switching LLM provider:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to switch LLM provider',
          details: error.message,
        });
      }
    },
  },

  {
    type: 'GET',
    path: '/api/llm-providers/status',
    handler: async (req, res, runtime) => {
      try {
        const providerManager =
          runtime.getService<LLMProviderManagerService>('llm_provider_manager');

        if (!providerManager) {
          return res.status(503).json({
            success: false,
            error: 'LLM Provider Manager service not available',
          });
        }

        const activeProvider = providerManager.getActiveProvider();
        const config = providerManager.getConfiguration();

        res.json({
          success: true,
          data: {
            activeProvider: activeProvider
              ? {
                  id: activeProvider.id.replace('plugin-', ''),
                  name: activeProvider.name,
                  status: activeProvider.status,
                  capabilities: activeProvider.capabilities,
                }
              : null,
            embeddingProvider: {
              id: config.embeddingProvider,
              status: config.providers['local-embedding']?.status || 'unknown',
            },
            switchCount: Object.values(config.providers).filter((p) => p.status === 'loaded')
              .length,
          },
        });
      } catch (error) {
        console.error('Error getting LLM provider status:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get LLM provider status',
          details: error.message,
        });
      }
    },
  },

  {
    type: 'POST',
    path: '/api/llm-providers/validate',
    handler: async (req, res, runtime) => {
      try {
        const { provider } = req.body;

        if (!provider || typeof provider !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Provider parameter is required',
          });
        }

        const providerManager =
          runtime.getService<LLMProviderManagerService>('llm_provider_manager');

        if (!providerManager) {
          return res.status(503).json({
            success: false,
            error: 'LLM Provider Manager service not available',
          });
        }

        const envCheck = providerManager.checkProviderEnvironment(provider);
        const config = providerManager.getConfiguration();
        const providerInfo = config.providers[provider];

        if (!providerInfo) {
          return res.status(404).json({
            success: false,
            error: 'Provider not found',
          });
        }

        res.json({
          success: true,
          data: {
            provider: provider,
            valid: envCheck.valid,
            missing: envCheck.missing,
            required: providerInfo.requiredEnvVars,
            optional: providerInfo.optionalEnvVars,
            status: providerInfo.status,
          },
        });
      } catch (error) {
        console.error('Error validating LLM provider:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to validate LLM provider',
          details: error.message,
        });
      }
    },
  },

  {
    type: 'GET',
    path: '/api/llm-providers/capabilities',
    handler: async (req, res, runtime) => {
      try {
        const providerManager =
          runtime.getService<LLMProviderManagerService>('llm_provider_manager');

        if (!providerManager) {
          return res.status(503).json({
            success: false,
            error: 'LLM Provider Manager service not available',
          });
        }

        const providers = providerManager.getAvailableProviders();
        const capabilities = providers.reduce(
          (acc, provider) => {
            acc[provider.id.replace('plugin-', '')] = {
              name: provider.name,
              capabilities: provider.capabilities,
              status: provider.status,
              isDefault: provider.isDefault,
            };
            return acc;
          },
          {} as Record<string, any>
        );

        res.json({
          success: true,
          data: capabilities,
        });
      } catch (error) {
        console.error('Error getting LLM provider capabilities:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get LLM provider capabilities',
          details: error.message,
        });
      }
    },
  },
];
