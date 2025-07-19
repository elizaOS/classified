import { logger, ModelType } from '@elizaos/core';

import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type ActionResult,
  type UUID,
} from '@elizaos/core';
import { RolodexService } from '../services';

const scheduleFollowUpTemplate = `# Schedule Follow-up

Current message: {{message}}
Sender: {{senderName}} (ID: {{senderId}})

## Instructions
Extract the follow-up scheduling information from the message:
1. Who to follow up with (name or entity reference)
2. When to follow up (date/time or relative time like "tomorrow", "next week")
3. Reason for the follow-up
4. Priority (high, medium, low)
5. Any specific message or notes

## Current Date/Time
{{currentDateTime}}

## Response Format
<response>
<contactName>Name of the contact to follow up with</contactName>
<entityId>ID if known, otherwise leave empty</entityId>
<scheduledAt>ISO datetime for the follow-up</scheduledAt>
<reason>Reason for the follow-up</reason>
<priority>high, medium, or low</priority>
<message>Optional message or notes for the follow-up</message>
</response>`;

export const scheduleFollowUpAction: Action = {
  name: 'SCHEDULE_FOLLOW_UP',
  description: 'Schedule a follow-up reminder for a contact',
  similes: [
    'follow up with',
    'remind me to contact',
    'schedule a check-in',
    'set a reminder for',
    'follow up on',
    'check back with',
    'reach out to',
    'schedule follow-up',
    'remind me about',
  ],
  examples: [
    [
      {
        name: 'User',
        content: { text: 'Remind me to follow up with John next week about the project' },
      },
      {
        name: 'Agent',
        content: { text: "I've scheduled a follow-up with John for next week about the project." },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'Schedule a follow-up with Sarah tomorrow at 2pm' },
      },
      {
        name: 'Agent',
        content: { text: "I've scheduled a follow-up with Sarah for tomorrow at 2:00 PM." },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'Follow up with the VIP client in 3 days' },
      },
      {
        name: 'Agent',
        content: { text: "I've scheduled a follow-up with the VIP client in 3 days." },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    // Check if service is available
    const rolodexService = runtime.getService<RolodexService>('rolodex');

    if (!rolodexService) {
      logger.debug('[ScheduleFollowUp] Rolodex service not available');
      return false;
    }

    // Use LLM to determine if this is a follow-up scheduling intent
    try {
      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        messages: [
          {
            role: 'system',
            content: `You are a follow-up intent detector. Respond with only "yes" or "no".
            
            Determine if the user wants to schedule a follow-up, reminder, or future task.
            
            Examples of follow-up intents:
            - "Remind me to call John next week"
            - "Schedule a follow-up with Sarah"
            - "Set a reminder to check on this project"
            - "Follow up with the client in 3 days"
            - "I need to remember to send that document"
            
            Answer only yes or no.`,
          },
          {
            role: 'user',
            content: message.content.text || '',
          },
        ],
      });

      return (response as string).toLowerCase().trim() === 'yes';
    } catch (error) {
      logger.error('[ScheduleFollowUp] Error validating follow-up intent:', error);
      return false;
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const rolodexService = runtime.getService<RolodexService>('rolodex');

    if (!rolodexService) {
      logger.error('[ScheduleFollowUp] Rolodex service not available');
      throw new Error('Rolodex service not available');
    }

    try {
      // Generate response asking for follow-up details
      const response = await runtime.useModel(ModelType.TEXT_LARGE, {
        messages: [
          {
            role: 'system',
            content: scheduleFollowUpTemplate,
          },
          {
            role: 'user',
            content: `Context: ${state?.text || message.content.text}
            
            Based on this conversation, extract the follow-up details including:
            - Entity/person to follow up with
            - Follow-up message/task
            - When to schedule it
            - Priority level
            
            Respond with a JSON object containing these details.`,
          },
        ],
      });

      let followUpInfo;
      try {
        followUpInfo = JSON.parse(response as string);
      } catch (_parseError) {
        logger.warn('[ScheduleFollowUp] Failed to parse follow-up information from response');
        // Fallback: create a basic follow-up
        followUpInfo = {
          entityName: 'Unknown',
          message: 'Follow up on conversation',
          scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          priority: 'medium',
        };
      }

      // Find or create entity
      let entityId: UUID;
      if (followUpInfo.entityName && followUpInfo.entityName !== 'Unknown') {
        const searchResults = await rolodexService.searchEntities(followUpInfo.entityName, 1);
        if (searchResults.length > 0 && searchResults[0].id) {
          entityId = searchResults[0].id;
        } else {
          // Create new entity
          const newEntity = await rolodexService.upsertEntity({
            names: [followUpInfo.entityName],
            metadata: {
              source: 'follow-up-action',
              createdFrom: 'conversation',
            },
          });
          entityId = newEntity.id!;
        }
      } else {
        // Use the message sender as the entity
        if (!message.entityId) {
          throw new Error('No entity ID found for follow-up');
        }
        entityId = message.entityId!;
      }

      // Schedule the follow-up
      const followUp = await rolodexService.scheduleFollowUp(entityId, {
        message: followUpInfo.message || 'Follow up on conversation',
        scheduledFor: new Date(followUpInfo.scheduledFor || Date.now() + 24 * 60 * 60 * 1000),
        priority: followUpInfo.priority || 'medium',
        metadata: {
          sourceMessage: message.id,
          roomId: message.roomId,
          createdBy: 'schedule-follow-up-action',
        },
      });

      logger.info(
        `[ScheduleFollowUp] Scheduled follow-up for ${followUpInfo.entityName}: ${followUpInfo.message}`
      );

      // Respond to user
      if (callback) {
        await callback({
          text: `✅ I've scheduled a follow-up with ${followUpInfo.entityName} for ${new Date(followUp.scheduledFor).toLocaleDateString()}: "${followUpInfo.message}"`,
          actions: ['SCHEDULE_FOLLOWUP'],
        });
      }

      return {
        text: `Scheduled follow-up for ${followUpInfo.entityName}`,
        data: {
          followUp,
          entityId,
          entityName: followUpInfo.entityName,
        },
      };
    } catch (error) {
      logger.error('[ScheduleFollowUp] Error scheduling follow-up:', error);

      if (callback) {
        await callback({
          text: '❌ Sorry, I had trouble scheduling that follow-up. Please try again or provide more specific details.',
        });
      }

      throw error;
    }
  },
};
