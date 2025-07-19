import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from '@elizaos/core';

export const storeSecretAction: Action = {
  name: 'STORE_SECRET',
  similes: ['SAVE_SECRET', 'SET_API_KEY', 'STORE_API_KEY', 'SAVE_CREDENTIAL'],
  description: 'Store API keys and secrets securely when provided by an admin',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';

    // Check if message is from admin (contains "Admin:" prefix)
    const isAdmin = text.includes('admin:');

    // Check if message contains API key patterns
    const hasApiKey = /_API_KEY=\w+/.test(message.content.text || '');

    // Check for keywords
    const keywords = ['api key', 'secret', 'credential', 'store', 'save'];
    const hasKeywords = keywords.some((kw) => text.includes(kw));

    return isAdmin && (hasApiKey || hasKeywords);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ) => {
    try {
      const text = message.content.text || '';

      // Extract API keys from the message
      const apiKeyPattern = /(\w+_API_KEY)=(\w+)/g;
      const matches = [...text.matchAll(apiKeyPattern)];

      if (matches.length === 0) {
        if (callback) {
          await callback({
            text: "I couldn't find any API keys in the correct format (KEY_NAME=value). Please provide them in the format: API_KEY_NAME=your_key_value",
            thought: 'No API keys found in the expected format',
          });
        }
        return;
      }

      const storedKeys: string[] = [];

      // Store each key securely
      for (const [, keyName, keyValue] of matches) {
        // In a real implementation, this would store in a secure vault
        // For this demo, we'll use the runtime's character settings
        (runtime as any).character.secrets = {
          ...(runtime as any).character.secrets,
          [keyName]: keyValue,
        };

        storedKeys.push(keyName);
        logger.info(`[storeSecretAction] Stored secret: ${keyName}`);
      }

      if (callback) {
        await callback({
          text: `I've securely stored ${storedKeys.length} API key${storedKeys.length > 1 ? 's' : ''}: ${storedKeys.join(', ')}. These will be used for authenticated API calls.`,
          thought: `Successfully stored secrets: ${storedKeys.join(', ')}`,
          actions: ['STORE_SECRET'],
        });
      }

      return {
        values: {
          storedKeys,
          count: storedKeys.length,
        },
        data: {
          keys: storedKeys,
        },
      };
    } catch (error) {
      logger.error('[storeSecretAction] Error storing secrets:', error);

      if (callback) {
        await callback({
          text: 'I encountered an error while storing the API keys. Please try again.',
          thought: 'Error in storeSecretAction handler',
        });
      }
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Admin: Store these API keys: WEATHER_API_KEY=abc123 and NEWS_API_KEY=xyz789',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I've securely stored 2 API keys: WEATHER_API_KEY, NEWS_API_KEY. These will be used for authenticated API calls.",
          thought: 'Admin provided API keys to store securely',
          actions: ['STORE_SECRET'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: { text: 'Admin: Here is the OPENAI_API_KEY=sk-1234567890' },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I've securely stored 1 API key: OPENAI_API_KEY. These will be used for authenticated API calls.",
          thought: 'Storing OpenAI API key provided by admin',
          actions: ['STORE_SECRET'],
        },
      },
    ],
  ],
};
