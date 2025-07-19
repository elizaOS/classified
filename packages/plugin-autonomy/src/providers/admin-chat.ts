/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type State,
  asUUID,
  type UUID,
} from '@elizaos/core';

export const adminChatProvider: Provider = {
  name: 'ADMIN_CHAT',
  description: 'Provides recent 1:1 conversation history with the admin user',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    try {
      // Get the admin user ID from settings (could be set manually or detected)
      const adminUserId = runtime.getSetting('ADMIN_USER_ID') as string;

      // If no specific admin is configured, try to find the most active user
      if (!adminUserId) {
        // For now, return instructions on how to set up admin
        return {
          text: "No admin user configured. To set an admin user, add ADMIN_USER_ID to your character settings with the user's entity ID from the web interface.",
          data: {
            adminConfigured: false,
            instructions:
              'Open browser dev tools -> localStorage -> find "elizaos-client-user-id" key, copy the value and set it as ADMIN_USER_ID in character settings',
          },
        };
      }

      const adminUUID = asUUID(adminUserId);

      // The admin room would be the channel where the admin user and agent communicate
      // For web GUI users, this is typically the default channel they connect to
      // We'll search for messages from this admin user across all conversations

      // Try to find recent conversations with the admin user
      const adminMessages = await runtime.getMemories({
        entityId: adminUUID, // Messages from this specific admin
        count: 20, // Get last 20 messages
        unique: false,
        tableName: 'memories', // Default memories table
      });

      if (!adminMessages || adminMessages.length === 0) {
        return {
          text: `No recent messages found from admin user ${adminUserId}. Make sure this user has sent messages through the web interface.`,
          data: {
            adminConfigured: true,
            messageCount: 0,
            adminUserId,
            searchedEntityId: adminUUID,
          },
        };
      }

      // Format the conversation
      const formattedMessages = adminMessages
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .map((msg) => {
          const isFromAdmin = msg.entityId === adminUUID;
          const isFromAgent = msg.entityId === runtime.agentId;

          const sender = isFromAdmin ? 'Admin' : isFromAgent ? 'Agent' : 'Other';
          const text = msg.content.text || '[No text content]';

          return `${sender}: ${text}`;
        })
        .join('\\n');

      const recentCount = Math.min(adminMessages.length, 5);
      const summary = adminMessages
        .slice(-recentCount)
        .map((msg) => {
          const isFromAdmin = msg.entityId === adminUUID;
          const text = msg.content.text || '[No text]';
          return isFromAdmin ? `Admin: ${text}` : `Agent: ${text}`;
        })
        .join('\\n');

      return {
        text: `Recent messages from admin user ${adminUserId} (${adminMessages.length} messages):\\n\\n${formattedMessages}`,
        data: {
          adminConfigured: true,
          messageCount: adminMessages.length,
          adminUserId,
          searchedEntityId: adminUUID,
          recentSummary: summary,
          lastMessage: adminMessages[adminMessages.length - 1]?.content.text || '',
          lastMessageFrom:
            adminMessages[adminMessages.length - 1]?.entityId === adminUUID ? 'admin' : 'agent',
          rooms: [...new Set(adminMessages.map((m) => m.roomId))],
        },
      };
    } catch (error) {
      console.error('[AdminChat Provider] Error:', error);
      return {
        text: 'Error retrieving admin conversation',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          adminConfigured: false,
        },
      };
    }
  },
};
