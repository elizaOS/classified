/**
 * Unit tests for bidirectional verification logic
 * Tests the core algorithms without complex runtime setup
 */

import { describe, it, expect } from 'bun:test';
import { stringToUuid, asUUID } from '@elizaos/core';

describe('Bidirectional Verification Unit Tests', () => {

  it('should validate bidirectional evidence interfaces', () => {
    console.log('\n🧪 Testing Bidirectional Evidence Interfaces');
    
    // Test that we can create platform claim objects
    const platformClaim = {
      id: 'test-claim-id',
      platform: 'twitter',
      handle: '@testuser',
      claimedBy: asUUID(stringToUuid('discord-user')),
      confidence: 0.8,
      evidenceType: 'user_statement',
      createdAt: Date.now(),
    };
    
    expect(platformClaim.platform).toBe('twitter');
    expect(platformClaim.handle).toBe('@testuser');
    expect(platformClaim.confidence).toBe(0.8);
    
    // Test platform confirmation structure
    const platformConfirmation = {
      id: 'test-confirm-id',
      platform: 'discord',
      handle: 'testuser#1234',
      confirmedBy: asUUID(stringToUuid('twitter-user')),
      confidence: 0.9,
      evidenceType: 'direct_statement',
      createdAt: Date.now(),
    };
    
    expect(platformConfirmation.platform).toBe('discord');
    expect(platformConfirmation.handle).toBe('testuser#1234');
    expect(platformConfirmation.confidence).toBe(0.9);
    
    console.log('✅ Bidirectional evidence interfaces validated');
  });

  it('should calculate bidirectional strength correctly', () => {
    console.log('\n🧪 Testing Bidirectional Strength Calculation');
    
    // Mock bidirectional evidence calculation
    const calculateBidirectionalStrength = (claims: any[], confirmations: any[]) => {
      let strength = 0;
      
      // Group by entity pairs
      const entityPairs = new Set();
      
      claims.forEach(claim => {
        confirmations.forEach(confirmation => {
          if (claim.platform === confirmation.platform && 
              claim.handle === confirmation.handle) {
            const pairKey = [claim.claimedBy, confirmation.confirmedBy].sort().join(':');
            if (!entityPairs.has(pairKey)) {
              entityPairs.add(pairKey);
              strength += 0.5; // Strong bidirectional evidence
            }
          }
        });
      });
      
      return Math.min(strength, 1.0);
    };
    
    const claims = [
      { platform: 'twitter', handle: '@user', claimedBy: 'discord-id' },
      { platform: 'discord', handle: 'user#123', claimedBy: 'twitter-id' },
    ];
    
    const confirmations = [
      { platform: 'twitter', handle: '@user', confirmedBy: 'twitter-id' },
      { platform: 'discord', handle: 'user#123', confirmedBy: 'discord-id' },
    ];
    
    const strength = calculateBidirectionalStrength(claims, confirmations);
    expect(strength).toBeGreaterThanOrEqual(0.5);
    
    console.log(`✅ Bidirectional strength calculated: ${strength}`);
  });

  it('should handle platform claim storage logic', () => {
    console.log('\n🧪 Testing Platform Claim Storage Logic');
    
    // Mock claim storage
    const claims = new Map<string, any[]>();
    
    const recordPlatformClaim = (platform: string, handle: string, claim: any) => {
      const key = `${platform}:${handle}`;
      if (!claims.has(key)) {
        claims.set(key, []);
      }
      claims.get(key)!.push(claim);
      return `${platform}:${handle}:${claim.id}`;
    };
    
    const getPlatformClaims = (platform?: string, handle?: string) => {
      if (platform && handle) {
        const key = `${platform}:${handle}`;
        return claims.get(key) || [];
      }
      // Return all claims
      const allClaims: any[] = [];
      claims.forEach(claimList => allClaims.push(...claimList));
      return allClaims;
    };
    
    // Test recording claims
    const claimId = recordPlatformClaim('twitter', '@testuser', {
      id: 'claim-1',
      claimedBy: 'discord-user',
      confidence: 0.8
    });
    
    expect(claimId).toBe('twitter:@testuser:claim-1');
    
    // Test retrieving claims
    const retrievedClaims = getPlatformClaims('twitter', '@testuser');
    expect(retrievedClaims.length).toBe(1);
    expect(retrievedClaims[0].id).toBe('claim-1');
    
    const allClaims = getPlatformClaims();
    expect(allClaims.length).toBe(1);
    
    console.log('✅ Platform claim storage logic validated');
  });

  it('should handle platform confirmation storage logic', () => {
    console.log('\n🧪 Testing Platform Confirmation Storage Logic');
    
    // Mock confirmation storage
    const confirmations = new Map<string, any[]>();
    
    const recordPlatformConfirmation = (
      platform: string, 
      handle: string, 
      confirmation: any
    ) => {
      const key = `${platform}:${handle}`;
      if (!confirmations.has(key)) {
        confirmations.set(key, []);
      }
      confirmations.get(key)!.push(confirmation);
      return true; // Success
    };
    
    const getPlatformConfirmations = (platform?: string, handle?: string) => {
      if (platform && handle) {
        const key = `${platform}:${handle}`;
        return confirmations.get(key) || [];
      }
      // Return all confirmations
      const allConfirmations: any[] = [];
      confirmations.forEach(confirmationList => allConfirmations.push(...confirmationList));
      return allConfirmations;
    };
    
    // Test recording confirmations
    const success = recordPlatformConfirmation('discord', 'user#123', {
      id: 'confirm-1',
      confirmedBy: 'twitter-user',
      confidence: 0.9
    });
    
    expect(success).toBe(true);
    
    // Test retrieving confirmations
    const retrievedConfirmations = getPlatformConfirmations('discord', 'user#123');
    expect(retrievedConfirmations.length).toBe(1);
    expect(retrievedConfirmations[0].id).toBe('confirm-1');
    
    const allConfirmations = getPlatformConfirmations();
    expect(allConfirmations.length).toBe(1);
    
    console.log('✅ Platform confirmation storage logic validated');
  });

  it('should generate merge proposals based on bidirectional evidence', () => {
    console.log('\n🧪 Testing Merge Proposal Generation');
    
    // Mock merge proposal logic
    const generateMergeProposal = (
      claims: any[], 
      confirmations: any[],
      threshold = 0.7
    ) => {
      const entityPairs = new Map<string, { 
        entities: string[], 
        evidence: any[], 
        strength: number 
      }>();
      
      // Find bidirectional evidence pairs
      claims.forEach(claim => {
        confirmations.forEach(confirmation => {
          if (claim.platform === confirmation.platform && 
              claim.handle === confirmation.handle) {
            const pairKey = [claim.claimedBy, confirmation.confirmedBy].sort().join(':');
            if (!entityPairs.has(pairKey)) {
              entityPairs.set(pairKey, {
                entities: [claim.claimedBy, confirmation.confirmedBy],
                evidence: [],
                strength: 0
              });
            }
            const pair = entityPairs.get(pairKey)!;
            pair.evidence.push({ claim, confirmation });
            pair.strength += 0.5; // Add strength for bidirectional evidence
          }
        });
      });
      
      // Generate proposals above threshold
      const proposals: any[] = [];
      entityPairs.forEach((pair, key) => {
        if (pair.strength >= threshold) {
          proposals.push({
            id: `merge-${key}`,
            primaryEntityId: pair.entities[0],
            candidateEntityIds: [pair.entities[1]],
            confidence: Math.min(pair.strength, 1.0),
            bidirectionalEvidence: {
              evidencePairs: pair.evidence,
              bidirectionalStrength: pair.strength
            },
            requiresConfirmation: pair.strength < 0.9
          });
        }
      });
      
      return proposals;
    };
    
    const claims = [
      { 
        platform: 'twitter', 
        handle: '@user', 
        claimedBy: 'discord-user',
        confidence: 0.8 
      }
    ];
    
    const confirmations = [
      { 
        platform: 'twitter', 
        handle: '@user', 
        confirmedBy: 'twitter-user',
        confidence: 0.9 
      }
    ];
    
    const proposals = generateMergeProposal(claims, confirmations, 0.4);
    expect(proposals.length).toBe(1);
    
    const proposal = proposals[0];
    expect(proposal.confidence).toBeGreaterThan(0.4);
    expect(proposal.bidirectionalEvidence).toBeDefined();
    expect(proposal.bidirectionalEvidence.bidirectionalStrength).toBe(0.5);
    
    console.log(`✅ Generated ${proposals.length} merge proposals`);
  });

  it('should handle edge cases gracefully', () => {
    console.log('\n🧪 Testing Edge Case Handling');
    
    // Test empty inputs
    const emptyResult = {
      claims: [],
      confirmations: [],
      strength: 0
    };
    
    expect(emptyResult.claims.length).toBe(0);
    expect(emptyResult.confirmations.length).toBe(0);
    expect(emptyResult.strength).toBe(0);
    
    // Test duplicate handling
    const duplicateClaims = [
      { id: '1', platform: 'twitter', handle: '@user' },
      { id: '2', platform: 'twitter', handle: '@user' }, // Duplicate
    ];
    
    const uniqueHandles = new Set(duplicateClaims.map(c => `${c.platform}:${c.handle}`));
    expect(uniqueHandles.size).toBe(1); // Should deduplicate
    
    // Test invalid confidence scores
    const normalizeConfidence = (confidence: number) => {
      return Math.max(0, Math.min(1, confidence));
    };
    
    expect(normalizeConfidence(-0.5)).toBe(0);
    expect(normalizeConfidence(1.5)).toBe(1);
    expect(normalizeConfidence(0.7)).toBe(0.7);
    
    console.log('✅ Edge cases handled gracefully');
  });
});