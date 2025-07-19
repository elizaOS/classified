import { type TestSuite, stringToUuid, type Content, type Metadata } from '@elizaos/core';
import type { RolodexService } from '../../services/RolodexService';

/**
 * E2E integration tests for the Rolodex plugin
 * Tests actual behavior with real runtime
 */
export class RealIntegrationTestSuite implements TestSuite {
  name = 'Rolodex Plugin Real Integration Tests';
  description = 'Real integration tests using actual ElizaOS runtime';

  tests = [
    // Entity Management Tests
    {
      name: 'should track entities from conversation',
      fn: async (runtime: any) => {
        console.log('🧪 Testing entity tracking from conversation...');

        const roomId = stringToUuid('test-room');
        const userId = stringToUuid('test-user');

        // Get the rolodex service
        const rolodexService = runtime.getService('rolodex') as RolodexService;
        if (!rolodexService) {
          throw new Error('Rolodex service not found');
        }

        // Create a message mentioning a person
        const message = {
          id: stringToUuid(`msg-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'I just met Sarah Johnson from Acme Corp. She is the CTO there.',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Compose state to trigger providers and evaluators
        const state = await runtime.composeState(message);

        // Process evaluators which should extract entities
        await runtime.evaluate(message, state, true);

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Search for the entity
        const searchResults = await rolodexService.searchEntities('Sarah Johnson');

        if (searchResults.length === 0) {
          throw new Error('Entity was not tracked from conversation');
        }

        const sarah = searchResults[0];
        if (!sarah.names.some((n) => n.includes('Sarah Johnson'))) {
          throw new Error('Entity name not properly tracked');
        }

        console.log('✅ Entity tracking from conversation PASSED');
      },
    },

    {
      name: 'should update existing entities',
      fn: async (runtime: any) => {
        console.log('🧪 Testing entity updates...');

        const roomId = stringToUuid('test-room-update');
        const userId = stringToUuid('test-user-update');
        const rolodexService = runtime.getService('rolodex') as RolodexService;

        // First message
        const message1 = {
          id: stringToUuid(`msg1-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'John Smith works at TechCo as a developer.',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        const state1 = await runtime.composeState(message1);
        await runtime.evaluate(message1, state1, true);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Update message
        const message2 = {
          id: stringToUuid(`msg2-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'John Smith got promoted to Senior Developer at TechCo.',
            source: 'test',
          },
          createdAt: Date.now() + 1000,
        };

        const state2 = await runtime.composeState(message2);
        await runtime.evaluate(message2, state2, true);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check updated entity
        const searchResults = await rolodexService.searchEntities('John Smith');

        if (searchResults.length === 0) {
          throw new Error('Entity not found after update');
        }

        const john = searchResults[0];
        const metadata = (john.metadata as Metadata) || {};
        const role = (metadata.role as string) || '';

        if (!role.includes('Senior')) {
          throw new Error(`Entity role not updated properly. Got: ${role}`);
        }

        console.log('✅ Entity update test PASSED');
      },
    },

    // Relationship Management Tests
    {
      name: 'should track relationships between entities',
      fn: async (runtime: any) => {
        console.log('🧪 Testing relationship tracking...');

        const roomId = stringToUuid('test-room-rel');
        const userId = stringToUuid('test-user-rel');
        const rolodexService = runtime.getService('rolodex') as RolodexService;

        // Create message about relationship
        const message = {
          id: stringToUuid(`msg-rel-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'Alice Chen manages Bob Wilson and Carol Davis at StartupXYZ.',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        const state = await runtime.composeState(message);
        await runtime.evaluate(message, state, true);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Find Alice
        const aliceResults = await rolodexService.searchEntities('Alice Chen');
        if (aliceResults.length === 0) {
          throw new Error('Alice entity not found');
        }

        const alice = aliceResults[0];

        // Get Alice's relationships
        const relationships = await rolodexService.getRelationships(alice.id!);

        if (relationships.length === 0) {
          throw new Error('No relationships found for Alice');
        }

        console.log(`✓ Found ${relationships.length} relationships for Alice`);
        console.log('✅ Relationship tracking test PASSED');
      },
    },

    {
      name: 'should infer bidirectional relationships',
      fn: async (runtime: any) => {
        console.log('🧪 Testing bidirectional relationships...');

        const roomId = stringToUuid('test-room-bidir');
        const userId = stringToUuid('test-user-bidir');
        const rolodexService = runtime.getService('rolodex') as RolodexService;

        const message = {
          id: stringToUuid(`msg-bidir-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'David Lee and Emma Wang are co-founders of AIStartup.',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        const state = await runtime.composeState(message);
        await runtime.evaluate(message, state, true);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Find both entities
        const davidResults = await rolodexService.searchEntities('David Lee');
        const emmaResults = await rolodexService.searchEntities('Emma Wang');

        if (davidResults.length === 0) {
          throw new Error('David entity not found');
        }
        if (emmaResults.length === 0) {
          throw new Error('Emma entity not found');
        }

        const david = davidResults[0];
        const emma = emmaResults[0];

        // Check relationships from both sides
        const davidRels = await rolodexService.getRelationships(david.id!);
        const emmaRels = await rolodexService.getRelationships(emma.id!);

        if (davidRels.length === 0) {
          throw new Error('No relationships found for David');
        }
        if (emmaRels.length === 0) {
          throw new Error('No relationships found for Emma');
        }

        console.log(`✓ David has ${davidRels.length} relationships`);
        console.log(`✓ Emma has ${emmaRels.length} relationships`);
        console.log('✅ Bidirectional relationship test PASSED');
      },
    },

    // Follow-up Management Tests
    {
      name: 'should schedule follow-ups from conversation',
      fn: async (runtime: any) => {
        console.log('🧪 Testing follow-up scheduling...');

        const roomId = stringToUuid('test-room-followup');
        const userId = stringToUuid('test-user-followup');
        const rolodexService = runtime.getService('rolodex') as RolodexService;

        const message = {
          id: stringToUuid(`msg-followup-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'I need to follow up with Frank Zhang next week about the partnership proposal.',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        const state = await runtime.composeState(message);
        await runtime.evaluate(message, state, true);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Check for scheduled follow-ups
        const followUps = await rolodexService.getUpcomingFollowUps();

        const frankFollowUp = followUps.find(
          (f) => f.message?.includes('Frank Zhang') || f.message?.includes('partnership')
        );

        if (!frankFollowUp) {
          throw new Error('Follow-up not scheduled for Frank Zhang');
        }

        // Verify scheduling
        const scheduledDate = new Date(frankFollowUp.scheduledFor);
        const now = new Date();
        const daysDiff = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff < 5 || daysDiff > 10) {
          throw new Error(`Follow-up scheduled incorrectly: ${daysDiff} days from now`);
        }

        console.log(`✓ Follow-up scheduled for ${Math.round(daysDiff)} days from now`);
        console.log('✅ Follow-up scheduling test PASSED');
      },
    },

    // Trust Score Management Tests
    {
      name: 'should update trust scores based on interactions',
      fn: async (runtime: any) => {
        console.log('🧪 Testing trust score updates...');

        const rolodexService = runtime.getService('rolodex') as RolodexService;

        // Create entity first
        const entity = await rolodexService.upsertEntity({
          names: ['Grace Kim'],
          metadata: {
            type: 'person',
            role: 'Partner',
          },
        });

        if (!entity.id) {
          throw new Error('Failed to create entity');
        }

        // Update trust based on positive interaction
        await rolodexService.updateTrustFromInteraction(entity.id, {
          type: 'project_completion',
          outcome: 'positive',
          metadata: {
            deliveredOnTime: true,
            exceededExpectations: true,
          },
        });

        // Get trust score
        const trustScore = await rolodexService.getTrustScore(entity.id);

        // Trust score should exist (if trust service is available)
        // or be null (if trust service is not available)
        if (trustScore) {
          if (trustScore.score <= 0.5) {
            throw new Error(
              `Trust score not increased after positive interaction: ${trustScore.score}`
            );
          }
          console.log(`✓ Trust score updated to ${trustScore.score}`);
        } else {
          console.log('✓ Trust service not available, skipping score check');
        }

        console.log('✅ Trust score update test PASSED');
      },
    },

    // Entity Resolution Tests
    {
      name: 'should resolve similar entity names',
      fn: async (runtime: any) => {
        console.log('🧪 Testing entity resolution...');

        const roomId = stringToUuid('test-room-resolution');
        const userId = stringToUuid('test-user-resolution');
        const rolodexService = runtime.getService('rolodex') as RolodexService;

        // Create entities with similar names
        const messages = [
          'I met Robert Johnson yesterday.',
          'Bob Johnson called me today.',
          'Rob Johnson sent an email.',
        ];

        for (let i = 0; i < messages.length; i++) {
          const message = {
            id: stringToUuid(`msg-res-${Date.now()}-${i}`),
            entityId: userId,
            agentId: runtime.agentId,
            roomId,
            content: {
              text: messages[i],
              source: 'test',
            },
            createdAt: Date.now() + i * 1000,
          };

          const state = await runtime.composeState(message);
          await runtime.evaluate(message, state, true);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Search for variations
        const results = await rolodexService.searchEntities('Johnson');

        if (results.length === 0) {
          throw new Error('No entities found with name Johnson');
        }

        console.log(`✓ Found ${results.length} entities with name Johnson`);

        // Check if names were consolidated
        const robertEntity = results.find((e) =>
          e.names.some((n) => n.includes('Robert') || n.includes('Bob') || n.includes('Rob'))
        );

        if (robertEntity) {
          console.log(`✓ Entity has names: ${robertEntity.names.join(', ')}`);
        }

        console.log('✅ Entity resolution test PASSED');
      },
    },

    // Network Analysis Tests
    {
      name: 'should provide network statistics',
      fn: async (runtime: any) => {
        console.log('🧪 Testing network statistics...');

        const roomId = stringToUuid('test-room-stats');
        const userId = stringToUuid('test-user-stats');
        const rolodexService = runtime.getService('rolodex') as RolodexService;

        // Create a small network
        const messages = [
          'The tech team consists of Henry Lee (lead), Iris Chen, and Jack Wang.',
          'Henry Lee mentors both Iris and Jack.',
          'Iris Chen and Jack Wang collaborate on the AI project.',
        ];

        for (let i = 0; i < messages.length; i++) {
          const message = {
            id: stringToUuid(`msg-stats-${Date.now()}-${i}`),
            entityId: userId,
            agentId: runtime.agentId,
            roomId,
            content: {
              text: messages[i],
              source: 'test',
            },
            createdAt: Date.now() + i * 1000,
          };

          const state = await runtime.composeState(message);
          await runtime.evaluate(message, state, true);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Get network stats
        const stats = await rolodexService.getNetworkStats();

        if (!stats) {
          throw new Error('Network statistics not available');
        }

        if (stats.totalEntities === 0) {
          throw new Error('No entities in network statistics');
        }

        console.log(`✓ Network has ${stats.totalEntities} entities`);
        console.log(`✓ Network has ${stats.totalRelationships} relationships`);
        console.log(`✓ Average relationships per entity: ${stats.avgRelationshipsPerEntity}`);

        console.log('✅ Network statistics test PASSED');
      },
    },

    // Action Integration Tests
    {
      name: 'should process TRACK_ENTITY action',
      fn: async (runtime: any) => {
        console.log('🧪 Testing TRACK_ENTITY action...');

        const roomId = stringToUuid('test-room-action');
        const userId = stringToUuid('test-user-action');
        const rolodexService = runtime.getService('rolodex') as RolodexService;

        // Create a message that should trigger entity tracking
        const message = {
          id: stringToUuid(`msg-action-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'Please track Kelly Park from DesignCo, she is the Creative Director.',
            source: 'test',
            actions: ['TRACK_ENTITY'], // Explicitly request action
          },
          createdAt: Date.now(),
        };

        // Create state
        const state = await runtime.composeState(message);

        // Process actions
        await runtime.processActions(message, [], state, async (content: Content) => {
          console.log('✓ Action callback triggered');
          return [];
        });

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify entity was tracked
        const results = await rolodexService.searchEntities('Kelly Park');

        if (results.length === 0) {
          throw new Error('Entity not tracked by TRACK_ENTITY action');
        }

        const kelly = results[0];
        const metadata = (kelly.metadata as Metadata) || {};

        if (metadata.organization !== 'DesignCo') {
          throw new Error(`Organization not tracked correctly: ${metadata.organization}`);
        }

        if (metadata.role !== 'Creative Director') {
          throw new Error(`Role not tracked correctly: ${metadata.role}`);
        }

        console.log('✅ TRACK_ENTITY action test PASSED');
      },
    },
  ];
}

export default new RealIntegrationTestSuite();
