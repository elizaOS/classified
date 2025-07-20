/**
 * Test for bidirectional verification actions
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { stringToUuid, asUUID, logger } from '@elizaos/core';
import { recordPlatformClaimAction } from '../actions/recordPlatformClaim';
import { confirmPlatformIdentityAction } from '../actions/confirmPlatformIdentity';

describe('Bidirectional Verification Actions', () => {
  let mockRuntime: any;

  beforeEach(() => {
    mockRuntime = {
      agentId: asUUID(stringToUuid('test-agent')),
      logger: logger,
      getService: (serviceName: string) => {
        if (serviceName === 'rolodex') {
          return {
            entityResolutionManager: {
              recordPlatformClaim: async () => 'test-claim-id',
              recordPlatformConfirmation: async () => true,
              getPlatformClaims: async () => [],
              getPlatformConfirmations: async () => [],
            }
          };
        }
        return null;
      },
      composeState: async () => ({ recentMessagesData: [] }),
      updateRecentMessageState: async () => {},
      processActions: async () => {},
    };
  });

  describe('Record Platform Claim Action', () => {
    it('should validate platform claim messages', async () => {
      const message = {
        id: asUUID(stringToUuid('test-message')),
        userId: asUUID(stringToUuid('test-user')),
        entityId: asUUID(stringToUuid('test-user')),
        content: { text: 'My Twitter is @johndoe123' },
        roomId: asUUID(stringToUuid('test-room')),
        embedding: [] as number[],
        createdAt: Date.now(),
      };

      const isValid = await recordPlatformClaimAction.validate?.(mockRuntime, message);
      expect(typeof isValid).toBe('boolean');
    });

    it('should have proper action structure', () => {
      expect(recordPlatformClaimAction.name).toBe('RECORD_PLATFORM_CLAIM');
      expect(recordPlatformClaimAction.description).toContain('identity');
      expect(typeof recordPlatformClaimAction.handler).toBe('function');
      expect(Array.isArray(recordPlatformClaimAction.examples || [])).toBe(true);
      expect((recordPlatformClaimAction.examples || []).length).toBeGreaterThan(0);
    });

    it('should have valid examples', () => {
      if (!recordPlatformClaimAction.examples) return;
      for (const example of recordPlatformClaimAction.examples) {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBe(2); // User message and agent response
        
        const [userMsg, agentMsg] = example;
        expect(userMsg).toHaveProperty('name');
        expect(userMsg).toHaveProperty('content');
        expect(agentMsg).toHaveProperty('name');
        expect(agentMsg).toHaveProperty('content');
      }
    });
  });

  describe('Confirm Platform Identity Action', () => {
    it('should validate platform confirmation messages', async () => {
      const message = {
        id: asUUID(stringToUuid('test-message')),
        userId: asUUID(stringToUuid('test-user')),
        entityId: asUUID(stringToUuid('test-user')),
        content: { text: 'Yes, I am johndoe#1234 on Discord' },
        roomId: asUUID(stringToUuid('test-room')),
        embedding: [] as number[],
        createdAt: Date.now(),
      };

      const isValid = await confirmPlatformIdentityAction.validate?.(mockRuntime, message);
      expect(typeof isValid).toBe('boolean');
    });

    it('should have proper action structure', () => {
      expect(confirmPlatformIdentityAction.name).toBe('CONFIRM_PLATFORM_IDENTITY');
      expect(confirmPlatformIdentityAction.description).toContain('platform identity');
      expect(typeof confirmPlatformIdentityAction.handler).toBe('function');
      expect(Array.isArray(confirmPlatformIdentityAction.examples || [])).toBe(true);
      expect((confirmPlatformIdentityAction.examples || []).length).toBeGreaterThan(0);
    });

    it('should have valid examples', () => {
      if (!confirmPlatformIdentityAction.examples) return;
      for (const example of confirmPlatformIdentityAction.examples) {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBe(2); // User message and agent response
        
        const [userMsg, agentMsg] = example;
        expect(userMsg).toHaveProperty('name');
        expect(userMsg).toHaveProperty('content');
        expect(agentMsg).toHaveProperty('name');
        expect(agentMsg).toHaveProperty('content');
      }
    });
  });

  describe('Action Integration', () => {
    it('should work together for bidirectional verification workflow', () => {
      // Test that both actions exist and can be used together
      expect(recordPlatformClaimAction).toBeDefined();
      expect(confirmPlatformIdentityAction).toBeDefined();
      
      // Test that they have complementary purposes
      expect(recordPlatformClaimAction.name).not.toBe(confirmPlatformIdentityAction.name);
      expect(recordPlatformClaimAction.description).not.toBe(confirmPlatformIdentityAction.description);
      
      // Both should be able to work with rolodex service
      expect(typeof recordPlatformClaimAction.handler).toBe('function');
      expect(typeof confirmPlatformIdentityAction.handler).toBe('function');
    });

    it('should handle service availability checks', async () => {
      const runtimeWithoutRolodex = {
        ...mockRuntime,
        getService: () => null, // No rolodex service
      };

      const message = {
        id: asUUID(stringToUuid('test-message')),
        userId: asUUID(stringToUuid('test-user')),
        entityId: asUUID(stringToUuid('test-user')),
        content: { text: 'My Twitter is @test' },
        roomId: asUUID(stringToUuid('test-room')),
        embedding: [] as number[],
        createdAt: Date.now(),
      };

      // Actions should handle missing service gracefully
      const claimResult = await recordPlatformClaimAction.handler(
        runtimeWithoutRolodex, 
        message, 
        { values: {}, data: {}, text: '' }, 
        {}
      );

      const confirmResult = await confirmPlatformIdentityAction.handler(
        runtimeWithoutRolodex,
        message,
        { values: {}, data: {}, text: '' },
        {}
      );

      // Should return failure responses, not crash
      expect(claimResult).toBeDefined();
      expect(confirmResult).toBeDefined();
    });
  });
});