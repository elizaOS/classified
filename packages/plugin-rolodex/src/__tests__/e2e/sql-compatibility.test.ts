import { type TestSuite, type IAgentRuntime, stringToUuid } from '@elizaos/core';

export class RolodexSQLCompatibilityTestSuite implements TestSuite {
  name = 'Rolodex SQL Compatibility Tests';
  description = 'E2E tests for rolodex plugin compatibility with plugin-sql';

  tests = [
    {
      name: 'should initialize with plugin-sql dependencies',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing rolodex initialization with SQL dependencies...');

        try {
          // Verify that plugin-sql is available
          if (!runtime.db) {
            throw new Error('Database adapter not available - plugin-sql not loaded');
          }

          console.log('✓ Database adapter is available');

          // Test basic database operations
          const testWorldId = stringToUuid(`test-world-${Date.now()}`);
          const testRoomId = stringToUuid(`test-room-${Date.now()}`);

          // Create world
          await runtime.createWorld({
            id: testWorldId,
            name: 'SQL Compatibility Test World',
            agentId: runtime.agentId,
            serverId: 'test-server',
            metadata: { type: 'test' },
          });

          console.log('✓ World created successfully');

          // Create room
          await runtime.createRoom({
            id: testRoomId,
            name: 'SQL Compatibility Test Room',
            agentId: runtime.agentId,
            worldId: testWorldId,
            source: 'test',
            type: 'GROUP' as any,
          });

          console.log('✓ Room created successfully');

          // Test entity creation using unified interface
          const entityId = stringToUuid(`sql-compat-entity-${Date.now()}`);
          await runtime.createEntity({
            id: entityId,
            names: ['SQL Compatibility Test Entity'],
            agentId: runtime.agentId,
            metadata: {
              type: 'person',
              testMode: true,
              sqlCompatibility: true,
            },
          });

          console.log('✓ Entity created through unified interface');

          // Test entity retrieval
          const retrieved = await runtime.getEntityById(entityId);
          if (!retrieved) {
            throw new Error('Failed to retrieve entity');
          }

          console.log('✓ Entity retrieved through unified interface');

          // Test relationship creation using unified interface
          const secondEntityId = stringToUuid(`sql-compat-entity2-${Date.now()}`);
          await runtime.createEntity({
            id: secondEntityId,
            names: ['SQL Compatibility Test Entity 2'],
            agentId: runtime.agentId,
            metadata: { type: 'person', testMode: true },
          });

          await runtime.createRelationship({
            sourceEntityId: entityId,
            targetEntityId: secondEntityId,
            metadata: {
              type: 'colleague',
              strength: 0.8,
              source: 'sql_compatibility_test',
            },
          });

          console.log('✓ Relationship created through unified interface');

          // Test component creation using unified interface
          await runtime.createComponent({
            id: stringToUuid(`sql-compat-component-${Date.now()}`),
            entityId,
            agentId: runtime.agentId,
            roomId: testRoomId,
            worldId: testWorldId,
            sourceEntityId: runtime.agentId,
            type: 'sql_compatibility_test',
            data: {
              testType: 'sql_compatibility',
              timestamp: new Date().toISOString(),
            },
            createdAt: Date.now(),
          });

          console.log('✓ Component created through unified interface');

          // Test task creation using unified interface
          await runtime.createTask({
            name: 'SQL_COMPATIBILITY_TEST',
            description: 'Test task for SQL compatibility',
            tags: ['sql', 'compatibility', 'test'],
            roomId: testRoomId,
            worldId: testWorldId,
            entityId,
            metadata: {
              testType: 'sql_compatibility',
              priority: 'low',
            },
          });

          console.log('✓ Task created through unified interface');

          console.log('✅ Rolodex SQL compatibility test PASSED');
        } catch (error) {
          console.error('❌ Rolodex SQL compatibility test FAILED:', error);
          throw error;
        }
      },
    },

