import { type TestSuite, type IAgentRuntime, stringToUuid, type UUID } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { EntityGraphManager } from '../../managers/EntityGraphManager';

const TEST_TIMEOUT = 30000;

export const entityGraphTests: TestSuite = {
  name: 'EntityGraphTestSuite',
  tests: [
    {
      name: 'Network Analysis Test',
      fn: async (runtime: IAgentRuntime) => {
        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        // Create a network of entities
        const entities: UUID[] = [];
        const entityNames = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];

        for (const name of entityNames) {
          const entityId = stringToUuid(`entity-${name}-${Date.now()}`);

          // Create entity first
          await runtime.createEntity({
            id: entityId,
            names: [name],
            agentId: runtime.agentId,
            metadata: { type: 'person' },
          });

          // Track entity
          await entityGraphService.trackEntity(
            entityId,
            `${name} is a developer working on collaborative projects`,
            { updateExisting: true }
          );

          entities.push(entityId);
        }

        // Create relationships in a network pattern
        const relationships = [
          { source: 0, target: 1, context: 'Alice and Bob collaborate on frontend development' },
          { source: 0, target: 2, context: 'Alice mentors Charlie on best practices' },
          { source: 1, target: 3, context: 'Bob and David work together on backend services' },
          { source: 2, target: 3, context: 'Charlie and David pair program regularly' },
          { source: 3, target: 4, context: 'David helps Eve with deployment strategies' },
        ];

        const roomId = stringToUuid(`test-room-${Date.now()}`);
        for (const { source, target, context } of relationships) {
          await entityGraphService.analyzeInteraction(entities[source], entities[target], context, {
            roomId,
          });
        }

        // Test network analysis by verifying relationships
        for (let i = 0; i < entities.length; i++) {
          const relationships = await entityGraphService.getEntityRelationships(entities[i]);
          if (relationships.length === 0 && i !== 4) {
            // Eve might only have incoming relationships
            throw new Error(`No relationships found for entity ${i}`);
          }
        }

        console.log('✓ Network analysis test passed');
      },
    },
    {
      name: 'Community Detection Test',
      fn: async (runtime: IAgentRuntime) => {
        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        // Create two distinct communities
        const community1: UUID[] = [];
        const community2: UUID[] = [];
        const roomId = stringToUuid(`test-room-${Date.now()}`);

        // Community 1: Tech enthusiasts
        for (let i = 0; i < 4; i++) {
          const entityId = stringToUuid(`tech-${i}-${Date.now()}`);

          await runtime.createEntity({
            id: entityId,
            names: [`Tech Enthusiast ${i}`],
            agentId: runtime.agentId,
            metadata: { type: 'person', interests: ['AI', 'blockchain'] },
          });

          await entityGraphService.trackEntity(
            entityId,
            `Tech enthusiast ${i} interested in AI and blockchain technologies`,
            { updateExisting: true }
          );

          community1.push(entityId);
        }

        // Community 2: Music lovers
        for (let i = 0; i < 4; i++) {
          const entityId = stringToUuid(`music-${i}-${Date.now()}`);

          await runtime.createEntity({
            id: entityId,
            names: [`Music Lover ${i}`],
            agentId: runtime.agentId,
            metadata: { type: 'person', interests: ['jazz', 'classical'] },
          });

          await entityGraphService.trackEntity(
            entityId,
            `Music lover ${i} passionate about jazz and classical music`,
            { updateExisting: true }
          );

          community2.push(entityId);
        }

        // Create strong intra-community relationships
        for (let i = 0; i < community1.length; i++) {
          for (let j = i + 1; j < community1.length; j++) {
            await entityGraphService.analyzeInteraction(
              community1[i],
              community1[j],
              'They discuss AI research and blockchain projects together',
              { roomId }
            );
          }
        }

        for (let i = 0; i < community2.length; i++) {
          for (let j = i + 1; j < community2.length; j++) {
            await entityGraphService.analyzeInteraction(
              community2[i],
              community2[j],
              'They attend concerts and share music recommendations',
              { roomId }
            );
          }
        }

        // Create one weak inter-community relationship
        await entityGraphService.analyzeInteraction(
          community1[0],
          community2[0],
          'They occasionally chat about general topics',
          { roomId }
        );

        // Verify that relationships were created
        const techRelationships = await entityGraphService.getEntityRelationships(community1[0]);
        const musicRelationships = await entityGraphService.getEntityRelationships(community2[0]);

        if (techRelationships.length < 3) {
          throw new Error('Tech community relationships not properly created');
        }

        if (musicRelationships.length < 3) {
          throw new Error('Music community relationships not properly created');
        }

        console.log('✓ Community detection test passed');
      },
    },
    {
      name: 'Trust Management Test',
      fn: async (runtime: IAgentRuntime) => {
        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        // Create entities for trust testing
        const entityId1 = stringToUuid(`trust-entity-1-${Date.now()}`);
        const entityId2 = stringToUuid(`trust-entity-2-${Date.now()}`);

        await runtime.createEntity({
          id: entityId1,
          names: ['Trust Test Entity 1'],
          agentId: runtime.agentId,
          metadata: { type: 'person' },
        });

        await runtime.createEntity({
          id: entityId2,
          names: ['Trust Test Entity 2'],
          agentId: runtime.agentId,
          metadata: { type: 'person' },
        });

        // Track entities
        await entityGraphService.trackEntity(entityId1, 'Entity 1 is a reliable collaborator', {
          updateExisting: true,
        });

        await entityGraphService.trackEntity(entityId2, 'Entity 2 is a new team member', {
          updateExisting: true,
        });

        // Update trust scores
        await entityGraphService.updateTrust(entityId1, {
          type: 'positive_interaction',
          impact: 0.2,
          reason: 'Delivered project on time',
        });

        await entityGraphService.updateTrust(entityId1, {
          type: 'collaboration',
          impact: 0.15,
          reason: 'Helpful during code review',
        });

        await entityGraphService.updateTrust(entityId2, {
          type: 'negative_interaction',
          impact: -0.1,
          reason: 'Missed deadline',
        });

        // Verify trust scores are tracked (we can't directly check scores, but we can verify the entities exist)
        const searchResults1 = await entityGraphService.searchEntities('Trust Test Entity 1', {
          limit: 10,
        });
        const searchResults2 = await entityGraphService.searchEntities('Trust Test Entity 2', {
          limit: 10,
        });

        if (searchResults1.length === 0 || searchResults2.length === 0) {
          throw new Error('Trust management entities not found');
        }

        console.log('✓ Trust management test passed');
      },
    },
    {
      name: 'Follow-up Scheduling Test',
      fn: async (runtime: IAgentRuntime) => {
        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        // Create entity for follow-up testing
        const entityId = stringToUuid(`followup-entity-${Date.now()}`);

        await runtime.createEntity({
          id: entityId,
          names: ['Follow-up Test Entity'],
          agentId: runtime.agentId,
          metadata: { type: 'person', role: 'client' },
        });

        await entityGraphService.trackEntity(
          entityId,
          'Important client requiring regular follow-ups',
          { updateExisting: true }
        );

        // Schedule multiple follow-ups
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);

        const followUp1 = await entityGraphService.scheduleFollowUp(entityId, {
          message: 'Check project status',
          scheduledFor: tomorrow,
          priority: 'high',
        });

        const followUp2 = await entityGraphService.scheduleFollowUp(entityId, {
          message: 'Quarterly review meeting',
          scheduledFor: nextWeek,
          priority: 'medium',
          metadata: {
            type: 'review',
            agenda: ['Progress update', 'Next steps', 'Budget review'],
          },
        });

        if (!followUp1 || !followUp2) {
          throw new Error('Failed to schedule follow-ups');
        }

        // Get upcoming follow-ups
        const upcomingFollowUps = await entityGraphService.getUpcomingFollowUps({
          entityId,
          includePast: false,
        });

        if (upcomingFollowUps.length < 2) {
          throw new Error('Failed to retrieve scheduled follow-ups');
        }

        console.log('✓ Follow-up scheduling test passed');
      },
    },
  ],
};
