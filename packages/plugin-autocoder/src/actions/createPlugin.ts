import { type Action, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import { PLUGIN_CREATION_ORCHESTRATOR, PluginCreationError } from '../types/index';
import type { PluginCreationOrchestrator } from '../services/PluginCreationOrchestrator';

/**
 * CREATE_PLUGIN Action - Main user interface for plugin creation
 */
export const createPluginAction: Action = {
  name: 'CREATE_PLUGIN',
  description: 'Create a new ElizaOS plugin from natural language description',
  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Create a weather plugin that gets current weather data from OpenWeatherMap API',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll create a weather plugin for you. Let me generate the code, set up the structure, and validate everything works correctly.",
          actions: ['CREATE_PLUGIN'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Build a todo plugin for task management',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll build a comprehensive todo plugin with task creation, management, and persistence capabilities.",
          actions: ['CREATE_PLUGIN'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Make a cryptocurrency price plugin using the Coinbase API',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll create a crypto price plugin that integrates with Coinbase API to fetch real-time cryptocurrency prices.",
          actions: ['CREATE_PLUGIN'],
        },
      },
    ],
  ],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase();
    if (!text) {
      return false;
    }

    // Check for plugin creation trigger phrases
    const triggers = ['create', 'build', 'make', 'generate'];

    const pluginKeywords = ['plugin', 'extension', 'module', 'component'];

    const hasTrigger = triggers.some((trigger) => text.includes(trigger));
    const hasPluginKeyword = pluginKeywords.some((keyword) => text.includes(keyword));

    return hasTrigger && hasPluginKeyword;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    options: any,
    callback?: any
  ) => {
    logger.info('[CREATE_PLUGIN] Starting plugin creation process...');

    const orchestrator = runtime.getService<PluginCreationOrchestrator>(
      PLUGIN_CREATION_ORCHESTRATOR
    );

    if (!orchestrator) {
      throw new PluginCreationError('Plugin creation service not available', 'missing-service');
    }

    // Extract description from message
    const description = message.content.text || '';

    if (!description.trim()) {
      throw new PluginCreationError('Plugin description is required', 'missing-description');
    }

    // Notify user that creation is starting
    if (callback) {
      await callback({
        text: `🚀 Starting plugin creation from your request: "${description}"\\n\\nThis may take a few minutes as I:\\n1. Parse your requirements\\n2. Generate code from templates\\n3. Build and validate the plugin\\n4. Test functionality\\n\\nPlease wait...`,
        actions: ['CREATE_PLUGIN'],
        source: message.content.source,
      });
    }

    // Create the plugin
    logger.info(`[CREATE_PLUGIN] Creating plugin from description: ${description}`);
    const pluginResult = await orchestrator.createPluginFromDescription(description);

    // Format success response
    const successMessage = `🎉 **Plugin Created Successfully!**

**Plugin Details:**
- **Name:** ${pluginResult.name}
- **Path:** ${pluginResult.path}
- **Files Generated:** ${pluginResult.files.length}
- **Dependencies:** ${pluginResult.dependencies.join(', ')}

**Generated Files:**
${pluginResult.files.map((file) => `- ${file.path} (${file.type})`).join('\\n')}

**Next Steps:**
1. Review the generated code at: \`${pluginResult.path}\`
2. Customize the implementation as needed
3. Test the plugin: \`${pluginResult.testCommand}\`
4. Build for production: \`${pluginResult.buildCommand}\`

The plugin is ready to use! 🎯`;

    // Send success callback
    if (callback) {
      await callback({
        text: successMessage,
        actions: ['CREATE_PLUGIN'],
        source: message.content.source,
      });
    }

    return {
      text: successMessage,
      success: true,
      data: {
        pluginName: pluginResult.name,
        pluginPath: pluginResult.path,
        filesCount: pluginResult.files.length,
        dependencies: pluginResult.dependencies,
      },
    };
  },
};

export default createPluginAction;