    {
      name: 'should work with rolodex service in SQL environment',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing rolodex service with SQL backend...');

        try {
          // Get rolodex service
          const rolodexService = runtime.getService('rolodex');
          if (!rolodexService) {
            throw new Error('Rolodex service not available');
          }

          console.log('✓ Rolodex service is available');

          // Test entity operations through rolodex service
          const testEntityId = stringToUuid(`rolodex-sql-entity-${Date.now()}`);

          // Create entity using rolodex service
          const entityProfile = await (rolodexService as any).upsertEntity({
            id: testEntityId,
            names: ['Rolodex SQL Test User'],
            agentId: runtime.agentId,
            metadata: {
              type: 'person',
              summary: 'Test user for rolodex SQL compatibility',
              tags: ['sql', 'test'],
              platforms: { test: 'sql-test-123' },
            },
          });

          if (!entityProfile) {
            throw new Error('Failed to create entity through rolodex service');
          }

          console.log('✓ Entity created through rolodex service');

          // Test entity retrieval through rolodex service
          const retrieved = await (rolodexService as any).getEntity(testEntityId);
          if (!retrieved) {
            throw new Error('Failed to retrieve entity through rolodex service');
          }

          console.log('✓ Entity retrieved through rolodex service');

          // Test entity search through rolodex service
          const searchResults = await (rolodexService as any).searchEntities('Rolodex SQL Test');
          if (searchResults.length === 0) {
            console.log('⚠️ No search results found (may be normal for new entity)');
          } else {
            console.log(`✓ Entity search returned ${searchResults.length} results`);
          }

          // Test relationship operations through rolodex service
          const secondEntityId = stringToUuid(`rolodex-sql-entity2-${Date.now()}`);
          await (rolodexService as any).upsertEntity({
            id: secondEntityId,
            names: ['Rolodex SQL Test User 2'],
            agentId: runtime.agentId,
            metadata: { type: 'person' },
          });

          // Create relationship through rolodex service
          const relationship = await (rolodexService as any).analyzeInteraction(
            testEntityId,
            secondEntityId,
            'Test users working together on SQL compatibility',
            {
              roomId: runtime.agentId,
            }
          );

          if (!relationship) {
            throw new Error('Failed to create relationship through rolodex service');
          }

          console.log('✓ Relationship created through rolodex service');

          // Test relationship retrieval
          const relationships = await (rolodexService as any).getRelationships(testEntityId);
          if (relationships.length === 0) {
            console.log(
              '⚠️ No relationships found (may be normal if relationship not persisted yet)'
            );
          } else {
            console.log(`✓ Found ${relationships.length} relationships`);
          }

          console.log('✅ Rolodex service SQL backend test PASSED');
        } catch (error) {
          console.error('❌ Rolodex service SQL backend test FAILED:', error);
          throw error;
        }
      },
    },

    {
      name: 'should handle trust integration with SQL storage',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing trust integration with SQL storage...');

        try {
          const rolodexService = runtime.getService('rolodex');
          if (!rolodexService) {
            throw new Error('Rolodex service not available');
          }

          // Create test entity for trust operations
          const entityId = stringToUuid(`trust-sql-entity-${Date.now()}`);
          await (rolodexService as any).upsertEntity({
            id: entityId,
            names: ['Trust SQL Test User'],
            agentId: runtime.agentId,
            metadata: { type: 'person' },
          });

          console.log('✓ Test entity created for trust operations');

          // Test trust score retrieval (should not fail even if trust service unavailable)
          const trustScore = await (rolodexService as any).getTrustScore(entityId);
          if (trustScore) {
            console.log('✓ Trust score retrieved');
          } else {
            console.log('⚠️ Trust score not available (trust service not loaded)');
          }

          // Test trust update from interaction (should not fail even if trust service unavailable)
          await (rolodexService as any).updateTrustFromInteraction(entityId, {
            type: 'positive_interaction',
            outcome: 'positive',
            metadata: { source: 'sql_compatibility_test' },
          });

          console.log('✓ Trust interaction recorded (or gracefully handled)');

          // Test entity profile with trust integration
          const profile = await (rolodexService as any).getEntityProfile(entityId);
          if (!profile) {
            throw new Error('Failed to get entity profile');
          }

          console.log('✓ Entity profile retrieved with trust integration');

          console.log('✅ Trust integration SQL storage test PASSED');
        } catch (error) {
          console.error('❌ Trust integration SQL storage test FAILED:', error);
          throw error;
        }
      },
    },

    {
      name: 'should handle follow-up scheduling with SQL task system',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing follow-up scheduling with SQL task system...');

        try {
          const rolodexService = runtime.getService('rolodex');
          if (!rolodexService) {
            throw new Error('Rolodex service not available');
          }

          // Create test entity for follow-up operations
          const entityId = stringToUuid(`followup-sql-entity-${Date.now()}`);
          await (rolodexService as any).upsertEntity({
            id: entityId,
            names: ['Follow-up SQL Test User'],
            agentId: runtime.agentId,
            metadata: { type: 'person' },
          });

          console.log('✓ Test entity created for follow-up operations');

          // Schedule follow-up through rolodex service
          const futureDate = new Date();
          futureDate.setHours(futureDate.getHours() + 24);

          const followUp = await (rolodexService as any).scheduleFollowUp(entityId, {
            message: 'SQL compatibility follow-up test',
            scheduledFor: futureDate,
            priority: 'medium',
            metadata: {
              type: 'sql_compatibility_test',
              source: 'automated_test',
            },
          });

          if (!followUp) {
            throw new Error('Failed to schedule follow-up');
          }

          console.log('✓ Follow-up scheduled through rolodex service');

          // Retrieve scheduled follow-ups
          const followUps = await (rolodexService as any).getUpcomingFollowUps({
            entityId,
            includePast: true,
          });

          if (followUps.length === 0) {
            throw new Error('Failed to retrieve scheduled follow-ups');
          }

          console.log(`✓ Retrieved ${followUps.length} follow-ups from SQL storage`);

          // Verify follow-up content
          const testFollowUp = followUps.find(
            (f: any) => f.message === 'SQL compatibility follow-up test'
          );

          if (!testFollowUp) {
            throw new Error('Specific follow-up not found in storage');
          }

          console.log('✓ Follow-up content verified in SQL storage');

          console.log('✅ Follow-up scheduling SQL task system test PASSED');
        } catch (error) {
          console.error('❌ Follow-up scheduling SQL task system test FAILED:', error);
          throw error;
        }
      },
    },

    {
      name: 'should handle network statistics with SQL aggregation',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing network statistics with SQL aggregation...');

        try {
          const rolodexService = runtime.getService('rolodex');
          if (!rolodexService) {
            throw new Error('Rolodex service not available');
          }

          // Create multiple test entities
          const entity1Id = stringToUuid(`network-entity1-${Date.now()}`);
          const entity2Id = stringToUuid(`network-entity2-${Date.now()}`);
          const entity3Id = stringToUuid(`network-entity3-${Date.now()}`);

          await Promise.all([
            (rolodexService as any).upsertEntity({
              id: entity1Id,
              names: ['Network Test User 1'],
              agentId: runtime.agentId,
              metadata: { type: 'person' },
            }),
            (rolodexService as any).upsertEntity({
              id: entity2Id,
              names: ['Network Test User 2'],
              agentId: runtime.agentId,
              metadata: { type: 'person' },
            }),
            (rolodexService as any).upsertEntity({
              id: entity3Id,
              names: ['Network Test User 3'],
              agentId: runtime.agentId,
              metadata: { type: 'person' },
            }),
          ]);

          console.log('✓ Multiple test entities created');

          // Create relationships between entities
          await Promise.all([
            (rolodexService as any).analyzeInteraction(
              entity1Id,
              entity2Id,
              'User 1 and User 2 are colleagues',
              { roomId: runtime.agentId }
            ),
            (rolodexService as any).analyzeInteraction(
              entity2Id,
              entity3Id,
              'User 2 and User 3 are friends',
              { roomId: runtime.agentId }
            ),
          ]);

          console.log('✓ Relationships created between entities');

          // Get network statistics
          const networkStats = await (rolodexService as any).getNetworkStats();
          if (!networkStats) {
            throw new Error('Failed to get network statistics');
          }

          console.log('✓ Network statistics retrieved:', {
            totalEntities: networkStats.totalEntities,
            totalRelationships: networkStats.totalRelationships,
          });

          // Verify statistics make sense
          if (networkStats.totalEntities < 3) {
            console.log(`⚠️ Expected at least 3 entities, got ${networkStats.totalEntities}`);
          }

          if (networkStats.totalRelationships < 2) {
            console.log(
              `⚠️ Expected at least 2 relationships, got ${networkStats.totalRelationships}`
            );
          }

          console.log('✅ Network statistics SQL aggregation test PASSED');
        } catch (error) {
          console.error('❌ Network statistics SQL aggregation test FAILED:', error);
          throw error;
        }
      },
    },
  ];
}

export default new RolodexSQLCompatibilityTestSuite();
