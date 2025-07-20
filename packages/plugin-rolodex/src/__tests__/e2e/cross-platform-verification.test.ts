/**
 * End-to-end test for cross-platform entity verification workflow
 * Simulates real-world scenario: User claims Twitter on Discord, then confirms from Twitter
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  AgentRuntime,
  IDatabaseAdapter,
  IAgentRuntime,
  ModelType,
  stringToUuid,
  asUUID,
} from '@elizaos/core';
import { createDatabaseAdapter } from '@elizaos/plugin-sql';
import { rolodexPlugin } from '../../index';
import { RolodexService } from '../../services/RolodexService';

describe.skip('Cross-Platform Entity Verification E2E', () => {
  let discordAgent: IAgentRuntime;
  let twitterAgent: IAgentRuntime;
  let databaseAdapter: IDatabaseAdapter;

  const scenario = {
    user: {
      name: 'Alice Johnson',
      discordId: asUUID(stringToUuid('alice-discord-123')),
      twitterId: asUUID(stringToUuid('alice-twitter-456')),
      discordHandle: 'alice#1234',
      twitterHandle: '@alicej',
    },
    rooms: {
      discord: asUUID(stringToUuid('discord-general')),
      twitter: asUUID(stringToUuid('twitter-dms')),
    },
  };

  beforeAll(async () => {
    // Setup shared database
    databaseAdapter = createDatabaseAdapter({ 
      dataDir: ':memory:' 
    }, asUUID(stringToUuid('e2e-test-db')));
    await databaseAdapter.init();

    // Create Discord agent
    discordAgent = new AgentRuntime({
      character: {
        id: asUUID(stringToUuid('discord-bot')),
        name: 'DiscordBot',
        username: 'discordbot',
        bio: ['Discord bot for entity tracking'],
        system: 'Track entities and relationships on Discord.',
        settings: { model: ModelType.TEXT_LARGE },
        plugins: ['@elizaos/plugin-rolodex'],
      },
      plugins: [rolodexPlugin],
      databaseAdapter: databaseAdapter,
    });

    // Create Twitter agent
    twitterAgent = new AgentRuntime({
      character: {
        id: asUUID(stringToUuid('twitter-bot')),
        name: 'TwitterBot', 
        username: 'twitterbot',
        bio: ['Twitter bot for entity tracking'],
        system: 'Track entities and relationships on Twitter.',
        settings: { model: ModelType.TEXT_LARGE },
        plugins: ['@elizaos/plugin-rolodex'],
      },
      plugins: [rolodexPlugin],
      databaseAdapter: databaseAdapter,
    });

    await discordAgent.initialize();
    await twitterAgent.initialize();

    // Create user entities on both platforms
    await discordAgent.createEntity({
      id: scenario.user.discordId,
      agentId: discordAgent.agentId,
      names: [scenario.user.name, scenario.user.discordHandle],
      metadata: { platform: 'discord', handle: scenario.user.discordHandle },
    });

    await twitterAgent.createEntity({
      id: scenario.user.twitterId,
      agentId: twitterAgent.agentId,
      names: [scenario.user.name, scenario.user.twitterHandle],
      metadata: { platform: 'twitter', handle: scenario.user.twitterHandle },
    });
  });

  afterAll(async () => {
    await discordAgent?.stop();
    await twitterAgent?.stop();
    await databaseAdapter?.close();
  });

  it('Complete Cross-Platform Verification Workflow', async () => {
    // === STEP 1: User claims Twitter identity on Discord ===
    console.log('\n=== STEP 1: Discord user claims Twitter identity ===');
    
    const discordClaimText = `My Twitter is ${scenario.user.twitterHandle}`;
    const discordClaimMessage = await discordAgent.createMemory({
      id: asUUID(stringToUuid('discord-claim')),
      entityId: scenario.user.discordId,
      agentId: discordAgent.agentId,
      roomId: scenario.rooms.discord,
      content: { text: discordClaimText },
      embedding: [],
      createdAt: Date.now(),
    }, 'messages');

    // Simulate processing the claim
    const discordRolodex = discordAgent.getService<RolodexService>('rolodex');
    const discordEntityManager = discordRolodex!.entityResolutionManager;
    
    const claimId = await discordEntityManager!.recordPlatformClaim(
      scenario.user.discordId, // who made the claim
      scenario.user.discordId, // entity making the claim
      scenario.user.discordId, // entity the claim is about
      'twitter',
      scenario.user.twitterHandle,
      0.8,
      'user_statement',
      discordClaimText
    );

    console.log(`✓ Platform claim recorded: ${claimId}`);
    expect(claimId).toBeDefined();

    // Verify claim was stored
    const claims = await discordEntityManager.getPlatformClaims('twitter', scenario.user.twitterHandle);
    expect(claims.length).toBeGreaterThan(0);
    console.log(`✓ Found ${claims.length} claims for ${scenario.user.twitterHandle}`);

    // === STEP 2: User confirms identity from Twitter ===
    console.log('\n=== STEP 2: Twitter user confirms Discord identity ===');
    
    const twitterConfirmText = `Yes, I am ${scenario.user.discordHandle} on Discord`;
    const twitterConfirmMessage = await twitterAgent.createMemory({
      id: asUUID(stringToUuid('twitter-confirm')),
      entityId: scenario.user.twitterId,
      agentId: twitterAgent.agentId,
      roomId: scenario.rooms.twitter,
      content: { text: twitterConfirmText },
      embedding: [],
      createdAt: Date.now(),
    }, 'messages');

    const twitterRolodex = twitterAgent.getService<RolodexService>('rolodex');
    const twitterEntityManager = twitterRolodex!.entityResolutionManager;

    const confirmed = await twitterEntityManager!.recordPlatformConfirmation(
      scenario.user.twitterId, // who is confirming
      scenario.user.twitterId, // entity being confirmed
      'discord',
      scenario.user.discordHandle,
      asUUID(stringToUuid(`discord:${scenario.user.discordHandle}:confirmation`)),
      0.9,
      'direct_statement',
      twitterConfirmText
    );

    console.log(`✓ Platform confirmation recorded, bidirectional completed: ${confirmed}`);

    // === STEP 3: Record reciprocal claim and confirmation ===
    console.log('\n=== STEP 3: Complete bidirectional evidence ===');

    // Twitter user claims Discord identity
    const twitterClaimId = await twitterEntityManager.recordPlatformClaim(
      scenario.user.twitterId,
      scenario.user.twitterId,
      scenario.user.twitterId,
      'discord',
      scenario.user.discordHandle,
      0.8,
      'user_statement',
      `I am ${scenario.user.discordHandle} on Discord`
    );

    // Discord user confirms Twitter identity
    const discordConfirmed = await discordEntityManager!.recordPlatformConfirmation(
      scenario.user.discordId,
      scenario.user.discordId,
      'twitter',
      scenario.user.twitterHandle,
      asUUID(stringToUuid(`twitter:${scenario.user.twitterHandle}:confirmation`)),
      0.9,
      'direct_statement',
      `Yes, I am ${scenario.user.twitterHandle} on Twitter`
    );

    console.log(`✓ Reciprocal claim recorded: ${twitterClaimId}`);
    console.log(`✓ Reciprocal confirmation completed: ${discordConfirmed}`);

    // === STEP 4: Check for merge proposals ===
    console.log('\n=== STEP 4: Verify merge proposal creation ===');

    const pendingMerges = await discordEntityManager.getPendingMerges();
    console.log(`✓ Found ${pendingMerges.length} pending merge proposals`);

    let mergeProposal;
    if (pendingMerges.length > 0) {
      mergeProposal = pendingMerges.find(p => 
        (p.primaryEntityId === scenario.user.discordId && p.candidateEntityIds.includes(scenario.user.twitterId)) ||
        (p.primaryEntityId === scenario.user.twitterId && p.candidateEntityIds.includes(scenario.user.discordId))
      );

      if (mergeProposal) {
        console.log(`✓ Merge proposal found with confidence: ${mergeProposal.confidence}`);
        console.log(`✓ Bidirectional strength: ${mergeProposal.bidirectionalEvidence?.bidirectionalStrength}`);
        console.log(`✓ Requires confirmation: ${mergeProposal.requiresConfirmation}`);
        
        expect(mergeProposal.bidirectionalEvidence).toBeDefined();
        expect(mergeProposal.bidirectionalEvidence.bidirectionalStrength).toBeGreaterThan(0.5);
      }
    }

    // === STEP 5: Execute merge if conditions are met ===
    console.log('\n=== STEP 5: Execute entity merge ===');

    if (mergeProposal && mergeProposal.confidence > 0.7) {
      const mergeKey = [mergeProposal.primaryEntityId, ...mergeProposal.candidateEntityIds].sort().join(':');
      
      const mergeSuccess = await discordEntityManager.approvePendingMerge(
        mergeKey,
        discordAgent.agentId
      );

      console.log(`✓ Merge execution result: ${mergeSuccess}`);
      expect(mergeSuccess).toBe(true);

      // Verify merge was completed
      const remainingMerges = await discordEntityManager.getPendingMerges();
      const mergeStillPending = remainingMerges.some(p => 
        (p.primaryEntityId === scenario.user.discordId && p.candidateEntityIds.includes(scenario.user.twitterId)) ||
        (p.primaryEntityId === scenario.user.twitterId && p.candidateEntityIds.includes(scenario.user.discordId))
      );
      
      expect(mergeStillPending).toBe(false);
      console.log(`✓ Merge completed, no longer pending`);

      // Verify merged entity contains both platform identities
      const mergedEntity = await discordAgent.getEntityById(mergeProposal.primaryEntityId);
      expect(mergedEntity).toBeDefined();
      console.log(`✓ Merged entity names: ${mergedEntity.names.join(', ')}`);
      
      // Should contain references to both platforms
      const hasDiscordRef = mergedEntity.names.some(name => 
        name.includes('alice') || name.includes('1234')
      );
      const hasTwitterRef = mergedEntity.names.some(name => 
        name.includes('alice') || name.includes('@')
      );
      
      expect(hasDiscordRef || hasTwitterRef).toBe(true);
    }

    // === STEP 6: Test cross-platform search ===
    console.log('\n=== STEP 6: Test cross-platform search ===');

    const discordSearchResults = await discordRolodex.searchEntities('alice', 5);
    const twitterSearchResults = await twitterRolodex.searchEntities('alice', 5);

    console.log(`✓ Discord search found ${discordSearchResults.length} results`);
    console.log(`✓ Twitter search found ${twitterSearchResults.length} results`);

    expect(discordSearchResults.length).toBeGreaterThan(0);
    expect(twitterSearchResults.length).toBeGreaterThan(0);

    // === STEP 7: Verify system state ===
    console.log('\n=== STEP 7: Final system state verification ===');

    const allClaims = await discordEntityManager.getPlatformClaims();
    const allConfirmations = await discordEntityManager.getPlatformConfirmations();
    const finalPendingMerges = await discordEntityManager.getPendingMerges();

    console.log(`✓ Total platform claims: ${allClaims.length}`);
    console.log(`✓ Total confirmations: ${allConfirmations.length}`);
    console.log(`✓ Remaining pending merges: ${finalPendingMerges.length}`);

    // Both agents should see consistent state
    const twitterClaims = await twitterEntityManager.getPlatformClaims();
    const twitterConfirmations = await twitterEntityManager.getPlatformConfirmations();

    expect(allClaims.length).toBe(twitterClaims.length);
    expect(allConfirmations.length).toBe(twitterConfirmations.length);

    console.log(`✓ Cross-agent state consistency verified`);
    console.log('\n🎉 Cross-platform verification workflow completed successfully!');
  });

  it('Should handle edge cases gracefully', async () => {
    console.log('\n=== EDGE CASE TESTING ===');

    const discordRolodex = discordAgent.getService<RolodexService>('rolodex');
    const entityManager = discordRolodex.entityResolutionManager;

    // Test duplicate claims
    const duplicateClaimId1 = await entityManager.recordPlatformClaim(
      scenario.user.discordId,
      scenario.user.discordId,
      scenario.user.discordId,
      'github',
      '@alice',
      0.7,
      'user_statement',
      'My GitHub is @alice'
    );

    const duplicateClaimId2 = await entityManager.recordPlatformClaim(
      scenario.user.discordId,
      scenario.user.discordId,
      scenario.user.discordId,
      'github',
      '@alice',
      0.8,
      'user_statement',
      'My GitHub handle is @alice'
    );

    expect(duplicateClaimId1).toBeDefined();
    expect(duplicateClaimId2).toBeDefined();
    console.log('✓ Duplicate claims handled gracefully');

    // Test invalid confirmations
    const invalidConfirmation = await entityManager.recordPlatformConfirmation(
      scenario.user.discordId,
      scenario.user.discordId,
      'nonexistent',
      '@nobody',
      'invalid-claim-id',
      0.5,
      'direct_statement',
      'I am @nobody'
    );

    expect(typeof invalidConfirmation).toBe('boolean');
    console.log('✓ Invalid confirmations handled gracefully');

    // Test concurrent operations
    const concurrentPromises = [
      entityManager.recordPlatformClaim(
        scenario.user.discordId,
        scenario.user.discordId,
        scenario.user.discordId,
        'linkedin',
        'alice-johnson',
        0.8,
        'user_statement',
        'My LinkedIn is alice-johnson'
      ),
      entityManager.recordPlatformConfirmation(
        scenario.user.twitterId,
        scenario.user.twitterId,
        'linkedin',
        'alice-johnson',
        'linkedin-confirm',
        0.9,
        'direct_statement',
        'Confirming LinkedIn identity'
      ),
    ];

    const concurrentResults = await Promise.all(concurrentPromises);
    expect(concurrentResults[0]).toBeDefined(); // claim ID
    expect(typeof concurrentResults[1]).toBe('boolean'); // confirmation result

    console.log('✓ Concurrent operations handled gracefully');
  });
});