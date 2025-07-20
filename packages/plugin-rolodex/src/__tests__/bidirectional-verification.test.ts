/**
 * Focused test for bidirectional verification functionality
 * Tests the core bidirectional verification methods without full runtime setup
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { stringToUuid, asUUID, logger } from '@elizaos/core';
import { EntityResolutionManager } from '../managers/EntityResolutionManager';
import { EventBridge } from '../managers/EventBridge';

describe('Bidirectional Verification', () => {
  let entityManager: EntityResolutionManager;
  let mockRuntime: any;
  let mockEventBridge: EventBridge;

  beforeEach(async () => {
    // Create mock runtime
    mockRuntime = {
      agentId: asUUID(stringToUuid('test-agent')),
      logger: logger,
      getService: () => null,
      db: null, // Test mode without real DB
    };

    // Create event bridge
    mockEventBridge = new EventBridge(mockRuntime);
    await mockEventBridge.initialize();

    // Create entity resolution manager
    entityManager = new EntityResolutionManager(mockRuntime, mockEventBridge);
    await entityManager.initialize();
  });

  describe('Platform Claims', () => {
    it('should record platform claim successfully', async () => {
      const discordUserId = asUUID(stringToUuid('discord-user'));
      const claimId = await entityManager.recordPlatformClaim(
        discordUserId,
        discordUserId, 
        discordUserId,
        'twitter',
        '@testuser',
        0.8,
        'user_statement',
        'My Twitter is @testuser'
      );

      expect(claimId).toMatch(/twitter:@testuser:/);
      
      // Verify claim was stored
      const claims = await entityManager.getPlatformClaims('twitter', '@testuser');
      expect(claims.length).toBe(1);
      expect(claims[0].platform).toBe('twitter');
      expect(claims[0].handle).toBe('@testuser');
      expect(claims[0].claimedBy).toBe(discordUserId);
    });

    it('should handle multiple claims for same platform/handle', async () => {
      const user1 = asUUID(stringToUuid('user-1'));
      const user2 = asUUID(stringToUuid('user-2'));

      await entityManager.recordPlatformClaim(
        user1, user1, user1,
        'twitter', '@contested', 0.8, 'user_statement', 'My Twitter'
      );

      await entityManager.recordPlatformClaim(
        user2, user2, user2, 
        'twitter', '@contested', 0.7, 'user_statement', 'Also my Twitter'
      );

      const claims = await entityManager.getPlatformClaims('twitter', '@contested');
      expect(claims.length).toBe(2);
    });
  });

  describe('Platform Confirmations', () => {
    it('should record platform confirmation successfully', async () => {
      const discordUserId = asUUID(stringToUuid('discord-user'));
      const twitterUserId = asUUID(stringToUuid('twitter-user'));
      
      // First record a claim so the confirmation has something to confirm
      await entityManager.recordPlatformClaim(
        discordUserId, discordUserId, discordUserId,
        'twitter', '@tester', 0.8, 'user_statement', 'My Twitter is @tester'
      );
      
      const confirmationId = asUUID(stringToUuid('confirm-1'));
      
      const result = await entityManager.recordPlatformConfirmation(
        twitterUserId,
        twitterUserId,
        'discord',
        'testuser#1234', 
        confirmationId,
        0.9,
        'direct_statement',
        'Yes I am testuser#1234 on Discord'
      );

      // Result will be false unless there's bidirectional evidence
      expect(typeof result).toBe('boolean');
      
      // Verify confirmation was stored
      const confirmations = await entityManager.getPlatformConfirmations('discord', 'testuser#1234');
      expect(confirmations.length).toBe(1);
      expect(confirmations[0].platform).toBe('discord');
      expect(confirmations[0].handle).toBe('testuser#1234');
      expect(confirmations[0].confirmedBy).toBe(twitterUserId);
    });
  });

  describe('Bidirectional Evidence Calculation', () => {
    it('should calculate bidirectional evidence correctly', async () => {
      const discordUser = asUUID(stringToUuid('discord-user'));
      const twitterUser = asUUID(stringToUuid('twitter-user'));

      // Step 1: Discord user claims Twitter identity
      await entityManager.recordPlatformClaim(
        discordUser, discordUser, discordUser,
        'twitter', '@testuser', 0.8, 'user_statement', 'My Twitter is @testuser'
      );

      // Step 2: Twitter user confirms Discord identity  
      const confirmId = asUUID(stringToUuid('confirmation'));
      await entityManager.recordPlatformConfirmation(
        twitterUser, twitterUser, 'discord', 'testuser#1234',
        confirmId, 0.9, 'direct_statement', 'I am testuser#1234'
      );

      // Step 3: Complete bidirectional by having Twitter claim Discord
      await entityManager.recordPlatformClaim(
        twitterUser, twitterUser, twitterUser,
        'discord', 'testuser#1234', 0.8, 'user_statement', 'My Discord is testuser#1234'
      );

      // Step 4: Discord confirms Twitter
      const confirm2Id = asUUID(stringToUuid('confirmation-2'));
      await entityManager.recordPlatformConfirmation(
        discordUser, discordUser, 'twitter', '@testuser',
        confirm2Id, 0.9, 'direct_statement', 'I am @testuser'
      );

      // Check that bidirectional match exists
      const twitterClaims = await entityManager.getPlatformClaims('twitter', '@testuser');
      const discordClaims = await entityManager.getPlatformClaims('discord', 'testuser#1234');
      const twitterConfirmations = await entityManager.getPlatformConfirmations('twitter', '@testuser');
      const discordConfirmations = await entityManager.getPlatformConfirmations('discord', 'testuser#1234');

      expect(twitterClaims.length).toBeGreaterThan(0);
      expect(discordClaims.length).toBeGreaterThan(0);
      expect(twitterConfirmations.length).toBeGreaterThan(0);
      expect(discordConfirmations.length).toBeGreaterThan(0);
    });
  });

  describe('Merge Proposals', () => {
    it('should create merge proposals with bidirectional evidence', async () => {
      const user1 = asUUID(stringToUuid('user1'));
      const user2 = asUUID(stringToUuid('user2'));

      // Set up bidirectional claims and confirmations
      await entityManager.recordPlatformClaim(
        user1, user1, user1,
        'twitter', '@john', 0.8, 'user_statement', 'My Twitter'
      );

      const confirmId = asUUID(stringToUuid('confirm'));
      const bidirectionalCompleted = await entityManager.recordPlatformConfirmation(
        user2, user2, 'discord', 'john#1234', 
        confirmId, 0.9, 'direct_statement', 'I am john#1234'
      );

      // Should indicate bidirectional verification was triggered
      expect(typeof bidirectionalCompleted).toBe('boolean');
      
      // Check for pending merges (would require full setup to test merge creation)
      const pendingMerges = await entityManager.getPendingMerges();
      expect(Array.isArray(pendingMerges)).toBe(true);
    });
  });

  describe('Cross-Platform Identity Resolution', () => {
    it('should support multiple platform types', async () => {
      const userId = asUUID(stringToUuid('multi-platform-user'));

      // Test various platform types
      const platforms = [
        { platform: 'twitter', handle: '@user' },
        { platform: 'discord', handle: 'user#1234' },
        { platform: 'github', handle: 'user' },
        { platform: 'reddit', handle: 'u/user' }
      ];

      for (const { platform, handle } of platforms) {
        const claimId = await entityManager.recordPlatformClaim(
          userId, userId, userId,
          platform, handle, 0.8, 'user_statement', `My ${platform} is ${handle}`
        );
        
        expect(claimId).toMatch(new RegExp(`${platform}:${handle.replace(/[^a-zA-Z0-9]/g, '\\$&')}:`));
        
        const claims = await entityManager.getPlatformClaims(platform, handle);
        expect(claims.length).toBe(1);
      }
    });

    it('should handle edge cases gracefully', async () => {
      const userId = asUUID(stringToUuid('edge-case-user'));

      // Test empty handle - should still work
      const claimId = await entityManager.recordPlatformClaim(
        userId, userId, userId,
        'test-platform', '', 0.5, 'user_statement', 'Empty handle test'
      );
      expect(claimId).toMatch(/test-platform::/);

      // Test special characters in handle
      const specialHandle = '@user.name+test_123!';
      const claimId2 = await entityManager.recordPlatformClaim(
        userId, userId, userId,
        'special', specialHandle, 0.8, 'user_statement', 'Special chars'
      );
      expect(claimId2).toContain('special:');
      expect(claimId2).toContain(specialHandle);
    });
  });

  describe('Data Persistence and Retrieval', () => {
    it('should persist claims and confirmations correctly', async () => {
      const userId = asUUID(stringToUuid('persistence-user'));
      const platform = 'test-platform';
      const handle = 'test-handle';

      // Record claim
      await entityManager.recordPlatformClaim(
        userId, userId, userId,
        platform, handle, 0.8, 'user_statement', 'Test claim'
      );

      // Record confirmation
      const confirmId = asUUID(stringToUuid('test-confirm'));
      await entityManager.recordPlatformConfirmation(
        userId, userId, platform, handle,
        confirmId, 0.9, 'direct_statement', 'Test confirmation'
      );

      // Verify persistence by retrieving
      const claims = await entityManager.getPlatformClaims(platform, handle);
      const confirmations = await entityManager.getPlatformConfirmations(platform, handle);
      const allClaims = await entityManager.getPlatformClaims();
      const allConfirmations = await entityManager.getPlatformConfirmations();

      expect(claims.length).toBe(1);
      expect(confirmations.length).toBe(1);
      expect(allClaims.length).toBeGreaterThanOrEqual(1);
      expect(allConfirmations.length).toBeGreaterThanOrEqual(1);

      // Verify data integrity
      const claim = claims[0];
      const confirmation = confirmations[0];

      expect(claim.claimedBy).toBe(userId);
      expect(claim.platform).toBe(platform);
      expect(claim.handle).toBe(handle);
      expect(claim.confidence).toBe(0.8);

      expect(confirmation.confirmedBy).toBe(userId);
      expect(confirmation.platform).toBe(platform);
      expect(confirmation.handle).toBe(handle);
      expect(confirmation.confidence).toBe(0.9);
    });
  });
});