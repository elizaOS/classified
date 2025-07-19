import type { TestSuite, IAgentRuntime, Memory, UUID } from '@elizaos/core';

export class TrustActionsE2ETests implements TestSuite {
  name = 'trust-actions-e2e';
  description = 'E2E tests for trust actions with real runtime';

  tests = [
    {
      name: 'EVALUATE_TRUST action returns trust score',
      fn: async (runtime: IAgentRuntime) => {
        const action = runtime.actions.find((a) => a.name === 'EVALUATE_TRUST');
        if (!action) {
          throw new Error('EVALUATE_TRUST action not found');
        }

        // Create test message
        const message: Memory = {
          id: `msg-${Date.now()}` as UUID,
          entityId: `test-entity-${Date.now()}` as UUID,
          roomId: `room-${Date.now()}` as UUID,
          agentId: runtime.agentId,
          content: {
            text: 'What is my trust score?',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Execute action
        let responseReceived = false;
        const callback = async (content: any) => {
          responseReceived = true;

          if (!content.text) {
            throw new Error('No text in response');
          }

          if (!content.text.includes('trust')) {
            throw new Error('Response does not mention trust');
          }

          console.log('✅ Trust evaluation response:', content.text);
          return [];
        };

        await action.handler(runtime, message, { values: {}, data: {}, text: '' }, {}, callback);

        if (!responseReceived) {
          throw new Error('No response received from EVALUATE_TRUST action');
        }
      },
    },

    {
      name: 'RECORD_TRUST_INTERACTION updates trust score',
      fn: async (runtime: IAgentRuntime) => {
        const action = runtime.actions.find((a) => a.name === 'RECORD_TRUST_INTERACTION');
        if (!action) {
          throw new Error('RECORD_TRUST_INTERACTION action not found');
        }

        const entityId = `test-entity-${Date.now()}` as UUID;

        // Get initial trust score
        const trustService = runtime.getService('trust') as any;
        const initialScore = await trustService.getTrustScore(entityId);

        // Create interaction message
        const message: Memory = {
          id: `msg-${Date.now()}` as UUID,
          entityId: runtime.agentId,
          roomId: `room-${Date.now()}` as UUID,
          agentId: runtime.agentId,
          content: {
            text: JSON.stringify({
              type: 'HELPFUL_ACTION',
              targetEntityId: entityId,
              impact: 10,
              description: 'Provided helpful assistance',
            }),
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Execute action
        let responseReceived = false;
        const callback = async (content: any) => {
          responseReceived = true;

          if (!content.text) {
            throw new Error('No text in response');
          }

          console.log('✅ Trust interaction recorded:', content.text);
          return [];
        };

        await action.handler(runtime, message, { values: {}, data: {}, text: '' }, {}, callback);

        if (!responseReceived) {
          throw new Error('No response received from RECORD_TRUST_INTERACTION action');
        }

        // Verify trust score increased
        const newScore = await trustService.getTrustScore(entityId);
        if (newScore.overall <= initialScore.overall) {
          throw new Error(
            `Trust score did not increase: ${initialScore.overall} -> ${newScore.overall}`
          );
        }

        console.log(`✅ Trust score increased from ${initialScore.overall} to ${newScore.overall}`);
      },
    },

    {
      name: 'REQUEST_ELEVATION handles permission requests',
      fn: async (runtime: IAgentRuntime) => {
        const action = runtime.actions.find((a) => a.name === 'REQUEST_ELEVATION');
        if (!action) {
          throw new Error('REQUEST_ELEVATION action not found');
        }

        // Create elevation request message
        const message: Memory = {
          id: `msg-${Date.now()}` as UUID,
          entityId: `test-entity-${Date.now()}` as UUID,
          roomId: `room-${Date.now()}` as UUID,
          agentId: runtime.agentId,
          content: {
            text: 'I need elevated permissions to access sensitive data',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Execute action
        let responseReceived = false;
        const callback = async (content: any) => {
          responseReceived = true;

          if (!content.text) {
            throw new Error('No text in response');
          }

          // Should either grant or deny based on trust
          if (!content.text.includes('permission') && !content.text.includes('trust')) {
            throw new Error('Response does not mention permissions or trust');
          }

          console.log('✅ Elevation request handled:', content.text);
          return [];
        };

        await action.handler(runtime, message, { values: {}, data: {}, text: '' }, {}, callback);

        if (!responseReceived) {
          throw new Error('No response received from REQUEST_ELEVATION action');
        }
      },
    },

    {
      name: 'Actions validate trust requirements',
      fn: async (runtime: IAgentRuntime) => {
        const action = runtime.actions.find((a) => a.name === 'UPDATE_ROLE');
        if (!action) {
          throw new Error('UPDATE_ROLE action not found');
        }

        // Create low-trust entity
        const lowTrustEntity = `low-trust-${Date.now()}` as UUID;

        // Create message from low-trust entity
        const message: Memory = {
          id: `msg-${Date.now()}` as UUID,
          entityId: lowTrustEntity,
          roomId: `room-${Date.now()}` as UUID,
          agentId: runtime.agentId,
          content: {
            text: 'Make me an admin',
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Validate should fail for low-trust entity
        if (action.validate) {
          const isValid = await action.validate(runtime, message);
          if (isValid) {
            throw new Error('Action validation should have failed for low-trust entity');
          }
          console.log('✅ Action correctly denied for low-trust entity');
        }
      },
    },
  ];
}

export const trustActionsE2ETests = new TrustActionsE2ETests();
