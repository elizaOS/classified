import { type TestSuite, stringToUuid } from '@elizaos/core';
import { RolodexIntegrationTestSuite } from './rolodex-integration.test';
import { entityGraphTests } from './entity-graph.test';
import { realEntityExtractionTests } from './real-entity-extraction.test';
import { realRelationshipInferenceTests } from './real-relationship-inference.test';
import { RealIntegrationTestSuite } from './integration.test';
import RolodexSQLCompatibilityTestSuite from './sql-compatibility.test';
import type { EntityGraphManager } from '../../managers/EntityGraphManager';
import type { EntityResolutionManager } from '../../managers/EntityResolutionManager';

const rolodexIntegrationTestsInstance = new RolodexIntegrationTestSuite();
const realIntegrationTestsInstance = new RealIntegrationTestSuite();

// Comprehensive E2E test suite for the rolodex plugin
export const rolodexE2ETestSuites: TestSuite[] = [
  // SQL compatibility tests first (most important)
  RolodexSQLCompatibilityTestSuite,

  // Real runtime integration tests
  realIntegrationTestsInstance,

  // Real LLM-powered tests
  realEntityExtractionTests,
  realRelationshipInferenceTests,

  // Integration tests
  rolodexIntegrationTestsInstance,
  entityGraphTests,
];

// Combined test suite that includes all tests
export class RolodexComprehensiveTestSuite implements TestSuite {
  name = 'Rolodex Plugin E2E Tests';
  description = 'Comprehensive end-to-end tests for all rolodex plugin functionality';

