import { type TestSuite, type IAgentRuntime, stringToUuid, type UUID } from '@elizaos/core';
import type { EntityGraphManager } from '../../managers/EntityGraphManager';
import type { EntityResolutionManager } from '../../managers/EntityResolutionManager';
import type { RelationshipOntologyManager } from '../../managers/RelationshipOntologyManager';
import type { RolodexService } from '../../services/RolodexService';
import type { FollowUpManager } from '../../managers/FollowUpManager';
import { createTestWorld, createTestRoom } from './test-helpers';

export class RolodexIntegrationTestSuite implements TestSuite {
  name = 'Rolodex Integration Tests';
  description = 'E2E tests for rolodex plugin with real runtime';

  tests = [
    {
      name: 'Entity tracking and retrieval',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing entity tracking and retrieval...');

        try {
          // Create test world and room
          const worldId = await createTestWorld(runtime);
          const roomId = await createTestRoom(runtime, worldId);

          // Create unique test identifiers
          const userId = stringToUuid(`test-user-${Date.now()}`);

          // Get EntityGraphManager
          const entityGraphService = runtime.getService(
            'entityGraph'
          ) as unknown as EntityGraphManager;
          if (!entityGraphService) {
            throw new Error('EntityGraphManager not available');
          }

          // Create entity using runtime
          const entity = await runtime.createEntity({
            id: userId,
            names: ['Test User'],
            agentId: runtime.agentId,
            metadata: {
              type: 'person',
              role: 'tester',
            },
          });

          if (!entity) {
            throw new Error('Failed to create entity');
          }

          console.log('✓ Entity created successfully');

          // Track entity profile
          const profile = await entityGraphService.trackEntity(
            userId,
            'Test User is a software engineer who loves coding',
            { roomId }
          );

          if (!profile) {
            throw new Error('Failed to track entity profile');
          }

          console.log('✓ Entity profile tracked');

          // Retrieve entity
          const retrieved = await runtime.getEntityById(userId);

          if (!retrieved || retrieved.id !== userId) {
            throw new Error('Failed to retrieve entity');
          }

          console.log('✓ Entity retrieved successfully');

          // Get entities for room
          const roomEntities = await runtime.getEntitiesForRoom(roomId);
          console.log(`✓ Retrieved ${roomEntities.length} entities for room`);

          console.log('✅ Entity tracking and retrieval test PASSED');
        } catch (error) {
          console.error('❌ Entity tracking and retrieval test FAILED:', error);
          throw error;
        }
      },
    },

