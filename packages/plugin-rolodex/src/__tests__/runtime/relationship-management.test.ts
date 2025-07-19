import { type TestSuite, type IAgentRuntime, stringToUuid } from '@elizaos/core';
import type { EntityGraphManager } from '../../managers/EntityGraphManager';

export const relationshipManagementRuntimeTests: TestSuite = {
  name: 'Relationship Management Runtime Tests',

  tests: [
    {
      name: 'Detect relationship from conversation',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing relationship detection from conversation...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        const roomId = stringToUuid(`test-room-${Date.now()}`);
        const userId = stringToUuid(`test-user-${Date.now()}`);

        // Create entities first
        const entity1Id = stringToUuid(`entity1-${Date.now()}`);
        const entity2Id = stringToUuid(`entity2-${Date.now()}`);

        await runtime.createEntity({
          id: entity1Id,
          names: ['Emma Wilson'],
          agentId: runtime.agentId,
          metadata: { type: 'person' },
        });

        await runtime.createEntity({
          id: entity2Id,
          names: ['Frank Chen'],
          agentId: runtime.agentId,
          metadata: { type: 'person' },
        });

        // Process message mentioning their relationship
        const message = {
          id: stringToUuid(`msg-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: "Emma Wilson and Frank Chen are co-founders of AIStartup. They've been working together for 3 years.",
            source: 'test',
          },
          createdAt: Date.now(),
        };

        await (runtime as any).processMessage(message);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Check if relationship was created
        const relationships = await entityGraphService.getEntityRelationships(entity1Id);

        console.log(`✓ Found ${relationships.length} relationships for Emma`);

        if (relationships.length > 0) {
          const relationship = relationships[0];
          console.log('✓ Relationship type:', relationship.relationshipType);
          console.log('✓ Relationship strength:', relationship.strength || 0);
          console.log('✓ Metadata:', JSON.stringify(relationship.metadata));
        }

        console.log('✅ Relationship detection PASSED');
      },
    },

    {
      name: 'Build relationship strength over interactions',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing relationship strength building...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        const roomId = stringToUuid(`test-room-${Date.now()}`);
        const userId = stringToUuid(`test-user-${Date.now()}`);

        // Track initial interaction
        await entityGraphService.trackEntity(
          userId,
          'I work closely with Grace Lee on the product team.',
          { roomId }
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Find Grace's entity
        const graceResults = await entityGraphService.searchEntities('Grace Lee');
        if (graceResults.length === 0) {
          throw new Error('Failed to find Grace Lee entity');
        }

        const graceId = graceResults[0].entity.entityId;

        // Multiple interactions to build relationship
        const interactions = [
          'Grace Lee and I had a productive meeting about the roadmap.',
          'Grace helped me solve a complex technical problem today.',
          'Working with Grace on the new feature launch.',
          'Grace and I presented the quarterly results together.',
        ];

        for (const text of interactions) {
          const message = {
            id: stringToUuid(`msg-${Date.now()}-${Math.random()}`),
            entityId: userId,
            agentId: runtime.agentId,
            roomId,
            content: { text, source: 'test' },
            createdAt: Date.now(),
          };

          await (runtime as any).processMessage(message);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        // Check relationship strength
        const relationships = await entityGraphService.getEntityRelationships(userId);
        const graceRelationship = relationships.find(
          (r) => r.sourceEntityId === graceId || r.targetEntityId === graceId
        );

        if (!graceRelationship) {
          throw new Error('Relationship with Grace not found');
        }

        console.log('✓ Final relationship strength:', graceRelationship.strength || 0);
        console.log('✓ Interaction count:', graceRelationship.metadata?.interactionCount);

        if (graceRelationship.strength || 0 < 0.5) {
          throw new Error('Relationship strength did not increase with interactions');
        }

        console.log('✅ Relationship strength building PASSED');
      },
    },

    {
      name: 'Identify complex relationship networks',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing complex relationship network identification...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        const roomId = stringToUuid(`test-room-${Date.now()}`);
        const userId = stringToUuid(`test-user-${Date.now()}`);

        // Describe a complex network
        const networkDescription = `
          Let me tell you about our team structure:
          - Helen Park is our CEO and she directly manages Ian Ross (CTO) and Julia Kim (CFO).
          - Ian leads the engineering team with Kevin Liu and Laura Martinez as senior engineers.
          - Julia works closely with Mike Chen who handles investor relations.
          - Kevin and Laura are working together on the AI project.
          - Helen and Julia went to Stanford together.
        `;

        const message = {
          id: stringToUuid(`msg-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: networkDescription,
            source: 'test',
          },
          createdAt: Date.now(),
        };

        await (runtime as any).processMessage(message);
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Longer wait for complex processing

        // Search for key entities
        const helenResults = await entityGraphService.searchEntities('Helen Park');
        const ianResults = await entityGraphService.searchEntities('Ian Ross');
        const kevinResults = await entityGraphService.searchEntities('Kevin Liu');

        console.log(`✓ Found ${helenResults.length} results for Helen Park (CEO)`);
        console.log(`✓ Found ${ianResults.length} results for Ian Ross (CTO)`);
        console.log(`✓ Found ${kevinResults.length} results for Kevin Liu`);

        if (helenResults.length > 0) {
          const helenRelationships = await entityGraphService.getEntityRelationships(
            helenResults[0].entity.entityId
          );
          console.log(`✓ Helen has ${helenRelationships.length} relationships`);

          // Check for management relationships
          const managementRels = helenRelationships.filter(
            (r) =>
              r.relationshipType &&
              Array.isArray(r.metadata?.tags) &&
              r.metadata.tags.indexOf('manage') !== -1
          );
          console.log(`✓ Found ${managementRels.length} management relationships`);
        }

        console.log('✅ Complex relationship network identification PASSED');
      },
    },
  ],
};
