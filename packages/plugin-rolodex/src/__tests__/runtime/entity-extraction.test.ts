import { type TestSuite, type IAgentRuntime, stringToUuid } from '@elizaos/core';
import type { EntityGraphManager } from '../../managers/EntityGraphManager';

export const entityExtractionRuntimeTests: TestSuite = {
  name: 'Entity Extraction Runtime Tests',

  tests: [
    {
      name: 'Extract entity from simple introduction',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing entity extraction from simple introduction...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        // Create a test room
        const roomId = stringToUuid(`test-room-${Date.now()}`);
        const userId = stringToUuid(`test-user-${Date.now()}`);

        // Create test message
        const message = {
          id: stringToUuid(`msg-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'I just met Alice Johnson. She works at Google as a Senior Engineer.',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Process the message - this should trigger entity extraction
        await (runtime as any).processMessage(message);

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Search for the extracted entity
        const searchResults = await entityGraphService.searchEntities('Alice Johnson');

        if (searchResults.length === 0) {
          throw new Error('Failed to extract entity from introduction');
        }

        const alice = searchResults[0].entity;
        console.log('✓ Extracted entity:', alice.names.join(', '));
        console.log('✓ Tags:', alice.tags?.join(', '));
        console.log('✓ Summary:', alice.summary);

        // Verify extraction quality
        if (!alice.names.some((n) => n.toLowerCase().includes('alice'))) {
          throw new Error('Entity name not properly extracted');
        }

        if (
          !alice.tags?.some(
            (t) => t.toLowerCase().includes('google') || t.toLowerCase().includes('engineer')
          )
        ) {
          throw new Error('Entity context not properly extracted');
        }

        console.log('✅ Entity extraction from simple introduction PASSED');
      },
    },

    {
      name: 'Extract multiple entities from conversation',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing multiple entity extraction...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        const roomId = stringToUuid(`test-room-${Date.now()}`);
        const userId = stringToUuid(`test-user-${Date.now()}`);

        // Create conversation with multiple entities
        const messages = [
          'I had a meeting with Bob Smith from Acme Corp and Carol Davis from TechStartup.',
          'Bob is the CEO and Carol is their CTO. They want to discuss a partnership.',
          'Bob mentioned they have 50 employees and just raised Series A funding.',
        ];

        for (const text of messages) {
          const message = {
            id: stringToUuid(`msg-${Date.now()}-${Math.random()}`),
            entityId: userId,
            agentId: runtime.agentId,
            roomId,
            content: { text, source: 'test' },
            createdAt: Date.now(),
          };

          await (runtime as any).processMessage(message);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // Search for extracted entities
        const bobResults = await entityGraphService.searchEntities('Bob Smith');
        const carolResults = await entityGraphService.searchEntities('Carol Davis');
        const acmeResults = await entityGraphService.searchEntities('Acme Corp');

        console.log(`✓ Found ${bobResults.length} results for Bob Smith`);
        console.log(`✓ Found ${carolResults.length} results for Carol Davis`);
        console.log(`✓ Found ${acmeResults.length} results for Acme Corp`);

        if (bobResults.length === 0 || carolResults.length === 0) {
          throw new Error('Failed to extract all mentioned people');
        }

        // Check if relationships were identified
        const relationships = await entityGraphService.getEntityRelationships(
          bobResults[0].entity.entityId
        );

        console.log(`✓ Found ${relationships.length} relationships for Bob`);

        console.log('✅ Multiple entity extraction PASSED');
      },
    },

    {
      name: 'Extract and update entity information over time',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing entity information updates...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        const roomId = stringToUuid(`test-room-${Date.now()}`);
        const userId = stringToUuid(`test-user-${Date.now()}`);

        // First mention
        const message1 = {
          id: stringToUuid(`msg-1-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'David Kim is a software developer I met at the conference.',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        await (runtime as any).processMessage(message1);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get initial entity
        const initialResults = await entityGraphService.searchEntities('David Kim');
        if (initialResults.length === 0) {
          throw new Error('Failed to extract initial entity');
        }

        const initialEntity = initialResults[0].entity;
        console.log('✓ Initial entity created:', initialEntity.summary);

        // Second mention with more information
        const message2 = {
          id: stringToUuid(`msg-2-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'David Kim just told me he works at Microsoft on the Azure team. His email is david.kim@microsoft.com',
            source: 'test',
          },
          createdAt: Date.now() + 1000,
        };

        await (runtime as any).processMessage(message2);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get updated entity
        const updatedResults = await entityGraphService.searchEntities('David Kim');
        const updatedEntity = updatedResults[0].entity;

        console.log('✓ Updated entity:', updatedEntity.summary);
        console.log('✓ Updated tags:', updatedEntity.tags?.join(', '));

        // Verify information was added
        if (
          !updatedEntity.tags?.some(
            (t) => t.toLowerCase().includes('microsoft') || t.toLowerCase().includes('azure')
          )
        ) {
          throw new Error('Entity information not properly updated');
        }

        console.log('✅ Entity information update PASSED');
      },
    },
  ],
};
