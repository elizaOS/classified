import { type TestSuite } from '@elizaos/core';
import { entityExtractionRuntimeTests } from './entity-extraction.test';
import { relationshipManagementRuntimeTests } from './relationship-management.test';
import { followUpRuntimeTests } from './follow-up.test';

/**
 * Comprehensive runtime test suite for the Rolodex plugin
 * These tests use real ElizaOS runtime with actual LLM calls and services
 */
export class RolodexRuntimeTestSuite implements TestSuite {
  name = 'Rolodex Plugin Runtime Tests';
  description = 'Comprehensive runtime tests using real ElizaOS runtime and services';

  tests = [
    // Entity extraction tests
    ...entityExtractionRuntimeTests.tests,

    // Relationship management tests
    ...relationshipManagementRuntimeTests.tests,

    // Follow-up management tests
    ...followUpRuntimeTests.tests,

    // Integration test combining all features
    {
      name: 'End-to-end conversation workflow',
      fn: async (runtime: any) => {
        console.log('🧪 Testing end-to-end conversation workflow...');

        const entityGraphService = runtime.getService('entityGraph');
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        const roomId = runtime.stringToUuid(`test-room-${Date.now()}`);
        const userId = runtime.stringToUuid(`test-user-${Date.now()}`);

        // Simulate a realistic conversation
        const conversation = [
          'I just had a great meeting with Sam Taylor from InnovateTech.',
          'Sam is their Head of Partnerships and we discussed potential collaboration.',
          'They have a team of 200 people and just launched their AI platform.',
          'Sam introduced me to their CTO, Jordan Lee, who will handle the technical integration.',
          'I should follow up with both of them next week to finalize the partnership terms.',
          'Jordan mentioned they work closely with Morgan Chen who leads their API team.',
        ];

        // Process the conversation
        for (let i = 0; i < conversation.length; i++) {
          const message = {
            id: runtime.stringToUuid(`msg-${i}-${Date.now()}`),
            entityId: userId,
            agentId: runtime.agentId,
            roomId,
            content: {
              text: conversation[i],
              source: 'test',
            },
            createdAt: Date.now() + i * 1000, // Stagger timestamps
          };

          await (runtime as any).processMessage(message);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // Verify entities were extracted
        const samResults = await entityGraphService.searchEntities('Sam Taylor');
        const jordanResults = await entityGraphService.searchEntities('Jordan Lee');
        const morganResults = await entityGraphService.searchEntities('Morgan Chen');

        console.log('✓ Entities extracted:', {
          'Sam Taylor': samResults.length > 0,
          'Jordan Lee': jordanResults.length > 0,
          'Morgan Chen': morganResults.length > 0,
        });

        // Verify relationships
        if (samResults.length > 0 && jordanResults.length > 0) {
          const samRelationships = await entityGraphService.getEntityRelationships(
            samResults[0].entity.entityId
          );
          console.log(`✓ Sam has ${samRelationships.length} relationships`);
        }

        // Verify follow-ups
        const followUps = await entityGraphService.getUpcomingFollowUps({
          includePast: false,
        });
        console.log(`✓ ${followUps.length} follow-ups scheduled`);

        // Check organization entity
        const innovateTechResults = await entityGraphService.searchEntities('InnovateTech');
        if (innovateTechResults.length > 0) {
          console.log('✓ Organization entity created:', innovateTechResults[0].entity.type);
        }

        console.log('✅ End-to-end conversation workflow PASSED');
      },
    },
  ];
}

// Export test suites
export const rolodexRuntimeTests = new RolodexRuntimeTestSuite();
export { entityExtractionRuntimeTests, relationshipManagementRuntimeTests, followUpRuntimeTests };

// Default export for ElizaOS test runner
export default rolodexRuntimeTests;
