import type { TestSuite, IAgentRuntime, UUID } from '@elizaos/core';
import trustPlugin from '../../index';

export class TrustPluginE2ETests implements TestSuite {
  name = 'trust-plugin-e2e';
  description = 'E2E tests for trust plugin initialization and basic functionality';

  tests = [
    {
      name: 'Trust plugin initializes successfully',
      fn: async (runtime: IAgentRuntime) => {
        // Note: The plugin should already be initialized by the test runner
        // We're just verifying the services are available

        // Verify trust service is available
        const trustService = runtime.getService('trust');
        if (!trustService) {
          throw new Error('Trust service not initialized');
        }

        // Verify trust database service is available
        const trustDbService = runtime.getService('trust-database');
        if (!trustDbService) {
          throw new Error('Trust database service not initialized');
        }

        console.log('✅ Trust plugin initialized successfully');
      },
    },

    {
      name: 'Trust plugin registers all actions',
      fn: async (runtime: IAgentRuntime) => {
        // Verify all expected actions are registered
        const expectedActions = [
          'EVALUATE_TRUST',
          'RECORD_TRUST_INTERACTION',
          'REQUEST_ELEVATION',
          'UPDATE_ROLE',
          'UPDATE_TRUST_SETTINGS',
        ];

        for (const actionName of expectedActions) {
          const action = runtime.actions.find((a) => a.name === actionName);
          if (!action) {
            throw new Error(`Action ${actionName} not found`);
          }
        }

        console.log('✅ All trust actions registered successfully');
      },
    },

    {
      name: 'Trust plugin registers all providers',
      fn: async (runtime: IAgentRuntime) => {
        // Verify all expected providers are registered
        const expectedProviders = ['trustProfile', 'securityStatus', 'roleProvider'];

        for (const providerName of expectedProviders) {
          const provider = runtime.providers.find((p) => p.name === providerName);
          if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
          }
        }

        console.log('✅ All trust providers registered successfully');
      },
    },

    {
      name: 'Trust plugin registers evaluators',
      fn: async (runtime: IAgentRuntime) => {
        // Verify evaluators are registered
        const expectedEvaluators = ['trustChangeEvaluator', 'reflectionEvaluator'];

        for (const evaluatorName of expectedEvaluators) {
          const evaluator = runtime.evaluators.find((e) => e.name === evaluatorName);
          if (!evaluator) {
            throw new Error(`Evaluator ${evaluatorName} not found`);
          }
        }

        console.log('✅ All trust evaluators registered successfully');
      },
    },

    {
      name: 'Trust service provides basic functionality',
      fn: async (runtime: IAgentRuntime) => {
        const trustService = runtime.getService('trust') as any;
        if (!trustService || !trustService.trustService) {
          throw new Error('Trust service not available');
        }

        const trustService = trustService.trustService;

        // Test getting trust score for a new entity
        const entityId = `test-entity-${Date.now()}` as UUID;
        const trustScore = await trustService.getTrustScore(entityId);

        if (!trustScore) {
          throw new Error('Failed to get trust score');
        }

        if (trustScore.overall !== 50) {
          throw new Error(`Expected default trust score of 50, got ${trustScore.overall}`);
        }

        if (!trustScore.dimensions) {
          throw new Error('Trust score missing dimensions');
        }

        console.log('✅ Trust service basic functionality working');
      },
    },
  ];
}

export const trustPluginE2ETests = new TrustPluginE2ETests();
