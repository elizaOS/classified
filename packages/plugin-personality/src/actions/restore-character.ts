import type {
  Action,
  ActionResult,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from '@elizaos/core';
import { logger } from '@elizaos/core';
import type { CharacterFileManager } from '../services/character-file-manager.js';

/**
 * RESTORE_CHARACTER Action
 * Allows restoring character from backup files or modification history
 */
export const restoreCharacterAction: Action = {
  name: 'RESTORE_CHARACTER',
  similes: ['UNDO_CHANGES', 'ROLLBACK_CHARACTER', 'REVERT_MODIFICATIONS'],
  description:
    'Restore character from backup files or modification history with validation and logging. Supports action chaining by providing restoration metadata for audit trails, notification workflows, or rollback confirmation processes.',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    // Check if restoration is requested
    const messageText = message.content.text?.toLowerCase() || '';

    const restorationKeywords = [
      'restore',
      'revert',
      'rollback',
      'undo',
      'go back',
      'backup',
      'previous version',
    ];

    const hasRestorationRequest = restorationKeywords.some((keyword) =>
      messageText.includes(keyword)
    );

    // Check if file manager service is available
    const fileManager = runtime.getService('character-file-manager');

    return hasRestorationRequest && !!fileManager;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const fileManager = runtime.getService<CharacterFileManager>('character-file-manager');
      if (!fileManager) {
        await callback?.({
          text: "I don't have access to backup management right now.",
          thought: 'Character file manager service not available',
        });
        return {
          text: "I don't have access to backup management right now.",
          values: { success: false, error: 'service_unavailable' },
          data: { action: 'RESTORE_CHARACTER' },
        };
      }

      const messageText = message.content.text || '';

      // Check if user is requesting to see available backups
      if (
        messageText.toLowerCase().includes('list') ||
        messageText.toLowerCase().includes('show')
      ) {
        const backups = await fileManager.getAvailableBackups();

        if (backups.length === 0) {
          await callback?.({
            text: "I don't have any character backups available.",
            thought: 'No backups found',
          });
          return {
            text: "I don't have any character backups available.",
            values: { success: false, error: 'no_backups' },
            data: { action: 'RESTORE_CHARACTER' },
          };
        }

        const backupList = backups
          .slice(0, 5)
          .map((backup, index) => {
            const date = new Date(backup.timestamp).toLocaleString();
            const sizeKB = Math.round(backup.size / 1024);
            return `${index + 1}. ${date} (${sizeKB}KB)`;
          })
          .join('\\n');

        await callback?.({
          text: `I have ${backups.length} character backups available:\\n\\n${backupList}\\n\\nTo restore from a backup, tell me which one you'd like to use.`,
          thought: 'Listed available backups for user selection',
          actions: ['RESTORE_CHARACTER'],
        });

        return { text: 'Listed available backups' };
      }

      // Check if user specified a backup number
      const backupNumberMatch = messageText.match(/backup\s*(\d+)|(\d+)\s*backup|number\s*(\d+)/i);
      if (backupNumberMatch) {
        const backupIndex =
          parseInt(backupNumberMatch[1] || backupNumberMatch[2] || backupNumberMatch[3], 10) - 1;
        const backups = await fileManager.getAvailableBackups();

        if (backupIndex < 0 || backupIndex >= backups.length) {
          await callback?.({
            text: `I only have ${backups.length} backups available. Please choose a number between 1 and ${backups.length}.`,
            thought: 'Invalid backup index specified',
          });
          return { text: 'Invalid backup index' };
        }

        const selectedBackup = backups[backupIndex];
        const result = await fileManager.restoreFromBackup(selectedBackup.path);

        if (result.success) {
          const backupDate = new Date(selectedBackup.timestamp).toLocaleString();
          await callback?.({
            text: `I've successfully restored my character from the backup created on ${backupDate}. My personality and traits have been reverted to that previous state.`,
            thought: `Restored character from backup ${backupIndex + 1}`,
            actions: ['RESTORE_CHARACTER'],
          });

          // Log the restoration
          await runtime.createMemory(
            {
              entityId: runtime.agentId,
              roomId: message.roomId,
              content: {
                text: `Character restoration completed from backup ${backupIndex + 1}`,
                source: 'character_restoration',
              },
              metadata: {
                type: 'custom' as const,
                timestamp: Date.now(),
                backupIndex,
                backupPath: selectedBackup.path,
                requesterId: message.entityId,
              },
            },
            'character_modifications'
          );

          return { text: 'Character restored from backup successfully' };
        } else {
          await callback?.({
            text: `I couldn't restore from that backup: ${result.error}`,
            thought: `Restoration failed: ${result.error}`,
          });
          return { text: result.error || 'History restoration failed' };
        }
      }

      // Check if user wants to restore from recent history
      if (
        messageText.toLowerCase().includes('recent') ||
        messageText.toLowerCase().includes('last')
      ) {
        const history = await fileManager.getModificationHistory(10);

        if (history.length === 0) {
          await callback?.({
            text: "I don't have any recent modification history to restore from.",
            thought: 'No modification history available',
          });
          return { text: 'No history available' };
        }

        // Try to restore from the most recent entry
        const result = await fileManager.restoreFromHistory(0);

        if (result.success) {
          await callback?.({
            text: "I've restored my character to the previous state before the last modification.",
            thought: 'Restored from most recent history entry',
            actions: ['RESTORE_CHARACTER'],
          });
          return { text: 'Character restored from recent history' };
        } else {
          await callback?.({
            text: `I couldn't restore from recent history: ${result.error}`,
            thought: `History restoration failed: ${result.error}`,
          });
          return { text: result.error || 'History restoration failed' };
        }
      }

      // Default behavior - show restoration options
      const backups = await fileManager.getAvailableBackups();
      const hasBackups = backups.length > 0;
      const hasHistory = (await fileManager.getModificationHistory(1)).length > 0;

      let responseText = 'I can help you restore my character. Here are your options:\\n\\n';

      if (hasBackups) {
        responseText += "• Say 'list backups' to see all available backups\\n";
        responseText += "• Say 'restore backup 1' to restore from a specific backup\\n";
      }

      if (hasHistory) {
        responseText += "• Say 'restore recent' to undo the last modification\\n";
      }

      if (!hasBackups && !hasHistory) {
        responseText =
          "I don't have any backups or modification history available to restore from.";
      }

      await callback?.({
        text: responseText,
        thought: 'Provided restoration options to user',
        actions: ['RESTORE_CHARACTER'],
      });

      return { text: 'Restoration options provided' };
    } catch (error) {
      logger.error('Error in RESTORE_CHARACTER action', error);
      await callback?.({
        text: 'I encountered an error while trying to restore my character. Please try again.',
        thought: `Restoration error: ${(error as Error).message}`,
      });
      return { text: 'Restoration error' };
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'Can you restore your character from a backup?',
        },
      },
      {
        name: 'Agent',
        content: {
          text: 'I can help you restore my character. Here are your options:\\n\\n• Say "list backups" to see all available backups\\n• Say "restore backup 1" to restore from a specific backup\\n• Say "restore recent" to undo the last modification',
          thought: 'Provided restoration options to user',
          actions: ['RESTORE_CHARACTER'],
        },
      },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'List my character backups',
        },
      },
      {
        name: 'Agent',
        content: {
          text: "I have 3 character backups available:\\n\\n1. 12/21/2024, 3:45:30 PM (15KB)\\n2. 12/21/2024, 2:30:15 PM (14KB)\\n3. 12/21/2024, 1:15:45 PM (14KB)\\n\\nTo restore from a backup, tell me which one you'd like to use.",
          thought: 'Listed available backups for user selection',
          actions: ['RESTORE_CHARACTER'],
        },
      },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Restore backup 2',
        },
      },
      {
        name: 'Agent',
        content: {
          text: "I've successfully restored my character from the backup created on 12/21/2024, 2:30:15 PM. My personality and traits have been reverted to that previous state.",
          thought: 'Restored character from backup 2',
          actions: ['RESTORE_CHARACTER'],
        },
      },
    ],
  ],
};
