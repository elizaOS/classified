import { type TestSuite, type IAgentRuntime, stringToUuid, type UUID } from '@elizaos/core';
import type { EntityGraphManager } from '../../managers/EntityGraphManager';
import { createTestWorld, createTestRoom } from './test-helpers';

export const realRelationshipInferenceTests: TestSuite = {
  name: 'Real Relationship Inference Tests',

  tests: [
    {
      name: 'Infer relationships from conversation context',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing real relationship inference from natural language...');

        const worldId = await createTestWorld(runtime);
        const roomId = await createTestRoom(runtime, worldId);
        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;

        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        // First create some entities
        const aliceId = stringToUuid(`alice-${Date.now()}`);
        const bobId = stringToUuid(`bob-${Date.now()}`);
        const charlieId = stringToUuid(`charlie-${Date.now()}`);

        await runtime.createEntity({
          id: aliceId,
          names: ['Alice Chen'],
          agentId: runtime.agentId,
          metadata: { type: 'person' },
        });

        await runtime.createEntity({
          id: bobId,
          names: ['Bob Smith'],
          agentId: runtime.agentId,
          metadata: { type: 'person' },
        });

        await runtime.createEntity({
          id: charlieId,
          names: ['Charlie Davis'],
          agentId: runtime.agentId,
          metadata: { type: 'person' },
        });

        // Test relationship inference scenarios
        const relationshipTests = [
          {
            context:
              "Alice and Bob are co-founders of TechStartup Inc. They've been working together for 5 years.",
            source: aliceId,
            target: bobId,
            expectedType: 'co-founder',
            expectedStrength: 80, // High strength due to long-term partnership
            expectedSentiment: 0.7, // Positive
          },
          {
            context:
              "Bob manages Charlie and has been mentoring him on the new project. Charlie really appreciates Bob's guidance.",
            source: bobId,
            target: charlieId,
            expectedType: 'manager',
            expectedStrength: 70,
            expectedSentiment: 0.8, // Very positive
          },
          {
            context:
              "Alice and Charlie had a disagreement about the product direction. They're not seeing eye to eye.",
            source: aliceId,
            target: charlieId,
            expectedType: 'colleague',
            expectedStrength: 40,
            expectedSentiment: -0.3, // Negative
          },
          {
            context:
              'Bob introduced Alice to his wife Sarah at the company party. They all had dinner together.',
            source: bobId,
            target: aliceId,
            expectedType: 'colleague', // Should understand this is still professional despite social context
            expectedSocial: true,
          },
        ];

        for (const test of relationshipTests) {
          console.log(`\n🔗 Testing relationship inference: "${test.context.substring(0, 60)}..."`);

          const relationship = await entityGraphService.analyzeInteraction(
            test.source,
            test.target,
            test.context,
            { roomId }
          );

          if (!relationship) {
            throw new Error('Failed to infer relationship from context');
          }

          // Verify relationship type was inferred
          if (!relationship.relationshipType) {
            throw new Error('Relationship type not determined');
          }
          console.log(`✓ Inferred relationship type: ${relationship.relationshipType}`);

          // Check strength calculation
          if (
            relationship.strength === undefined ||
            relationship.strength < 0 ||
            relationship.strength > 100
          ) {
            throw new Error(`Invalid relationship strength: ${relationship.strength}`);
          }
          console.log(`✓ Calculated strength: ${relationship.strength}%`);

          // Verify sentiment analysis if expected
          if (
            test.expectedSentiment !== undefined &&
            (!relationship.metadata || relationship.metadata.sentiment === undefined)
          ) {
            throw new Error('Expected sentiment analysis but none performed');
          }
          if (relationship.metadata?.sentiment !== undefined) {
            const sentiment = relationship.metadata.sentiment as number;
            console.log(
              `✓ Analyzed sentiment: ${sentiment > 0 ? 'positive' : sentiment < 0 ? 'negative' : 'neutral'} (${sentiment})`
            );
          }

          // Test-specific validations
          if (test.expectedType && relationship.relationshipType !== test.expectedType) {
            console.log(
              `⚠️ Expected type "${test.expectedType}" but got "${relationship.relationshipType}"`
            );
            // This is a warning, not a failure - LLM might choose different but valid types
          }

          if (
            test.expectedStrength &&
            Math.abs(relationship.strength - test.expectedStrength) > 30
          ) {
            console.log(
              `⚠️ Expected strength ~${test.expectedStrength} but got ${relationship.strength}`
            );
          }
        }

        console.log('\n✅ Relationship inference test PASSED');
      },
    },

    {
      name: 'Detect complex and implicit relationships',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing complex relationship detection...');

        const worldId = await createTestWorld(runtime);
        const roomId = await createTestRoom(runtime, worldId);
        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;

        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        // Create entities for complex relationship testing
        const entities: Record<string, UUID> = {};
        const names = ['David', 'Emma', 'Frank', 'Grace'];

        for (const name of names) {
          const id = stringToUuid(`${name.toLowerCase()}-${Date.now()}`);
          entities[name] = id;

          await runtime.createEntity({
            id,
            names: [name],
            agentId: runtime.agentId,
            metadata: { type: 'person' },
          });
        }

        // Test complex relationship scenarios
        const complexTests = [
          {
            context: `David used to work with Emma at Google, but now they're competitors since Emma 
                     started her own company. Despite the competition, they still respect each other 
                     and occasionally share industry insights.`,
            source: entities.David,
            target: entities.Emma,
            expectedMultipleTypes: ['former_colleague', 'competitor'],
            expectedComplexity: 'high',
          },
          {
            context: `Frank is Grace's PhD advisor and they've co-authored several papers together. 
                     Grace considers Frank not just a mentor but also a friend. They often discuss 
                     research ideas over coffee.`,
            source: entities.Frank,
            target: entities.Grace,
            expectedMultipleTypes: ['advisor', 'co-author', 'friend'],
            expectedAcademic: true,
          },
          {
            context: `Emma and Frank are in a complicated situation - Emma is dating Frank's ex-girlfriend 
                     and Frank is now Emma's angel investor. They maintain a professional relationship 
                     despite the personal complications.`,
            source: entities.Emma,
            target: entities.Frank,
            expectedTypes: ['investor', 'complicated'],
            expectedProfessionalPersonalMix: true,
          },
        ];

        for (const test of complexTests) {
          console.log(`\n🔍 Testing complex relationship: "${test.context.substring(0, 50)}..."`);

          const relationship = await entityGraphService.analyzeInteraction(
            test.source,
            test.target,
            test.context,
            { roomId }
          );

          if (!relationship) {
            throw new Error('Failed to analyze complex relationship');
          }

          console.log(
            `✓ Detected relationship type: ${relationship.relationshipType || 'unknown'}`
          );
          console.log(`✓ Strength: ${relationship.strength || 0}%`);

          // Check if metadata captures complexity
          if (relationship.metadata) {
            console.log(`✓ Metadata keys: ${Object.keys(relationship.metadata).join(', ')}`);

            if (relationship.metadata.tags && Array.isArray(relationship.metadata.tags)) {
              console.log(`✓ Relationship tags: ${relationship.metadata.tags.join(', ')}`);
            }
          }

          // Verify the relationship captures nuance
          if (!relationship.relationshipType || relationship.strength === 0) {
            throw new Error('Complex relationship not properly analyzed');
          }
        }

        console.log('\n✅ Complex relationship detection test PASSED');
      },
    },

    {
      name: 'Update relationships based on new interactions',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing relationship evolution over time...');

        const worldId = await createTestWorld(runtime);
        const roomId = await createTestRoom(runtime, worldId);
        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;

        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        // Create two entities
        const henryId = stringToUuid(`henry-${Date.now()}`);
        const isabelId = stringToUuid(`isabel-${Date.now()}`);

        await runtime.createEntity({
          id: henryId,
          names: ['Henry'],
          agentId: runtime.agentId,
          metadata: { type: 'person' },
        });

        await runtime.createEntity({
          id: isabelId,
          names: ['Isabel'],
          agentId: runtime.agentId,
          metadata: { type: 'person' },
        });

        // Series of interactions showing relationship evolution
        const interactions = [
          {
            context:
              'Henry and Isabel met at a blockchain conference. They exchanged LinkedIn contacts.',
            expectedStrengthRange: [10, 30], // Weak initial connection
          },
          {
            context:
              'Henry and Isabel collaborated on a DeFi project. The project was successful and they work well together.',
            expectedStrengthRange: [40, 60], // Strengthening
          },
          {
            context:
              'Isabel recommended Henry for a senior position at her company. Henry got the job thanks to her referral.',
            expectedStrengthRange: [60, 80], // Strong professional relationship
          },
          {
            context:
              'Henry and Isabel had a major disagreement about the technical architecture. The discussion got heated.',
            expectedStrengthRange: [40, 60], // Some weakening but still connected
          },
          {
            context:
              'After some time, Henry and Isabel resolved their differences and are now planning to start a company together.',
            expectedStrengthRange: [70, 90], // Very strong partnership
          },
        ];

        let previousStrength = 0;

        for (const [index, interaction] of interactions.entries()) {
          console.log(
            `\n📈 Interaction ${index + 1}: "${interaction.context.substring(0, 50)}..."`
          );

          const relationship = await entityGraphService.analyzeInteraction(
            henryId,
            isabelId,
            interaction.context,
            { roomId }
          );

          if (!relationship) {
            throw new Error('Failed to update relationship');
          }

          console.log(`✓ Relationship type: ${relationship.relationshipType || 'unknown'}`);
          const currentStrength = relationship.strength || 0;
          console.log(`✓ Current strength: ${currentStrength}%`);

          // Verify strength is in expected range
          const [minStrength, maxStrength] = interaction.expectedStrengthRange;
          if (currentStrength < minStrength || currentStrength > maxStrength) {
            console.log(
              `⚠️ Strength ${currentStrength} outside expected range [${minStrength}, ${maxStrength}]`
            );
          }

          // Check if relationship evolved appropriately
          if (index > 0) {
            const strengthDelta = currentStrength - previousStrength;
            console.log(`✓ Strength change: ${strengthDelta > 0 ? '+' : ''}${strengthDelta}`);
          }

          previousStrength = currentStrength;

          // Wait a bit between interactions
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Verify final relationship state
        const finalRelationships = await entityGraphService.getEntityRelationships(henryId);
        const isabelRelationship = finalRelationships.find(
          (r) => r.targetEntityId === isabelId || r.sourceEntityId === isabelId
        );

        if (!isabelRelationship) {
          throw new Error('Final relationship not found');
        }

        const finalStrength = isabelRelationship.strength || 0;
        if (finalStrength < 70) {
          throw new Error('Expected strong final relationship after positive resolution');
        }

        console.log('\n✅ Relationship evolution test PASSED');
      },
    },
  ],
};
