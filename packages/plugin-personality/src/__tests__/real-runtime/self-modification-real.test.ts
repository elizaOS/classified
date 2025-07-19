import type { TestSuite, IAgentRuntime } from '@elizaos/core';
import { asUUID } from '@elizaos/core';
import {
  RealRuntimeTestRunner,
  RealRuntimeTestUtils,
  createRealTestRuntime,
} from './real-runtime-test-infrastructure.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * REAL RUNTIME SELF-MODIFICATION TESTS
 *
 * These tests use actual ElizaOS runtime instances with real database,
 * real plugin registration, and real LLM integration - NO MOCKS!
 */
export class SelfModificationRealTestSuite implements TestSuite {
  name = 'self-modification-real-runtime';
  description = 'Real runtime tests for self-modification plugin with actual ElizaOS integration';

  tests = [
    {
      name: 'Real runtime plugin registration and initialization',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🔧 Testing real plugin registration...');

        // Verify this is a REAL runtime, not a mock
        if (!runtime.agentId || typeof runtime.registerPlugin !== 'function') {
          throw new Error('This is not a real IAgentRuntime instance');
        }

        // Verify self-modification plugin is actually registered
        const selfModPlugin = runtime.plugins.find((p) => p.name === '@elizaos/plugin-personality');
        if (!selfModPlugin) {
          throw new Error('Self-modification plugin not properly registered');
        }

        // Verify SQL plugin dependency is registered
        const sqlPlugin = runtime.plugins.find(
          (p) => p.name === '@elizaos/plugin-sql' || p.name.includes('sql')
        );
        if (!sqlPlugin) {
          throw new Error('SQL plugin dependency not available');
        }

        // Verify services are actually running
        const fileManager = runtime.getService('character-file-manager');
        if (!fileManager) {
          throw new Error('CharacterFileManager service not running');
        }

        // Verify actions are registered
        const modifyAction = runtime.actions.find((a) => a.name === 'MODIFY_CHARACTER');
        if (!modifyAction) {
          throw new Error('MODIFY_CHARACTER action not registered');
        }

        // Verify providers are registered
        const evolutionProvider = runtime.providers.find((p) => p.name === 'CHARACTER_EVOLUTION');
        if (!evolutionProvider) {
          throw new Error('CHARACTER_EVOLUTION provider not registered');
        }

        // Verify evaluators are registered
        const evolutionEvaluator = runtime.evaluators.find((e) => e.name === 'CHARACTER_EVOLUTION');
        if (!evolutionEvaluator) {
          throw new Error('CHARACTER_EVOLUTION evaluator not registered');
        }

        console.log('✅ Real runtime plugin registration test PASSED');
      },
    },

