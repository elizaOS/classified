import { type TestSuite, type IAgentRuntime, stringToUuid } from '@elizaos/core';
import type { EntityGraphManager } from '../../managers/EntityGraphManager';
import type { FollowUpManager } from '../../managers/FollowUpManager';
import type { FollowUp } from '../../types';

/**
 * Comprehensive E2E test suite for the Rolodex plugin
 * These tests validate real functionality with actual ElizaOS runtime
 */
export class RolodexPluginE2ETestSuite implements TestSuite {
  name = 'Rolodex Plugin E2E Tests';
  description = 'End-to-end tests validating the complete Rolodex plugin functionality';

  tests = [
    {
      name: 'Complete entity management workflow',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing complete entity management workflow...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        const followUpService = runtime.getService('followUp') as unknown as FollowUpManager;

        if (!entityGraphService || !followUpService) {
          throw new Error('Required services not available');
        }

        // 1. Track a new entity from conversation
        const roomId = stringToUuid(`test-room-${Date.now()}`);
        const userId = stringToUuid(`test-user-${Date.now()}`);

        const introMessage = {
          id: stringToUuid(`msg-intro-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'I just had a meeting with Alice Johnson from TechCorp. She is the CTO and is interested in our AI solutions for their customer service department.',
          },
          createdAt: Date.now(),
        };

        await (runtime as any).processMessage(introMessage);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for processing

        // 2. Verify entity was tracked
        const searchResults = await entityGraphService.searchEntities('Alice Johnson', {
          limit: 10,
        });

        if (searchResults.length === 0) {
          throw new Error('Entity was not tracked from conversation');
        }

        const alice = searchResults[0].entity;
        console.log(`✓ Tracked entity: ${alice.names.join(', ')}`);

        // 3. Track another entity and create relationship
        const secondMessage = {
          id: stringToUuid(`msg-second-${Date.now()}`),
          entityId: userId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: 'Alice introduced me to Bob Smith, her technical lead who will be handling the implementation.',
          },
          createdAt: Date.now() + 1000,
        };

        await (runtime as any).processMessage(secondMessage);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 4. Verify relationship was created
        const relationships = await entityGraphService.getEntityRelationships(alice.entityId);

        if (relationships.length === 0) {
          console.warn('⚠️ No relationships found - relationship extraction may need improvement');
        } else {
          console.log(`✓ Found ${relationships.length} relationships`);
        }

        // 5. Schedule a follow-up
        const followUp = await followUpService.scheduleFollowUp(
          alice.entityId,
          'Follow up on AI solution proposal for customer service',
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
          {
            priority: 'high',
            opportunity: 'Enterprise AI deployment',
            company: 'TechCorp',
          }
        );

        console.log(
          `✓ Scheduled follow-up for ${new Date(followUp.scheduledFor).toLocaleDateString()}`
        );

        // 6. Test entity search
        const techCorpSearch = await entityGraphService.searchEntities('TechCorp', {
          limit: 10,
        });

        if (techCorpSearch.length < 1) {
          throw new Error('Could not find entities related to TechCorp');
        }

        console.log(`✓ Found ${techCorpSearch.length} entities related to TechCorp`);

        // 7. Update trust score based on interaction
        await entityGraphService.updateTrust(alice.entityId, {
          type: 'positive-interaction',
          impact: 0.1,
          reason: 'Productive meeting with clear next steps',
          metadata: {
            interaction: 'initial-meeting',
            outcome: 'positive',
          },
        });

        console.log('✓ Updated trust score based on interaction');

        // 8. Get upcoming follow-ups
        const upcomingFollowUps = await followUpService.getFollowUps(alice.entityId);

        if (!upcomingFollowUps.some((f: FollowUp) => f.id === followUp.id)) {
          throw new Error('Follow-up not found in upcoming list');
        }

        console.log(`✓ Retrieved ${upcomingFollowUps.length} upcoming follow-ups`);

        console.log('✅ Complete entity management workflow PASSED');
      },
    },

    {
      name: 'Natural language entity extraction',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing natural language entity extraction...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        const roomId = stringToUuid(`test-room-nlp-${Date.now()}`);
        const userId = stringToUuid(`test-user-nlp-${Date.now()}`);

        // Complex conversation with multiple entities
        const messages = [
          'Met with the team from StartupXYZ today. Their CEO Emma Wilson and CTO David Chen presented their new blockchain platform.',
          'Emma mentioned they recently raised $5M in Series A funding led by Venture Partners.',
          'David used to work at Google before co-founding StartupXYZ with Emma.',
          'They are looking for AI integration partners and want to schedule a follow-up next month.',
        ];

        for (const [index, text] of messages.entries()) {
          const message = {
            id: stringToUuid(`msg-nlp-${index}-${Date.now()}`),
            entityId: userId,
            agentId: runtime.agentId,
            roomId,
            content: { text },
            createdAt: Date.now() + index * 1000,
          };

          await (runtime as any).processMessage(message);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        // Verify entities were extracted
        const entities = await entityGraphService.searchEntities('StartupXYZ', {
          limit: 20,
        });

        const entityNames = entities.flatMap((e) => e.entity.names);
        console.log(`✓ Extracted entities: ${entityNames.join(', ')}`);

        // Check for specific entities
        const expectedEntities = ['Emma Wilson', 'David Chen', 'StartupXYZ', 'Venture Partners'];
        const foundEntities = expectedEntities.filter((name) =>
          entityNames.some((en) => en.toLowerCase().includes(name.toLowerCase()))
        );

        if (foundEntities.length < 2) {
          throw new Error(
            `Only found ${foundEntities.length} of ${expectedEntities.length} expected entities`
          );
        }

        console.log(
          `✓ Successfully extracted ${foundEntities.length} entities from natural language`
        );

        // Check for relationships
        const emmaSearch = entities.find((e) =>
          e.entity.names.some((n) => n.toLowerCase().includes('emma'))
        );

        if (emmaSearch) {
          const relationships = await entityGraphService.getEntityRelationships(
            emmaSearch.entity.entityId
          );
          console.log(`✓ Found ${relationships.length} relationships for Emma Wilson`);
        }

        console.log('✅ Natural language entity extraction PASSED');
      },
    },

    {
      name: 'Trust score evolution',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing trust score evolution...');

        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;
        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        const roomId = stringToUuid(`test-room-trust-${Date.now()}`);
        const userId = stringToUuid(`test-user-trust-${Date.now()}`);
        const suspectId = stringToUuid(`suspect-${Date.now()}`);

        // Track a potentially suspicious entity
        const suspectProfile = await entityGraphService.trackEntity(
          suspectId,
          'Met someone calling themselves John Crypto who claims to have a guaranteed 1000% return investment opportunity.',
          {
            roomId,
            source: userId,
          }
        );

        const initialTrust = suspectProfile.trustScore || 0.5;
        console.log(`✓ Initial trust score: ${initialTrust}`);

        // Simulate suspicious behavior
        const suspiciousMessages = [
          {
            id: stringToUuid(`msg-sus-1-${Date.now()}`),
            entityId: suspectId,
            agentId: runtime.agentId,
            roomId,
            content: {
              text: 'You need to send the money right now or you will miss this opportunity forever!',
            },
            createdAt: Date.now(),
          },
          {
            id: stringToUuid(`msg-sus-2-${Date.now()}`),
            entityId: suspectId,
            agentId: runtime.agentId,
            roomId,
            content: {
              text: 'Trust me, I have inside information. Just send crypto to this address: 1A2B3C4D5E6F',
            },
            createdAt: Date.now() + 1000,
          },
        ];

        // Analyze behavior
        const trustEvent = await entityGraphService.analyzeTrustFromBehavior(
          suspectId,
          suspiciousMessages
        );

        if (!trustEvent) {
          console.warn('⚠️ No trust event generated from suspicious behavior');
        } else {
          console.log(`✓ Trust impact: ${trustEvent.impact} (${trustEvent.reason})`);
        }

        // Get updated profile
        const updatedProfile = await entityGraphService.trackEntity(
          suspectId,
          'Checking trust score',
          { updateExisting: false }
        );

        const finalTrust = updatedProfile.trustScore || 0.5;
        console.log(`✓ Final trust score: ${finalTrust}`);

        if (finalTrust >= initialTrust) {
          console.warn('⚠️ Trust score did not decrease for suspicious behavior');
        }

        console.log('✅ Trust score evolution test completed');
      },
    },

    {
      name: 'Follow-up task management',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing follow-up task management...');

        const followUpService = runtime.getService('followUp') as unknown as FollowUpManager;
        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;

        if (!followUpService || !entityGraphService) {
          throw new Error('Required services not available');
        }

        // Create test entity
        const entityId = stringToUuid(`followup-test-${Date.now()}`);
        await entityGraphService.trackEntity(
          entityId,
          'Important client: Sarah Martinez from GlobalTech',
          {}
        );

        // Schedule multiple follow-ups
        const followUps = [
          {
            message: 'Send proposal document',
            scheduledFor: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
            priority: 'high',
          },
          {
            message: 'Check on proposal review',
            scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
            priority: 'medium',
          },
          {
            message: 'Schedule implementation meeting',
            scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
            priority: 'low',
          },
        ];

        const createdFollowUps: FollowUp[] = [];
        for (const followUp of followUps) {
          const created = await followUpService.scheduleFollowUp(
            entityId,
            followUp.message,
            followUp.scheduledFor,
            { priority: followUp.priority }
          );
          createdFollowUps.push(created);
          console.log(
            `✓ Scheduled: ${followUp.message} for ${followUp.scheduledFor.toLocaleDateString()}`
          );
        }

        // Get upcoming follow-ups
        const upcoming = await followUpService.getFollowUps(entityId);

        if (upcoming.length !== followUps.length) {
          throw new Error(`Expected ${followUps.length} follow-ups, found ${upcoming.length}`);
        }

        // Complete the first follow-up
        await followUpService.completeFollowUp(createdFollowUps[0].id);

        console.log('✓ Completed first follow-up');

        // Verify completion
        const remainingFollowUps = await followUpService.getFollowUps(entityId);

        if (remainingFollowUps.length !== followUps.length - 1) {
          throw new Error('Follow-up was not properly marked as completed');
        }

        console.log(`✓ ${remainingFollowUps.length} follow-ups remaining`);
        console.log('✅ Follow-up task management PASSED');
      },
    },
  ];
}

export default new RolodexPluginE2ETestSuite();
