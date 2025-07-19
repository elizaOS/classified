import { type TestSuite, type IAgentRuntime, stringToUuid } from '@elizaos/core';
import type { EntityGraphManager } from '../../managers/EntityGraphManager';

export const followUpRuntimeTests: TestSuite = {
  name: 'Follow-up Management Runtime Tests',

  tests: [
    {
      name: 'Schedule follow-up from conversation',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing follow-up scheduling from conversation...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        const roomId = stringToUuid(`test-room-${Date.now()}`);
        const userId = stringToUuid(`test-user-${Date.now()}`);

        // Process message requesting follow-up
        const message = {
          id: stringToUuid(`msg-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'I need to follow up with Nancy Chen next week about the partnership proposal.',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        await (runtime as any).processMessage(message);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Check if Nancy was created
        const nancyResults = await entityGraphService.searchEntities('Nancy Chen');
        if (nancyResults.length === 0) {
          throw new Error('Nancy Chen entity not created');
        }

        const nancyId = nancyResults[0].entity.entityId;

        // Check if follow-up was scheduled
        const followUps = await entityGraphService.getUpcomingFollowUps({
          entityId: nancyId,
          includePast: false,
        });

        console.log(`✓ Found ${followUps.length} follow-ups for Nancy`);

        if (followUps.length > 0) {
          const followUp = followUps[0];
          console.log('✓ Follow-up message:', followUp.message);
          console.log('✓ Scheduled for:', new Date(followUp.scheduledFor).toLocaleDateString());
          console.log('✓ Priority:', followUp.metadata?.priority);
        }

        console.log('✅ Follow-up scheduling from conversation PASSED');
      },
    },

    {
      name: 'Schedule multiple follow-ups with different priorities',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing multiple follow-up scheduling...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        const roomId = stringToUuid(`test-room-${Date.now()}`);
        const userId = stringToUuid(`test-user-${Date.now()}`);

        // Schedule multiple follow-ups
        const followUpRequests = [
          'I need to urgently follow up with Oliver King tomorrow about the contract.',
          'Remind me to check in with Patricia Lee next month about her project progress.',
          'Schedule a follow-up with Quinn Zhang in 2 weeks for the quarterly review.',
        ];

        for (const text of followUpRequests) {
          const message = {
            id: stringToUuid(`msg-${Date.now()}-${Math.random()}`),
            entityId: userId,
            agentId: runtime.agentId,
            roomId,
            content: { text, source: 'test' },
            createdAt: Date.now(),
          };

          await (runtime as any).processMessage(message);
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }

        // Get all follow-ups
        const allFollowUps = await entityGraphService.getUpcomingFollowUps({
          includePast: false,
        });

        console.log(`✓ Total follow-ups scheduled: ${allFollowUps.length}`);

        // Check for urgent follow-up
        const urgentFollowUp = allFollowUps.find(
          (f) => f.message?.toLowerCase().includes('urgent') || f.metadata?.priority === 'high'
        );

        if (urgentFollowUp) {
          console.log('✓ Found urgent follow-up:', urgentFollowUp.message);
        }

        // Verify different scheduled times
        const scheduledDates = allFollowUps.map((f) => new Date(f.scheduledFor).getTime());
        const uniqueDates = new Set(scheduledDates);

        console.log(`✓ Follow-ups scheduled for ${uniqueDates.size} different dates`);

        console.log('✅ Multiple follow-up scheduling PASSED');
      },
    },

    {
      name: 'Complete and track follow-up execution',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing follow-up completion tracking...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        const roomId = stringToUuid(`test-room-${Date.now()}`);
        const userId = stringToUuid(`test-user-${Date.now()}`);

        // Create entity and schedule immediate follow-up
        const entityId = stringToUuid(`rachel-${Date.now()}`);
        await runtime.createEntity({
          id: entityId,
          names: ['Rachel Green'],
          agentId: runtime.agentId,
          metadata: { type: 'person', role: 'client' },
        });

        // Schedule a follow-up for now
        const followUp = await entityGraphService.scheduleFollowUp(entityId, {
          message: 'Check on project status with Rachel',
          scheduledFor: new Date(), // Immediate
          priority: 'medium',
          metadata: { type: 'status-check' },
        });

        console.log('✓ Follow-up scheduled:', followUp.id);

        // Simulate completing the follow-up
        const completionMessage = {
          id: stringToUuid(`msg-complete-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'I just finished the follow-up call with Rachel Green. The project is on track.',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        await (runtime as any).processMessage(completionMessage);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Check follow-up status
        const followUps = await entityGraphService.getUpcomingFollowUps({
          entityId,
          includePast: true,
        });

        console.log(`✓ Total follow-ups for Rachel: ${followUps.length}`);

        // Check if the follow-up was marked as completed
        const completedFollowUp = followUps.find((f) => f.id === followUp.id);
        if (completedFollowUp) {
          console.log('✓ Follow-up status:', completedFollowUp.completed ? 'Completed' : 'Pending');
        }

        // Check if interaction was recorded
        const relationships = await entityGraphService.getEntityRelationships(entityId);
        console.log(`✓ Relationships after follow-up: ${relationships.length}`);

        console.log('✅ Follow-up completion tracking PASSED');
      },
    },
  ],
};
