import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';
import { PluginConfigurationService } from '../services/pluginConfigurationService.ts';
import { PluginUserInteractionService } from '../services/pluginUserInteractionService.ts';
import { PluginManagerServiceType } from '../types.ts';

export const startPluginConfigurationAction: Action = {
  name: 'START_PLUGIN_CONFIGURATION',
  similes: [
    'configure plugin',
    'setup plugin',
    'plugin configuration',
    'setup environment variables',
    'configure environment',
    'plugin setup',
    'set up plugin',
  ],
  description:
    'Initiates configuration dialog for a plugin to collect required environment variables',
  examples: [],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    // Check if plugin configuration service is available
    const configService = runtime.getService(PluginManagerServiceType.PLUGIN_CONFIGURATION);
    if (!configService) {
      logger.warn('[startPluginConfiguration] PluginConfigurationService not available');
      return false;
    }

    // Check if interaction service is available
    const interactionService = runtime.getService(PluginManagerServiceType.PLUGIN_USER_INTERACTION);
    if (!interactionService) {
      logger.warn('[startPluginConfiguration] PluginUserInteractionService not available');
      return false;
    }

    const text = message.content?.text?.toLowerCase() || '';

    // Check for configuration-related keywords
    const configKeywords = [
      'configure',
      'setup',
      'config',
      'environment',
      'env var',
      'environment variable',
      'plugin config',
      'set up',
    ];

    return configKeywords.some((keyword) => text.includes(keyword));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ): Promise<void> => {
    logger.info('[startPluginConfiguration] Starting plugin configuration process');

    const configService = runtime.getService(
      PluginManagerServiceType.PLUGIN_CONFIGURATION
    ) as PluginConfigurationService;
    const interactionService = runtime.getService(
      PluginManagerServiceType.PLUGIN_USER_INTERACTION
    ) as PluginUserInteractionService;

    if (!configService || !interactionService) {
      if (callback) {
        await callback({
          text: '❌ Plugin configuration services are not available. Please check your setup.',
        });
      }
      return;
    }

    const text = message.content?.text?.toLowerCase() || '';

    // Extract plugin name from the message
    const pluginName = await extractPluginNameFromMessage(runtime, text);

    if (!pluginName) {
      if (callback) {
        await callback({
          text: '🔧 **Plugin Configuration**\n\nTo help you configure a plugin, I need to know which plugin you\'d like to set up. Could you please specify the plugin name?\n\nFor example: "configure the openai plugin" or "setup discord plugin"',
        });
      }
      return;
    }

    // Check if plugin exists and get its requirements
    const result = await configService.parsePluginRequirements(`./plugins/${pluginName}`);

    if (!result || result.requiredVars.length === 0) {
      if (callback) {
        await callback({
          text: `ℹ️ The plugin "${pluginName}" doesn't require any configuration, or I couldn't find it. Please check the plugin name and try again.`,
        });
      }
      return;
    }

    // Check current configuration status - find which variables are missing
    const currentConfig = await configService.getPluginConfiguration(pluginName);
    const missingVars = result.requiredVars
      .filter((varInfo) => !currentConfig[varInfo.name])
      .map((varInfo) => varInfo.name);

    if (missingVars.length === 0) {
      if (callback) {
        await callback({
          text: `✅ The plugin "${pluginName}" is already fully configured! All required environment variables are set.`,
        });
      }
      return;
    }

    // Create configuration request
    const configRequest = {
      pluginName,
      requiredVars: result.requiredVars,
      missingVars,
      optionalVars: result.optionalVars,
    };

    // Start the configuration dialog using agentId as a fallback for userId
    const dialog = await interactionService.initiateConfigurationDialog(
      configRequest,
      runtime.agentId
    );

    // Generate the first prompt
    const firstMissingVar = result.requiredVars.find((v) => missingVars.includes(v.name));
    if (!firstMissingVar) {
      if (callback) {
        await callback({
          text: `❌ Error: Could not find configuration details for required variables.`,
        });
      }
      return;
    }

    const firstPrompt = interactionService.generatePromptForVariable(firstMissingVar);

    if (callback) {
      await callback({
        text: `🎯 **Configuration Started**\n\nI'll help you configure the "${pluginName}" plugin step by step.\n\n**Progress**: 1 of ${missingVars.length} variables\n\n${firstPrompt}`,
      });
    }
  },
};

async function extractPluginNameFromMessage(
  runtime: IAgentRuntime,
  text: string
): Promise<string | null> {
  // First try simple extraction patterns
  const patterns = [
    /configure\s+(?:the\s+)?(\w+)\s+plugin/i,
    /setup\s+(?:the\s+)?(\w+)\s+plugin/i,
    /(\w+)\s+plugin\s+config/i,
    /set\s+up\s+(?:the\s+)?(\w+)\s+plugin/i,
    /configure\s+(\w+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  }

  // Try using AI to extract plugin name
  const prompt = `Extract the plugin name from this user message about plugin configuration: "${text}"

If the user mentions a specific plugin name, return just the plugin name (lowercase, no spaces).
If no specific plugin is mentioned, return "unknown".

Examples:
- "configure the openai plugin" → "openai"
- "setup discord plugin" → "discord"
- "I want to configure twitter" → "twitter"
- "setup plugin environment variables" → "unknown"

Plugin name:`;

  const result = await runtime.useModel('text', {
    prompt,
    temperature: 0.1,
    maxTokens: 50,
  });

  const extracted = result.trim().toLowerCase();
  if (extracted && extracted !== 'unknown' && extracted.length > 0 && extracted.length < 50) {
    return extracted;
  }

  return null;
}
