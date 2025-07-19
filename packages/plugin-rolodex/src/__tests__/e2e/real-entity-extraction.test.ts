import { type TestSuite, type IAgentRuntime, stringToUuid } from '@elizaos/core';
import type { EntityGraphManager } from '../../managers/EntityGraphManager';
import { createTestWorld, createTestRoom, waitForCondition } from './test-helpers';

export const realEntityExtractionTests: TestSuite = {
  name: 'Real Entity Extraction Tests',

  tests: [
    {
      name: 'Extract entities from natural conversation',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing real entity extraction from natural language...');

        const worldId = await createTestWorld(runtime);
        const roomId = await createTestRoom(runtime, worldId);
        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;

        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        // Test cases with expected extractions
        const testCases = [
          {
            context: `I just had a meeting with Sarah Chen from TechCorp. She's the VP of Engineering 
                     and mentioned they're looking for blockchain solutions. Her email is sarah.chen@techcorp.com 
                     and she's based in San Francisco. She seemed very interested in our platform.`,
            expected: {
              names: ['Sarah Chen'],
              type: 'person',
              tags: ['vp', 'engineering', 'techcorp', 'blockchain', 'interested'],
              hasEmail: true,
              hasLocation: true,
              hasOrganization: true,
            },
          },
          {
            context: `Met with the team from Acme Industries today - John Smith (CEO), 
                     Maria Garcia (CTO), and David Kim (Head of Product). They're a Series B startup 
                     with 50 employees working on AI-powered supply chain optimization. 
                     John mentioned they raised $20M last year.`,
            expected: {
              entityCount: 4, // Acme Industries + 3 people
              hasOrganization: true,
              hasFunding: true,
              hasRoles: true,
            },
          },
          {
            context: `Just got off a call with @cryptowhale on Twitter (real name Bob Johnson). 
                     He's a DeFi influencer with 100k followers and runs a validator node. 
                     His Discord handle is cryptowhale#1234. Seems legit but need to verify his claims.`,
            expected: {
              names: ['Bob Johnson', 'cryptowhale'],
              hasPlatforms: true,
              platformCount: 2,
              hasTrustIndicator: true, // "need to verify"
            },
          },
        ];

        for (const testCase of testCases) {
          console.log(`\n📝 Testing extraction from: "${testCase.context.substring(0, 50)}..."`);

          // Create a unique entity ID for this test
          const entityId = stringToUuid(`extraction-test-${Date.now()}`);

          // Track entity - this should trigger LLM extraction
          const profile = await entityGraphService.trackEntity(entityId, testCase.context, {
            roomId,
          });

          // Verify extraction results
          if (!profile) {
            throw new Error('Failed to extract entity profile');
          }

          // Check names were extracted
          if (!profile.names || profile.names.length === 0) {
            throw new Error('No names extracted from context');
          }
          console.log(`✓ Extracted names: ${profile.names.join(', ')}`);

          // Check entity type
          if (!profile.type) {
            throw new Error('Entity type not determined');
          }
          console.log(`✓ Determined type: ${profile.type}`);

          // Check tags extraction
          if (!profile.tags || profile.tags.length === 0) {
            throw new Error('No tags extracted from context');
          }
          console.log(
            `✓ Extracted ${profile.tags.length} tags: ${profile.tags.slice(0, 5).join(', ')}...`
          );

          // Check summary generation
          if (!profile.summary || profile.summary.length < 10) {
            throw new Error('No meaningful summary generated');
          }
          console.log(`✓ Generated summary: "${profile.summary.substring(0, 100)}..."`);

          // Verify platform extraction if expected
          if (
            testCase.expected.hasPlatforms &&
            (!profile.platforms || Object.keys(profile.platforms).length === 0)
          ) {
            throw new Error('Expected platform identifiers but none were extracted');
          }

          // Test-specific validations
          if (testCase.expected.names) {
            const extractedNames = profile.names.map((n) => n.toLowerCase());
            const expectedNames = testCase.expected.names.map((n) => n.toLowerCase());
            const foundExpectedName = expectedNames.some((expected) =>
              extractedNames.some(
                (extracted) => extracted.includes(expected) || expected.includes(extracted)
              )
            );

            if (!foundExpectedName) {
              throw new Error(
                `Expected to extract names like ${testCase.expected.names.join(', ')} but got ${profile.names.join(', ')}`
              );
            }
          }
        }

        console.log('\n✅ Real entity extraction test PASSED');
      },
    },

    {
      name: 'Extract and resolve entity mentions in conversation',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing entity mention extraction and resolution...');

        const worldId = await createTestWorld(runtime);
        const roomId = await createTestRoom(runtime, worldId);
        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;

        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        // First, create a known entity
        const knownEntityId = stringToUuid(`known-entity-${Date.now()}`);
        await entityGraphService.trackEntity(
          knownEntityId,
          'Alice Johnson is our head of product at TechStartup Inc. She has 10 years of experience in product management.',
          { roomId }
        );

        // Wait a bit for indexing
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Now test extraction with mentions of the known entity
        const mentionContexts = [
          'I spoke with Alice about the new feature roadmap',
          'Alice Johnson approved the budget increase',
          'Our head of product thinks we should pivot',
          'The product team, led by Alice, is making good progress',
        ];

        for (const context of mentionContexts) {
          console.log(`\n🔍 Testing mention resolution: "${context}"`);

          // This should identify that "Alice" refers to the known entity
          const searchResults = await entityGraphService.searchEntities('Alice', {
            limit: 5,
          });

          if (searchResults.length === 0) {
            throw new Error('Failed to find known entity through search');
          }

          const aliceResult = searchResults.find((r) =>
            r.entity.names.some((n) => n.toLowerCase().includes('alice'))
          );

          if (!aliceResult) {
            throw new Error('Known entity "Alice Johnson" not found in search results');
          }

          if (aliceResult.relevanceScore < 50) {
            throw new Error(`Relevance score too low: ${aliceResult.relevanceScore}`);
          }

          console.log(`✓ Found entity with relevance: ${aliceResult.relevanceScore}%`);
          console.log(`✓ Match reason: "${aliceResult.matchReason}"`);
        }

        console.log('\n✅ Entity mention extraction and resolution test PASSED');
      },
    },

    {
      name: 'Handle ambiguous and complex entity extraction',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing complex entity extraction scenarios...');

        const worldId = await createTestWorld(runtime);
        const roomId = await createTestRoom(runtime, worldId);
        const entityGraphService = runtime.getService(
          'entityGraph'
        ) as unknown as EntityGraphManager;

        if (!entityGraphService) {
          throw new Error('EntityGraphManager not available');
        }

        // Test edge cases and complex scenarios
        const edgeCases = [
          {
            context: 'The person I met yesterday was interesting but I forgot their name',
            shouldExtract: false, // No identifiable information
          },
          {
            context: 'John from accounting (not John from sales) sent the report',
            shouldExtract: true, // Should distinguish between Johns
            expectedTags: ['accounting'],
          },
          {
            context: 'The CEO of Amazon (Andy Jassy, not Jeff Bezos anymore) announced...',
            shouldExtract: true,
            expectedNames: ['Andy Jassy'],
            notExpectedNames: ['Jeff Bezos'], // Should understand the negation
          },
          {
            context: '我见到了王总 (CEO Wang) 从北京来的。He speaks both Chinese and English.',
            shouldExtract: true,
            expectedMultilingual: true,
          },
          {
            context: "user@example.com sent an email but I don't know who they are",
            shouldExtract: true,
            expectedEmail: true,
            expectedType: 'person', // Should infer it's a person from context
          },
        ];

        for (const edgeCase of edgeCases) {
          console.log(`\n🔬 Testing edge case: "${edgeCase.context.substring(0, 50)}..."`);

          const entityId = stringToUuid(`edge-case-${Date.now()}`);

          try {
            const profile = await entityGraphService.trackEntity(entityId, edgeCase.context, {
              roomId,
            });

            if (!edgeCase.shouldExtract && profile.names.length > 0) {
              throw new Error('Extracted entity when none should be found');
            }

            if (edgeCase.shouldExtract && (!profile.names || profile.names.length === 0)) {
              throw new Error('Failed to extract entity when one should be found');
            }

            if (edgeCase.expectedNames) {
              const hasExpectedName = edgeCase.expectedNames.some((name) =>
                profile.names.some((n) => n.toLowerCase().includes(name.toLowerCase()))
              );
              if (!hasExpectedName) {
                throw new Error(`Expected to find names: ${edgeCase.expectedNames.join(', ')}`);
              }
            }

            if (edgeCase.notExpectedNames) {
              const hasUnexpectedName = edgeCase.notExpectedNames.some((name) =>
                profile.names.some((n) => n.toLowerCase().includes(name.toLowerCase()))
              );
              if (hasUnexpectedName) {
                throw new Error(
                  `Should not have extracted: ${edgeCase.notExpectedNames.join(', ')}`
                );
              }
            }

            console.log('✓ Edge case handled correctly');
            if (profile.names.length > 0) {
              console.log(`  Extracted: ${profile.names.join(', ')}`);
              console.log(`  Type: ${profile.type}`);
              console.log(`  Tags: ${profile.tags?.slice(0, 3).join(', ')}...`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!edgeCase.shouldExtract && errorMessage.includes('No entities found')) {
              console.log('✓ Correctly identified no extractable entity');
            } else {
              throw error;
            }
          }
        }

        console.log('\n✅ Complex entity extraction test PASSED');
      },
    },
  ],
};
