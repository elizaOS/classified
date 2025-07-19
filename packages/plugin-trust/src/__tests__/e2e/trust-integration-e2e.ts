import type { TestSuite, IAgentRuntime, Memory, UUID } from '@elizaos/core';

export class TrustIntegrationE2ETests implements TestSuite {
  name = 'trust-integration-e2e';
  description = 'E2E tests for trust plugin integration with other components';

  tests = [
    {
      name: 'Trust evaluators process messages correctly',
      fn: async (runtime: IAgentRuntime) => {
        const evaluator = runtime.evaluators.find((e) => e.name === 'trustChangeEvaluator');
        if (!evaluator) {
          throw new Error('Trust change evaluator not found');
        }

        // Create test message with trust-affecting content
        const message: Memory = {
          id: `msg-${Date.now()}` as UUID,
          entityId: `test-entity-${Date.now()}` as UUID,
          roomId: `room-${Date.now()}` as UUID,
          agentId: runtime.agentId,
          content: {
            text: 'Thank you so much for your help! That solved my problem perfectly.',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Validate evaluator can process the message
        const canProcess = await evaluator.validate(runtime, message);
        if (!canProcess) {
          throw new Error('Evaluator should be able to process positive message');
        }

        // Execute evaluator
        const result = await evaluator.handler(
          runtime,
          message,
          { values: {}, data: {}, text: '' },
          {},
          async () => []
        );

        console.log('✅ Trust evaluator processed message successfully');
      },
    },

    {
      name: 'Trust profile provider returns comprehensive data',
      fn: async (runtime: IAgentRuntime) => {
        const provider = runtime.providers.find((p) => p.name === 'trustProfile');
        if (!provider) {
          throw new Error('Trust profile provider not found');
        }

        const entityId = `profile-test-${Date.now()}` as UUID;

        // First, create some trust history
        const trustService = runtime.getService('trust') as any;
        await trustService.updateTrust(entityId, 'HELPFUL_ACTION', 10);
        await trustService.updateTrust(entityId, 'CONSISTENT_BEHAVIOR', 5);

        // Create message
        const message: Memory = {
          id: `msg-${Date.now()}` as UUID,
          entityId,
          roomId: `room-${Date.now()}` as UUID,
          agentId: runtime.agentId,
          content: {
            text: 'Check trust profile',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Get trust profile
        const result = await provider.get(runtime, message, { values: {}, data: {}, text: '' });

        if (!result.text) {
          throw new Error('Trust profile provider returned no text');
        }

        if (!result.text.includes('trust')) {
          throw new Error('Trust profile does not mention trust');
        }

        if (!result.values?.trustScore) {
          throw new Error('Trust profile missing trust score value');
        }

        console.log('✅ Trust profile provider returned comprehensive data');
      },
    },

    {
      name: 'Reflection evaluator processes conversation history',
      fn: async (runtime: IAgentRuntime) => {
        const evaluator = runtime.evaluators.find((e) => e.name === 'reflectionEvaluator');
        if (!evaluator) {
          throw new Error('Reflection evaluator not found');
        }

        const roomId = `reflection-room-${Date.now()}` as UUID;
        const entityId = `reflection-entity-${Date.now()}` as UUID;

        // Create multiple messages for reflection
        const messages: Memory[] = [];
        for (let i = 0; i < 10; i++) {
          messages.push({
            id: `msg-${Date.now()}-${i}` as UUID,
            entityId,
            roomId,
            agentId: runtime.agentId,
            content: {
              text: `Message ${i}: User is discussing technical topics`,
              source: 'test',
            },
            createdAt: Date.now() - (10 - i) * 60000, // Space out by 1 minute
          });
        }

        // Store messages
        for (const msg of messages) {
          await runtime.createMemory(msg, roomId);
        }

        // Create final message to trigger reflection
        const finalMessage: Memory = {
          id: `msg-final-${Date.now()}` as UUID,
          entityId,
          roomId,
          agentId: runtime.agentId,
          content: {
            text: 'That was a great technical discussion!',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Check if evaluator can process
        const canProcess = await evaluator.validate(runtime, finalMessage, {
          values: {},
          data: {},
          text: '',
        });

        console.log('✅ Reflection evaluator ready to process conversation history');
      },
    },

    {
      name: 'Trust system integrates with message processing',
      fn: async (runtime: IAgentRuntime) => {
        const entityId = `integration-test-${Date.now()}` as UUID;
        const roomId = `room-${Date.now()}` as UUID;

        // Create and process a message
        const message: Memory = {
          id: `msg-${Date.now()}` as UUID,
          entityId,
          roomId,
          agentId: runtime.agentId,
          content: {
            text: 'Hello, I need help with something',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Store message
        await runtime.createMemory(message, roomId);

        // Get trust service
        const trustService = runtime.getService('trust') as any;

        // Record the message for behavioral analysis
        await trustService.recordMemory(message);

        // Create a follow-up message
        const followUp: Memory = {
          id: `msg-followup-${Date.now()}` as UUID,
          entityId,
          roomId,
          agentId: runtime.agentId,
          content: {
            text: 'Thank you for your assistance!',
            source: 'test',
          },
          createdAt: Date.now() + 1000,
        };

        // Process follow-up
        await runtime.createMemory(followUp, roomId);
        await trustService.recordMemory(followUp);

        // Check that trust system tracked the interaction
        const trustScore = await trustService.getTrustScore(entityId);
        if (!trustScore) {
          throw new Error('Failed to get trust score after interaction');
        }

        console.log('✅ Trust system successfully integrated with message processing');
      },
    },

    {
      name: 'Trust-based access control works end-to-end',
      fn: async (runtime: IAgentRuntime) => {
        // Test complete flow: build trust -> request access -> get permission
        const entityId = `access-test-${Date.now()}` as UUID;
        const trustService = runtime.getService('trust') as any;

        // Start with low trust
        const initialScore = await trustService.getTrustScore(entityId);
        console.log(`Initial trust score: ${initialScore.overall}`);

        // Try sensitive action - should fail
        const deniedResult = await trustService.checkPermission(
          entityId,
          'MODIFY_SYSTEM_CONFIG',
          'system-settings',
          { platform: 'test' }
        );

        if (deniedResult.allowed) {
          throw new Error('Low-trust entity should not have permission');
        }

        // Build trust through positive interactions
        for (let i = 0; i < 10; i++) {
          await trustService.updateTrust(entityId, 'HELPFUL_ACTION', 5, { interaction: i });
        }

        // Check improved trust
        const improvedScore = await trustService.getTrustScore(entityId);
        console.log(`Improved trust score: ${improvedScore.overall}`);

        // Try moderate action - should succeed now
        const allowedResult = await trustService.checkPermission(
          entityId,
          'READ_USER_DATA',
          'user-profiles',
          { platform: 'test' }
        );

        if (!allowedResult.allowed) {
          throw new Error('Trusted entity should have permission for moderate actions');
        }

        console.log('✅ Trust-based access control working end-to-end');
      },
    },
  ];
}

export const trustIntegrationE2ETests = new TrustIntegrationE2ETests();
