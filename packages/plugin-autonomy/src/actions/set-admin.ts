import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  ActionExample,
  asUUID,
} from '@elizaos/core';

export const setAdminAction: Action = {
  name: 'SET_ADMIN_USER',
  similes: ['SET_ADMIN', 'CONFIGURE_ADMIN', 'ADMIN_SETUP'],
  description: 'Set the admin user ID for autonomous mode admin chat',

  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Set me as the admin user' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Setting you as the admin user for autonomous mode.',
          actions: ['SET_ADMIN_USER'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Configure admin user as 123e4567-e89b-12d3-a456-426614174000' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Setting admin user ID to 123e4567-e89b-12d3-a456-426614174000.',
          actions: ['SET_ADMIN_USER'],
        },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    const hasSetKeyword =
      text.includes('set') || text.includes('configure') || text.includes('make');
    const hasAdminKeyword = text.includes('admin');
    const hasUserKeyword = text.includes('user') || text.includes('me as');

    return hasSetKeyword && hasAdminKeyword && hasUserKeyword;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ) => {
    try {
      const text = message.content.text || '';
      let adminUserId: string | null = null;

      // Check if a specific UUID was provided in the message
      const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

      if (uuidMatch) {
        // Use the provided UUID
        adminUserId = uuidMatch[0];
      } else if (
        text.toLowerCase().includes('me as admin') ||
        text.toLowerCase().includes('set me as')
      ) {
        // Use the message sender as admin
        adminUserId = message.entityId;
      }

      if (!adminUserId) {
        if (callback) {
          await callback({
            text: 'Please specify either "set me as admin" or provide a user ID. You can find your user ID in browser dev tools under localStorage -> "elizaos-client-user-id".',
          });
        }
        return false;
      }

      // Validate it's a proper UUID
      try {
        asUUID(adminUserId);
      } catch (_error) {
        if (callback) {
          await callback({
            text: `Invalid user ID format: ${adminUserId}. Please provide a valid UUID.`,
          });
        }
        return false;
      }

      // Store the admin user ID (this would need to be persisted to character settings)
      // For now, we'll just store it in the runtime's temporary settings
      const currentSettings = runtime.character.settings || {};
      currentSettings.ADMIN_USER_ID = adminUserId;

      // Update character settings (this is a simplified approach)
      runtime.character.settings = currentSettings;

      let responseText = '';
      if (adminUserId === message.entityId) {
        responseText = `Set you (${adminUserId}) as the admin user for autonomous mode. I will now reference our conversation history when thinking autonomously.`;
      } else {
        responseText = `Set admin user ID to ${adminUserId}. I will reference this user's conversation history when thinking autonomously.`;
      }

      if (callback) {
        await callback({
          text: responseText,
          data: {
            adminUserId,
            isCurrentUser: adminUserId === message.entityId,
          },
        });
      }

      return true;
    } catch (error) {
      console.error('[SetAdmin] Error:', error);

      if (callback) {
        await callback({
          text: `Error setting admin user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }

      return false;
    }
  },
};