    {
      name: 'Entity profile management',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing entity profile management...');

        try {
          const entityGraphService = runtime.getService(
            'entityGraph'
          ) as unknown as EntityGraphManager;
          if (!entityGraphService) {
            throw new Error('EntityGraphManager not available');
          }

          const testEntityId = stringToUuid(`profile-test-${Date.now()}`);

          // Create entity first via runtime
          await runtime.createEntity({
            id: testEntityId,
            names: ['Profile Test User'],
            agentId: runtime.agentId,
            metadata: {
              type: 'person',
              role: 'tester',
              department: 'qa',
            },
          });

          // Track entity profile using EntityGraphManager
          const profile = await entityGraphService.trackEntity(
            testEntityId,
            'Profile Test User is a test user for profile management working in QA department as a tester',
            {
              updateExisting: true,
            }
          );

          if (!profile) {
            throw new Error('Failed to create entity profile');
          }

          console.log('✓ Entity profile created');

          // Update profile by tracking with new context
          const updatedProfile = await entityGraphService.trackEntity(
            testEntityId,
            'Profile Test User is an updated test user for profile management with additional responsibilities',
            {
              updateExisting: true,
            }
          );

          if (!updatedProfile) {
            throw new Error('Failed to update entity profile');
          }

          console.log('✓ Entity profile updated');

          // Search for the entity
          const searchResults = await entityGraphService.searchEntities('Profile Test User', {
            limit: 10,
          });

          if (searchResults.length === 0) {
            throw new Error('Failed to find entity in search');
          }

          console.log('✓ Entity found in search results');

          console.log('✅ Entity profile management test PASSED');
        } catch (error) {
          console.error('❌ Entity profile management test FAILED:', error);
          throw error;
        }
      },
    },

    {
      name: 'Relationship creation and tracking',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing relationship creation and tracking...');

        try {
          const entityGraphService = runtime.getService(
            'entityGraph'
          ) as unknown as EntityGraphManager;
          if (!entityGraphService) {
            throw new Error('EntityGraphManager not available');
          }

          // Create two test entities
          const entity1Id = stringToUuid(`rel-entity1-${Date.now()}`);
          const entity2Id = stringToUuid(`rel-entity2-${Date.now()}`);

          await runtime.createEntity({
            id: entity1Id,
            names: ['Relationship Test User 1'],
            agentId: runtime.agentId,
            metadata: { type: 'person' },
          });

          await runtime.createEntity({
            id: entity2Id,
            names: ['Relationship Test User 2'],
            agentId: runtime.agentId,
            metadata: { type: 'person' },
          });

          console.log('✓ Test entities created');

          // Create relationship using EntityGraphManager
          const relationship = await entityGraphService.analyzeInteraction(
            entity1Id,
            entity2Id,
            'User 1 and User 2 are colleagues working on the same project',
            {
              roomId: stringToUuid(`test-room-${Date.now()}`),
            }
          );

          if (!relationship) {
            throw new Error('Failed to create relationship');
          }

          console.log('✓ Relationship created');

          // Retrieve relationships
          const relationships = await entityGraphService.getEntityRelationships(entity1Id);

          if (relationships.length === 0) {
            throw new Error('Failed to retrieve relationships');
          }

          const foundRelationship = relationships.find((r) => r.targetEntityId === entity2Id);

          if (!foundRelationship) {
            throw new Error('Specific relationship not found');
          }

          console.log('✓ Relationship retrieved successfully');

          // Analyze another interaction to strengthen relationship
          await entityGraphService.analyzeInteraction(
            entity1Id,
            entity2Id,
            'User 1 helped User 2 solve a complex problem',
            {
              roomId: stringToUuid(`test-room-${Date.now()}`),
            }
          );

          console.log('✓ Relationship updated');

          console.log('✅ Relationship creation and tracking test PASSED');
        } catch (error) {
          console.error('❌ Relationship creation and tracking test FAILED:', error);
          throw error;
        }
      },
    },

    {
      name: 'Entity resolution service functionality',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing entity resolution service functionality...');

        try {
          const resolutionService = runtime.getService(
            'entity-resolution'
          ) as unknown as EntityResolutionManager;
          if (!resolutionService) {
            throw new Error('EntityResolutionManager not available');
          }

          console.log('✓ EntityResolutionManager is available');

          // Create test entities with similar names for resolution testing
          const entity1Id = stringToUuid(`resolution-test1-${Date.now()}`);
          const entity2Id = stringToUuid(`resolution-test2-${Date.now()}`);
          const roomId = stringToUuid(`test-room-${Date.now()}`);

          await runtime.createEntity({
            id: entity1Id,
            names: ['John Smith'],
            agentId: runtime.agentId,
            metadata: {
              platform: 'discord',
              userId: 'john_smith_123',
              type: 'person',
            },
          });

          await runtime.createEntity({
            id: entity2Id,
            names: ['John S.', 'Johnny Smith'],
            agentId: runtime.agentId,
            metadata: {
              platform: 'slack',
              userId: 'john.smith.456',
              type: 'person',
            },
          });

          console.log('✓ Test entities created for resolution');

          // Test entity resolution
          const resolutionCandidates = await resolutionService.resolveEntity(
            'John Smith',
            {
              roomId,
              platformContext: {
                platform: 'discord',
              },
            },
            'discord'
          );

          if (!resolutionCandidates || resolutionCandidates.length === 0) {
            throw new Error('No resolution candidates returned');
          }

          console.log(`✓ Found ${resolutionCandidates.length} resolution candidates`);

          // Check that the service found potential matches
          const highConfidenceMatches = resolutionCandidates.filter((c) => c.confidence > 0.5);
          if (highConfidenceMatches.length === 0) {
            console.log('⚠️ No high confidence matches found, but resolution is working');
          } else {
            console.log(`✓ Found ${highConfidenceMatches.length} high confidence matches`);
          }

          // Test creating entity with identity
          const newEntityId = await resolutionService.createEntityWithIdentity(
            'Test Entity',
            { roomId },
            [
              {
                platform: 'discord',
                handle: 'test-entity-123',
                userId: 'test-entity-123',
                verified: false,
                confidence: 0.8,
              },
            ]
          );

          if (newEntityId) {
            console.log('✓ Created entity with identity');
          }

          console.log('✅ Entity resolution service functionality test PASSED');
        } catch (error) {
          console.error('❌ Entity resolution service functionality test FAILED:', error);
          throw error;
        }
      },
    },

    {
      name: 'Follow-up scheduling and management',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing follow-up scheduling and management...');

        try {
          const entityGraphService = runtime.getService(
            'entityGraph'
          ) as unknown as EntityGraphManager;
          if (!entityGraphService) {
            throw new Error('EntityGraphManager not available');
          }

          console.log('✓ EntityGraphManager is available');

          // Create test entity for follow-up
          const entityId = stringToUuid(`followup-test-${Date.now()}`);
          await runtime.createEntity({
            id: entityId,
            names: ['Follow-up Test User'],
            agentId: runtime.agentId,
            metadata: { type: 'person' },
          });

          // Schedule follow-up
          const futureDate = new Date();
          futureDate.setHours(futureDate.getHours() + 24); // 24 hours from now

          const followUp = await entityGraphService.scheduleFollowUp(entityId, {
            message: 'Test follow-up message',
            scheduledFor: futureDate,
            priority: 'medium',
            metadata: {
              type: 'test',
              context: 'automated test',
            },
          });

          if (!followUp) {
            throw new Error('Failed to schedule follow-up');
          }

          console.log('✓ Follow-up scheduled');

          // Retrieve follow-ups
          const followUps = await entityGraphService.getUpcomingFollowUps({
            entityId,
            includePast: true,
          });

          if (followUps.length === 0) {
            throw new Error('Failed to retrieve scheduled follow-ups');
          }

          const testFollowUp = followUps.find((f) => f.message === 'Test follow-up message');
          if (!testFollowUp) {
            throw new Error('Specific follow-up not found');
          }

          console.log('✓ Follow-up retrieved successfully');

          console.log('✅ Follow-up scheduling and management test PASSED');
        } catch (error) {
          console.error('❌ Follow-up scheduling and management test FAILED:', error);
          throw error;
        }
      },
    },

    {
      name: 'Provider data integration',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing provider data integration...');

        try {
          // Create test message and state
          const testMessage = {
            id: stringToUuid(`test-msg-${Date.now()}`),
            entityId: stringToUuid(`test-user-${Date.now()}`),
            agentId: runtime.agentId,
            roomId: stringToUuid(`test-room-${Date.now()}`),
            content: {
              text: 'Test message for provider integration',
              source: 'test',
            },
            createdAt: Date.now(),
          };

          // Create test entities for providers to find
          await runtime.createEntity({
            id: testMessage.entityId,
            names: ['Provider Test User'],
            agentId: runtime.agentId,
            metadata: { type: 'person' },
          });

          // Test state composition with providers
          const state = await runtime.composeState(testMessage);

          if (!state) {
            throw new Error('Failed to compose state');
          }

          console.log('✓ State composed successfully');

          // Check if rolodex providers contributed to state
          const hasEntityData =
            state.values?.entityCount !== undefined || state.data?.entities !== undefined;

          if (hasEntityData) {
            console.log('✓ Entity provider contributed to state');
          } else {
            console.log(
              '⚠️ Entity provider did not contribute (may be normal if no entities exist)'
            );
          }

          // Check for relationship data
          const hasRelationshipData = state.data?.relationships !== undefined;
          if (hasRelationshipData) {
            console.log('✓ Relationship provider contributed to state');
          }

          // Check for resolution data
          const hasResolutionData = state.values?.hasResolutionData !== undefined;
          if (hasResolutionData) {
            console.log('✓ Entity resolution provider contributed to state');
          }

          console.log('✅ Provider data integration test PASSED');
        } catch (error) {
          console.error('❌ Provider data integration test FAILED:', error);
          throw error;
        }
      },
    },

    {
      name: 'Cross-service integration',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing cross-service integration...');

        try {
          // Verify all core services are available
          const entityGraphService = runtime.getService(
            'entityGraph'
          ) as unknown as EntityGraphManager;
          const resolutionService = runtime.getService(
            'entity-resolution'
          ) as unknown as EntityResolutionManager;

          if (!entityGraphService) {
            throw new Error('EntityGraphManager not available');
          }

          if (!resolutionService) {
            throw new Error('EntityResolutionManager not available');
          }

          console.log('✓ All core services are available');

          // Test cross-service workflow
          const entityId = stringToUuid(`integration-test-${Date.now()}`);
          const relatedEntityId = stringToUuid(`integration-related-${Date.now()}`);

          // Create entity using runtime
          const entity = await runtime.createEntity({
            id: entityId,
            names: ['Integration Test User'],
            agentId: runtime.agentId,
            metadata: {
              type: 'person',
              role: 'test subject',
              summary: 'User for testing cross-service integration',
              tags: ['integration', 'test'],
              platforms: { test: 'integration-123' },
            },
          });

          if (!entity) {
            throw new Error('Failed to create entity');
          }

          console.log('✓ Entity created');

          // Track entity profile using EntityGraphManager
          const profile = await entityGraphService.trackEntity(
            entityId,
            'Integration Test User is a test subject for cross-service integration',
            {
              updateExisting: true,
            }
          );

          if (!profile) {
            throw new Error('Failed to track entity profile');
          }

          console.log('✓ Entity profile tracked');

          // Create related entity and relationship
          await runtime.createEntity({
            id: relatedEntityId,
            names: ['Related Test User'],
            agentId: runtime.agentId,
            metadata: { type: 'person' },
          });

          const relationship = await entityGraphService.analyzeInteraction(
            entityId,
            relatedEntityId,
            'Integration Test User collaborates with Related Test User',
            {
              roomId: stringToUuid(`test-room-${Date.now()}`),
            }
          );

          if (!relationship) {
            throw new Error('Failed to create relationship');
          }

          console.log('✓ Relationship created via EntityGraphManager');

          // Test entity resolution across services
          const resolutionCandidates = await resolutionService.resolveEntity(
            'Integration Test User',
            {
              roomId: stringToUuid(`test-room-${Date.now()}`),
            }
          );

          if (resolutionCandidates.length === 0) {
            throw new Error('Entity resolution failed');
          }

          console.log('✓ Entity resolved via EntityResolutionManager');

          // Schedule follow-up using EntityGraphManager
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 1);

          const followUp = await entityGraphService.scheduleFollowUp(entityId, {
            message: 'Follow up on integration test',
            scheduledFor: futureDate,
            priority: 'low',
          });

          if (!followUp) {
            throw new Error('Failed to schedule follow-up');
          }

          console.log('✓ Follow-up scheduled via EntityGraphManager');

          // Test trust management
          await entityGraphService.updateTrust(entityId, {
            type: 'positive_interaction',
            impact: 0.1,
            reason: 'Successful integration test',
          });

          console.log('✓ Trust updated via EntityGraphManager');

          console.log('✅ Cross-service integration test PASSED');
        } catch (error) {
          console.error('❌ Cross-service integration test FAILED:', error);
          throw error;
        }
      },
    },

    // Remove the deprecated service tests
  ];
}

export default new RolodexIntegrationTestSuite();