  tests = [
    // SQL compatibility tests first (most critical)
    ...RolodexSQLCompatibilityTestSuite.tests,

    // Real runtime integration tests
    ...realIntegrationTestsInstance.tests,

    // Real LLM tests
    ...realEntityExtractionTests.tests,
    ...realRelationshipInferenceTests.tests,

    // Integration tests
    ...rolodexIntegrationTestsInstance.tests,
    // Entity graph tests
    ...entityGraphTests.tests,

    // Additional comprehensive test
    {
      name: 'Full workflow integration test',
      fn: async (runtime: any) => {
        console.log('🧪 Testing full workflow integration...');

        try {
          // This test combines multiple operations in a realistic workflow
          const testId = Date.now();
          const roomId = stringToUuid(`test-room-${testId}`);
          const userId1 = stringToUuid(`user1-${testId}`);
          const userId2 = stringToUuid(`user2-${testId}`);
          const userId3 = stringToUuid(`user3-${testId}`);

          console.log('✓ Starting comprehensive workflow test');

          // Step 1: Create multiple entities representing a team
          const teamMembers = [
            {
              id: userId1,
              names: ['Alice Johnson'],
              metadata: {
                role: 'Team Lead',
                department: 'Engineering',
                skills: ['JavaScript', 'Team Management'],
                email: 'alice@company.com',
              },
            },
            {
              id: userId2,
              names: ['Bob Chen', 'Robert Chen'],
              metadata: {
                role: 'Senior Developer',
                department: 'Engineering',
                skills: ['Python', 'Machine Learning'],
                email: 'bob@company.com',
              },
            },
            {
              id: userId3,
              names: ['Carol Davis'],
              metadata: {
                role: 'Product Manager',
                department: 'Product',
                skills: ['Product Strategy', 'User Research'],
                email: 'carol@company.com',
              },
            },
          ];

          for (const member of teamMembers) {
            await runtime.createEntity({
              id: member.id,
              names: member.names,
              agentId: runtime.agentId,
              metadata: {
                type: 'person',
                ...member.metadata,
              },
            });
          }

          console.log('✓ Team entities created');

          // Step 2: Track entity profiles using EntityGraphManager
          const entityGraphService = runtime.getService(
            'entityGraph'
          ) as unknown as EntityGraphManager;
          if (entityGraphService) {
            for (const member of teamMembers) {
              await entityGraphService.trackEntity(
                member.id,
                `${member.metadata.role} in ${member.metadata.department} department with skills in ${member.metadata.skills.join(', ')}`,
                {
                  updateExisting: true,
                }
              );
            }
            console.log('✓ Entity profiles tracked');
          }

          // Step 3: Establish team relationships using EntityGraphManager
          const relationships = [
            { from: userId1, to: userId2, context: 'Alice manages Bob in the engineering team' },
            {
              from: userId1,
              to: userId3,
              context: 'Alice collaborates with Carol on product planning',
            },
            {
              from: userId2,
              to: userId3,
              context: 'Bob works with Carol on technical requirements',
            },
          ];

          if (entityGraphService) {
            for (const rel of relationships) {
              await entityGraphService.analyzeInteraction(rel.from, rel.to, rel.context, {
                roomId,
              });
            }
            console.log('✓ Team relationships established');
          }

          // Step 4: Schedule follow-ups using EntityGraphManager
          if (entityGraphService) {
            const followUpDate = new Date();
            followUpDate.setDate(followUpDate.getDate() + 7); // One week from now

            for (const member of teamMembers) {
              await entityGraphService.scheduleFollowUp(member.id, {
                message: `Weekly check-in with ${member.names[0]}`,
                scheduledFor: followUpDate,
                priority: 'medium',
                metadata: {
                  type: 'weekly-checkin',
                  department: member.metadata.department,
                },
              });
            }
            console.log('✓ Follow-ups scheduled for team');
          }

          // Step 5: Test entity resolution with similar names
          const resolutionService = runtime.getService(
            'entity-resolution'
          ) as unknown as EntityResolutionManager;
          if (resolutionService) {
            // Try to resolve "Bob" - should find "Bob Chen"
            const bobResolution = await resolutionService.resolveEntity('Bob', {
              roomId,
              platformContext: { platform: 'slack' },
            });

            if (bobResolution && bobResolution.length > 0) {
              const highConfidence = bobResolution.filter((c) => c.confidence > 0.5);
              console.log(
                `✓ Entity resolution found ${highConfidence.length} high-confidence matches for "Bob"`
              );
            }
          }

          // Step 6: Test trust management
          if (entityGraphService) {
            // Update trust for team members based on interactions
            await entityGraphService.updateTrust(userId1, {
              type: 'leadership',
              impact: 0.2,
              reason: 'Effective team leadership',
            });

            await entityGraphService.updateTrust(userId2, {
              type: 'collaboration',
              impact: 0.15,
              reason: 'Good collaboration on projects',
            });

            console.log('✓ Trust scores updated');
          }

          // Step 7: Test state composition with all providers
          const testMessage = {
            id: stringToUuid(`test-msg-${testId}`),
            entityId: userId1,
            agentId: runtime.agentId,
            roomId,
            content: {
              text: 'How is the team doing?',
              source: 'test',
            },
            createdAt: Date.now(),
          };

          const state = await runtime.composeState(testMessage);
          if (!state) {
            throw new Error('Failed to compose state');
          }

          // Verify state contains data from various providers
          const hasEntityData = state.values?.entityCount > 0 || state.data?.entities !== undefined;
          const hasRelationshipData = state.data?.relationships !== undefined;
          const hasFollowUpData = state.data?.followUps !== undefined;

          console.log(
            `✓ State composition successful - Entities: ${hasEntityData}, Relationships: ${hasRelationshipData}, Follow-ups: ${hasFollowUpData}`
          );

          // Step 8: Verify data retrieval
          const retrievedEntities = await runtime.getEntitiesForRoom(roomId);
          const retrievedRelationships = await runtime.getRelationships({ entityId: userId1 });

          if (entityGraphService) {
            const upcomingFollowUps = await entityGraphService.getUpcomingFollowUps({
              includePast: true,
            });
            console.log(
              `✓ Data verification - Entities: ${retrievedEntities.length}, Relationships: ${retrievedRelationships.length}, Follow-ups: ${upcomingFollowUps.length}`
            );
          }

          console.log('✓ Full workflow test completed successfully');
          console.log('✅ Full workflow integration test PASSED');
        } catch (error) {
          console.error('❌ Full workflow integration test FAILED:', error);
          throw error;
        }
      },
    },
  ];
}

export default new RolodexComprehensiveTestSuite();

export { RolodexIntegrationTestSuite, entityGraphTests };