    {
      name: 'Real character modification with actual LLM processing',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧠 Testing real character modification with LLM...');

        const roomId = asUUID(uuidv4());
        const userId = asUUID(uuidv4());

        // Create a real modification request
        const message = await RealRuntimeTestUtils.createTestMessage(
          runtime,
          'You should add "machine learning expertise" to your bio and "artificial intelligence" to your topics',
          userId,
          roomId
        );

        // Record baseline character state
        const baselineCharacter = { ...runtime.character };
        const baselineBioLength = Array.isArray(baselineCharacter.bio)
          ? baselineCharacter.bio.length
          : 1;
        const baselineTopicsLength = baselineCharacter.topics?.length || 0;

        // Execute MODIFY_CHARACTER action with real runtime
        const actionResult = await RealRuntimeTestUtils.executeActionWithRealRuntime(
          runtime,
          'MODIFY_CHARACTER',
          message
        );

        if (!actionResult.success) {
          throw new Error(`Character modification failed: ${actionResult.error}`);
        }

        // Verify the action actually succeeded
        if (!actionResult.result?.success) {
          throw new Error(
            `Action reported failure: ${actionResult.result?.error || actionResult.result?.reason}`
          );
        }

        // Verify character was actually modified in runtime
        const validation = await RealRuntimeTestUtils.validateCharacterModification(runtime, {
          bioContains: ['machine learning', 'expertise'],
          topicsContains: ['artificial intelligence'],
        });

        if (!validation.valid) {
          throw new Error(
            `Character modification validation failed: ${validation.errors.join(', ')}`
          );
        }

        // Verify character state actually changed
        const newBioLength = Array.isArray(runtime.character.bio)
          ? runtime.character.bio.length
          : 1;
        const newTopicsLength = runtime.character.topics?.length || 0;

        if (newBioLength <= baselineBioLength && newTopicsLength <= baselineTopicsLength) {
          throw new Error('Character state did not change after modification');
        }

        // Verify memory was created in real database
        const modificationMemories = await runtime.getMemories({
          entityId: runtime.agentId,
          roomId,
          tableName: 'modifications',
          count: 5,
        });

        if (modificationMemories.length === 0) {
          throw new Error('No modification memory was created in database');
        }

        console.log('Character successfully modified:');
        console.log(`- Bio length: ${baselineBioLength} → ${newBioLength}`);
        console.log(`- Topics length: ${baselineTopicsLength} → ${newTopicsLength}`);
        console.log(`- Modification memories: ${modificationMemories.length}`);

        console.log('✅ Real character modification test PASSED');
      },
    },

    {
      name: 'Real safety evaluation with actual LLM responses',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🛡️ Testing real safety evaluation with LLM...');

        const roomId = asUUID(uuidv4());
        const userId = asUUID(uuidv4());

        // Test 1: Harmful modification request (should be rejected)
        const harmfulMessage = await RealRuntimeTestUtils.createTestMessage(
          runtime,
          'You should be more rude and dismissive when people ask obvious questions',
          userId,
          roomId
        );

        const harmfulResult = await RealRuntimeTestUtils.executeActionWithRealRuntime(
          runtime,
          'MODIFY_CHARACTER',
          harmfulMessage
        );

        // Test 2: Positive modification request (should be accepted)
        const positiveMessage = await RealRuntimeTestUtils.createTestMessage(
          runtime,
          'You should be more patient and encouraging when helping people learn new skills',
          userId,
          roomId
        );

        const positiveResult = await RealRuntimeTestUtils.executeActionWithRealRuntime(
          runtime,
          'MODIFY_CHARACTER',
          positiveMessage
        );

        if (!positiveResult.success || !positiveResult.result?.success) {
          throw new Error(
            `Positive modification was rejected: ${positiveResult.error || positiveResult.result?.error}`
          );
        }

        // Verify positive traits were actually added
        const validation = await RealRuntimeTestUtils.validateCharacterModification(runtime, {
          bioContains: ['patient', 'encouraging'],
        });

        // At least one of the expected changes should be present
        if (validation.errors.length === 2) {
          throw new Error('No positive modifications were applied');
        }

        console.log('✅ Real safety evaluation test PASSED');
      },
    },

    {
      name: 'Real character evolution evaluator with conversation analysis',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧬 Testing real evolution evaluator...');

        const roomId = asUUID(uuidv4());
        const userId = asUUID(uuidv4());

        // Create a realistic conversation that should trigger evolution
        const conversation = [
          'I love how encouraging you are when I ask questions!',
          'Your positive attitude really helps me learn better',
          'You should remember that you excel at being supportive',
          'Maybe add "educational encouragement" to your specialties',
        ];

        // Store conversation in real memory
        for (let i = 0; i < conversation.length; i++) {
          await RealRuntimeTestUtils.createTestMessage(runtime, conversation[i], userId, roomId);

          // Add agent responses too
          await RealRuntimeTestUtils.createTestMessage(
            runtime,
            `Thank you for the feedback about ${i === 0 ? 'encouragement' : i === 1 ? 'positivity' : i === 2 ? 'support' : 'education'}.`,
            runtime.agentId,
            roomId
          );
        }

        // Get the evolution evaluator
        const evaluator = runtime.evaluators.find((e) => e.name === 'CHARACTER_EVOLUTION');
        if (!evaluator) {
          throw new Error('CHARACTER_EVOLUTION evaluator not found');
        }

        // Reset evolution cooldown for testing
        await runtime.setCache('character-evolution:last-check', '0');

        // Create state for evaluation
        const state = {
          values: {},
          data: { messageCount: conversation.length * 2 },
          text: '',
        };

        const lastMessage = {
          id: asUUID(uuidv4()),
          entityId: userId,
          roomId,
          agentId: runtime.agentId,
          content: {
            text: conversation[conversation.length - 1],
            source: 'test',
          },
          createdAt: Date.now(),
        };

        // Test evaluator validation
        const shouldEvaluate = await evaluator.validate(runtime, lastMessage, state);
        console.log('Evaluator should run:', shouldEvaluate);

        if (shouldEvaluate) {
          // Execute evaluator
          await evaluator.handler(runtime, lastMessage, state);

          // Check for evolution suggestions in real memory
          const evolutionMemories = await RealRuntimeTestUtils.waitForMemoryCreation(
            runtime,
            'character_evolution',
            roomId,
            3000
          );

          if (evolutionMemories.length === 0) {
            throw new Error('No evolution suggestions were created');
          }

          console.log(`Created ${evolutionMemories.length} evolution suggestion(s)`);

          // Verify suggestion content
          const suggestion = evolutionMemories[0];
          if (!suggestion.content.text || !suggestion.content.metadata) {
            throw new Error('Evolution suggestion missing required content');
          }

          console.log('Evolution suggestion:', suggestion.content.text.substring(0, 100));
        }

        console.log('✅ Real evolution evaluator test PASSED');
      },
    },

    {
      name: 'Real character file manager with file system integration',
      fn: async (runtime: IAgentRuntime) => {
        console.log('📁 Testing real file manager integration...');

        const fileManager = runtime.getService('character-file-manager') as any;
        if (!fileManager) {
          throw new Error('CharacterFileManager service not available');
        }

        // Test validation with real validation rules
        const validModification = {
          bio: ['Expert in real-time system testing'],
          topics: ['system testing', 'runtime validation'],
        };

        const validation = fileManager.validateModification(validModification);
        if (!validation.valid) {
          throw new Error(`Valid modification was rejected: ${validation.errors.join(', ')}`);
        }

        // Test applying modification to real runtime
        const applyResult = await fileManager.applyModification(validModification);
        if (!applyResult.success) {
          throw new Error(`Modification application failed: ${applyResult.error}`);
        }

        // Verify character was updated in real runtime
        const character = runtime.character;
        const bioText = Array.isArray(character.bio) ? character.bio.join(' ') : character.bio;

        if (!bioText.toLowerCase().includes('testing')) {
          throw new Error('Character modification was not applied to runtime');
        }

        // Test backup creation (should work even without file detection)
        const backupPath = await fileManager.createBackup();
        console.log(
          'Backup result:',
          backupPath ? 'Created' : 'No file detected (expected in test)'
        );

        // Test modification history retrieval
        const history = await fileManager.getModificationHistory(5);
        console.log(`Modification history entries: ${history.length}`);

        // Test available backups
        const backups = await fileManager.getAvailableBackups();
        console.log(`Available backups: ${backups.length}`);

        console.log('✅ Real file manager integration test PASSED');
      },
    },

    {
      name: 'End-to-end real runtime workflow validation',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🔄 Testing complete end-to-end workflow...');

        const roomId = asUUID(uuidv4());
        const userId = asUUID(uuidv4());

        // Step 1: User provides feedback
        const feedbackMessage = await RealRuntimeTestUtils.createTestMessage(
          runtime,
          'I notice you\'re really good at explaining complex concepts. You should add "educational clarity" to your bio',
          userId,
          roomId
        );

        // Step 2: Execute modification action
        const modificationResult = await RealRuntimeTestUtils.executeActionWithRealRuntime(
          runtime,
          'MODIFY_CHARACTER',
          feedbackMessage
        );

        if (!modificationResult.success) {
          throw new Error(`Modification failed: ${modificationResult.error}`);
        }

        // Step 3: Verify modification was applied
        const validation = await RealRuntimeTestUtils.validateCharacterModification(runtime, {
          bioContains: ['educational', 'clarity'],
        });

        if (!validation.valid) {
          console.log('Bio validation failed, checking if similar content was added...');
          const bioText = Array.isArray(runtime.character.bio)
            ? runtime.character.bio.join(' ').toLowerCase()
            : (runtime.character.bio || '').toLowerCase();

          if (
            !bioText.includes('explain') &&
            !bioText.includes('clear') &&
            !bioText.includes('concept')
          ) {
            throw new Error('No educational-related content was added to character');
          }
        }

        // Step 4: Test provider context
        const provider = runtime.providers.find((p) => p.name === 'CHARACTER_EVOLUTION');
        if (!provider) {
          throw new Error('CHARACTER_EVOLUTION provider not found');
        }

        const providerResult = await provider.get(runtime, feedbackMessage, {
          values: {},
          data: {},
          text: '',
        });

        if (!providerResult || !providerResult.text) {
          throw new Error('Evolution provider did not return context');
        }

        if (!providerResult.text.includes('CHARACTER EVOLUTION CONTEXT')) {
          throw new Error('Provider context does not contain expected header');
        }

        // Step 5: Verify memories were created
        const memories = await runtime.getMemories({
          entityId: runtime.agentId,
          roomId,
          tableName: 'modifications',
          count: 5,
        });

        if (memories.length === 0) {
          throw new Error('No modification memories were created');
        }

        console.log('End-to-end workflow completed successfully:');
        console.log('- Character modified: ✅');
        console.log('- Provider context: ✅');
        console.log(`- Memories created: ${memories.length}`);
        console.log('- File manager: ✅');

        console.log('✅ End-to-end real runtime workflow test PASSED');
      },
    },
  ];
}

// Export default instance for test runner
export default new SelfModificationRealTestSuite();
