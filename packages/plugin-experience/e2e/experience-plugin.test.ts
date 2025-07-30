import type { TestSuite, IAgentRuntime } from '@elizaos/core';
import { experiencePlugin, ExperienceService } from '../src';

export class ExperiencePluginTestSuite implements TestSuite {
  name = 'plugin_experience_test_suite';

  tests = [
    {
      name: 'experience_service_initialization',
      fn: async (runtime: IAgentRuntime) => {
        // Test if the experience service is available
        const experienceService = runtime.getService('EXPERIENCE') as ExperienceService;
        if (!experienceService) {
          throw new Error('Experience service not found');
        }

        // Verify service has required methods
        if (!experienceService.recordExperience || !experienceService.queryExperiences) {
          throw new Error('Experience service missing required methods');
        }

        console.log('[TEST] Experience service initialized successfully');
      },
    },
    {
      name: 'experience_recording',
      fn: async (runtime: IAgentRuntime) => {
        const experienceService = runtime.getService('EXPERIENCE') as ExperienceService;
        if (!experienceService) {
          throw new Error('Experience service not found');
        }

        // Record a test experience
        const testExperience = {
          learning: 'I learned that tests should use unique ports to avoid conflicts',
          context: 'During test development',
          action: 'running tests',
          result: 'discovered port conflicts',
        };

        await experienceService.recordExperience(testExperience);
        console.log('[TEST] Experience recorded successfully');

        // Verify the experience was recorded
        const experiences = await experienceService.queryExperiences({
          limit: 10,
        });

        const recordedExperience = experiences.find((exp) =>
          exp.learning?.includes('tests should use unique ports')
        );

        if (!recordedExperience) {
          throw new Error('Recorded experience not found');
        }

        console.log('[TEST] Experience retrieval verified');
      },
    },
    {
      name: 'experience_evaluator_trigger',
      fn: async (runtime: IAgentRuntime) => {
        // Test that the evaluator triggers on learning keywords
        const testMessage = {
          agentId: runtime.agentId,
          content: {
            text: 'I just learned something new about testing ports',
          },
          roomId: 'test-room',
        };

        const evaluator = experiencePlugin.evaluators?.find(
          (e) => e.name === 'EXPERIENCE_EVALUATOR'
        );

        if (!evaluator) {
          throw new Error('Experience evaluator not found');
        }

        const shouldTrigger = await evaluator.validate(runtime, testMessage as any);
        if (!shouldTrigger) {
          throw new Error('Evaluator should trigger on learning keywords');
        }

        console.log('[TEST] Experience evaluator validation passed');
      },
    },
    {
      name: 'experience_provider_output',
      fn: async (runtime: IAgentRuntime) => {
        const provider = experiencePlugin.providers?.find((p) => p.name === 'EXPERIENCES');

        if (!provider) {
          throw new Error('Experience provider not found');
        }

        const state = {
          entityId: runtime.agentId,
          roomId: 'test-room',
        };

        const result = await provider.get(runtime, null as any, state as any);

        if (!result || (!result.text && !result.values)) {
          throw new Error('Provider should return experience data');
        }

        console.log('[TEST] Experience provider output verified');
      },
    },
  ];
}

export default new ExperiencePluginTestSuite();
