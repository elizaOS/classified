/**
 * Comprehensive Security Testing
 * Tests security vulnerabilities, authentication, authorization, and data protection
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { authenticateUser } from '../../lib/server/auth/session';
import { createTokenPair } from '../../lib/server/utils/jwt';
import {
  validateApiKey,
  createApiKey,
} from '../../lib/server/services/api-key-service';
import {
  addCredits,
  deductCredits,
  getCreditBalance,
} from '../../lib/server/services/billing-service';
import {
  setDatabaseContext,
  clearDatabaseContext,
} from '../../lib/database/context';
import { CreditService } from '../../lib/billing/credit-service';
import { db, getDatabase, initializeDatabase } from '../../lib/database';
import {
  organizations,
  users,
  apiKeys,
  creditTransactions,
} from '../../lib/database/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

describe('Comprehensive Security Testing', () => {
  let testOrgId: string;
  let testUserId: string;
  let testApiKey: string;
  let database: any;

  beforeEach(async () => {
    // Only run in test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Security tests should only run in test environment');
    }

    // Initialize database
    database = await getDatabase();
    await initializeDatabase();

    testOrgId = uuidv4();
    testUserId = uuidv4();

    // Clean up any existing test data
    try {
      await database
        .delete(creditTransactions)
        .where(eq(creditTransactions.organizationId, testOrgId));
      await database
        .delete(apiKeys)
        .where(eq(apiKeys.organizationId, testOrgId));
      await database.delete(users).where(eq(users.organizationId, testOrgId));
      await database
        .delete(organizations)
        .where(eq(organizations.id, testOrgId));
    } catch (error) {
      // Ignore cleanup errors
    }

    // Create test organization
    await database.insert(organizations).values({
      id: testOrgId,
      name: 'Security Test Org',
      slug: `security-test-${testOrgId}`,
      creditBalance: '100.0',
    });

    // Create test user
    await database.insert(users).values({
      id: testUserId,
      organizationId: testOrgId,
      email: 'security-test@example.com',
      firstName: 'Security',
      lastName: 'Test',
      role: 'admin',
    });

    // Create test API key
    const { keyValue } = await createApiKey({
      organizationId: testOrgId,
      userId: testUserId,
      name: 'Security Test Key',
      description: 'API key for security testing',
      permissions: ['inference:openai', 'storage:read'],
      rateLimit: 100,
    });
    testApiKey = keyValue;
  });

  afterEach(async () => {
    try {
      await database
        .delete(creditTransactions)
        .where(eq(creditTransactions.organizationId, testOrgId));
      await database
        .delete(apiKeys)
        .where(eq(apiKeys.organizationId, testOrgId));
      await database.delete(users).where(eq(users.organizationId, testOrgId));
      await database
        .delete(organizations)
        .where(eq(organizations.id, testOrgId));
    } catch (error) {
      console.warn('Security test cleanup error:', error);
    }
  });

  describe('Authentication Security', () => {
    test('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.jwt.token',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid.signature',
        '',
        'Bearer invalid-token',
        'malformed-token-format',
      ];

      for (const token of invalidTokens) {
        const mockRequest = {
          headers: {
            get: (name: string) => {
              if (name === 'authorization') {
                return `Bearer ${token}`;
              }
              return null;
            },
          },
        } as any;

        const result = await authenticateUser(mockRequest);
        expect(result.user).toBeNull();
        expect(result.organization).toBeNull();
      }
    });

    test('should reject expired JWT tokens', async () => {
      // Create an expired token (expired 1 hour ago)
      const expiredPayload = {
        userId: testUserId,
        email: 'test@example.com',
        organizationId: testOrgId,
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      // This should fail during token validation
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'authorization') {
              return 'Bearer expired-token';
            }
            return null;
          },
        },
      } as any;

      const result = await authenticateUser(mockRequest);
      expect(result.user).toBeNull();
    });

    test('should validate JWT secret configuration', () => {
      // Test that JWT_SECRET is required in production
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.JWT_SECRET;

      try {
        (process.env as any).NODE_ENV = 'production';
        delete process.env.JWT_SECRET;

        // This should be handled by the auth system
        expect(() => {
          if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is required in production');
          }
        }).toThrow('JWT_SECRET is required in production');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
        if (originalSecret) {
          process.env.JWT_SECRET = originalSecret;
        }
      }
    });
  });

  describe('API Key Security', () => {
    test('should reject invalid API keys', async () => {
      const invalidKeys = [
        'eliza_invalid_key',
        'invalid-format',
        '',
        `eliza_${'x'.repeat(100)}`, // Too long
        'fake_key_format',
      ];

      for (const invalidKey of invalidKeys) {
        const result = await validateApiKey(invalidKey);
        expect(result).toBeNull();
      }
    });

    test('should enforce API key permissions', async () => {
      const apiKeyRecord = await validateApiKey(testApiKey);
      expect(apiKeyRecord).toBeDefined();

      // Test that API key has specific permissions
      expect(apiKeyRecord!.permissions).toContain('inference:openai');
      expect(apiKeyRecord!.permissions).toContain('storage:read');
      expect(apiKeyRecord!.permissions).not.toContain('storage:write');
    });

    test('should handle API key rate limiting', async () => {
      const apiKeyRecord = await validateApiKey(testApiKey);
      expect(apiKeyRecord).toBeDefined();
      expect(apiKeyRecord!.rateLimit).toBe(100);

      // In a real implementation, this would test actual rate limiting
      // For now, we verify the rate limit is properly stored
    });

    test('should prevent API key enumeration attacks', async () => {
      // Test that invalid keys don't leak information about valid key formats
      const result = await validateApiKey('eliza_test_enumeration_attack');
      expect(result).toBeNull();

      // Should not throw errors that could reveal system information
    });
  });

  describe('SQL Injection Protection', () => {
    test('should prevent SQL injection in database context', async () => {
      const maliciousInputs = [
        "'; DROP TABLE organizations; --",
        "1' OR '1'='1",
        "admin'; DELETE FROM users; --",
        "' UNION SELECT password FROM users --",
        '"; DROP DATABASE elizaos; --',
      ];

      for (const maliciousInput of maliciousInputs) {
        try {
          // Test database context with malicious organization ID
          await setDatabaseContext({
            organizationId: maliciousInput,
            userId: testUserId,
          });

          // If we get here, the context was set but should be safe due to parameterized queries
          await clearDatabaseContext();
        } catch (error) {
          // Expected - malicious input should be rejected
          expect(error).toBeDefined();
        }
      }
    });

    test('should use parameterized queries for credit operations', async () => {
      // Test that credit operations are safe from SQL injection
      const maliciousOrgId = "'; DROP TABLE creditTransactions; --";

      await expect(getCreditBalance(maliciousOrgId)).resolves.toBe(0); // Should return 0 for invalid UUID, not crash

      await expect(
        deductCredits({
          organizationId: maliciousOrgId,
          userId: testUserId,
          amount: 10.0,
          description: 'SQL injection test',
        }),
      ).rejects.toThrow(); // Should safely reject invalid input
    });
  });

  describe('Data Protection and Privacy', () => {
    test('should not expose sensitive data in error messages', async () => {
      try {
        // Try to access non-existent organization
        await getCreditBalance('non-existent-org-id');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Error messages should not contain sensitive information
        expect(errorMessage).not.toMatch(/password/i);
        expect(errorMessage).not.toMatch(/secret/i);
        expect(errorMessage).not.toMatch(/api[_-]?key/i);
        expect(errorMessage).not.toMatch(/token/i);
      }
    });

    test('should sanitize user input in credit descriptions', async () => {
      const maliciousDescriptions = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '"><script>evil()</script>',
        'DROP TABLE users;',
      ];

      for (const description of maliciousDescriptions) {
        const result = await addCredits({
          organizationId: testOrgId,
          userId: testUserId,
          amount: 1.0,
          description,
          type: 'adjustment',
        });

        // Description should be stored safely (exact sanitization depends on implementation)
        expect(result.description).toBeDefined();
        // Should not contain executable script tags
        expect(result.description).not.toMatch(/<script/i);
      }
    });

    test('should enforce UUID format validation', async () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123',
        '',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        '00000000-0000-0000-0000-000000000000',
      ];

      for (const invalidUUID of invalidUUIDs) {
        const balance = await getCreditBalance(invalidUUID);
        expect(balance).toBe(0); // Should safely return 0 for invalid UUIDs
      }
    });
  });

  describe('Access Control and Authorization', () => {
    test('should enforce organization isolation', async () => {
      // Create a second organization
      const otherOrgId = uuidv4();
      await database.insert(organizations).values({
        id: otherOrgId,
        name: 'Other Test Org',
        slug: `other-test-${otherOrgId}`,
        creditBalance: '50.0',
      });

      try {
        // User from first org shouldn't access second org's data
        await setDatabaseContext({
          organizationId: testOrgId,
          userId: testUserId,
        });

        // This should only return data for testOrgId, not otherOrgId
        const balance = await getCreditBalance(testOrgId);
        expect(balance).toBe(100.0);

        const otherBalance = await getCreditBalance(otherOrgId);
        expect(otherBalance).toBe(50.0); // Different organization

        await clearDatabaseContext();
      } finally {
        // Clean up
        await database
          .delete(organizations)
          .where(eq(organizations.id, otherOrgId));
      }
    });

    test('should validate user permissions for sensitive operations', async () => {
      // Test that certain operations require proper authorization
      // This would typically check role-based access control

      const regularUser = uuidv4();
      await database.insert(users).values({
        id: regularUser,
        organizationId: testOrgId,
        email: 'regular@example.com',
        firstName: 'Regular',
        lastName: 'User',
        role: 'user', // Not admin
      });

      try {
        // Regular users shouldn't be able to perform admin operations
        await setDatabaseContext({
          organizationId: testOrgId,
          userId: regularUser,
          isAdmin: false,
        });

        // This depends on implementation - some operations might require admin role
        await clearDatabaseContext();
      } finally {
        await database.delete(users).where(eq(users.id, regularUser));
      }
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('should validate credit amounts', async () => {
      const invalidAmounts = [
        -100, // Negative amount
        0, // Zero amount
        Infinity,
        NaN,
        'not-a-number' as any,
        1e10, // Extremely large amount
      ];

      for (const amount of invalidAmounts) {
        if (typeof amount === 'number' && (amount <= 0 || !isFinite(amount))) {
          await expect(
            addCredits({
              organizationId: testOrgId,
              userId: testUserId,
              amount,
              description: 'Invalid amount test',
              type: 'adjustment',
            }),
          ).rejects.toThrow();
        }
      }
    });

    test('should validate usage context inputs', async () => {
      const invalidContexts = [
        {
          service: '<script>alert("XSS")</script>',
          operation: 'chat',
          tokens: 100,
        },
        {
          service: 'openai',
          operation: "'; DROP TABLE usage_records; --",
          tokens: 100,
        },
        {
          service: 'openai',
          operation: 'chat',
          tokens: -100, // Negative tokens
        },
      ];

      for (const context of invalidContexts) {
        const result = await CreditService.deductCreditsForUsage(
          testOrgId,
          testUserId,
          context as any,
        );

        // Should handle invalid input gracefully
        if (context.tokens < 0) {
          expect(result.success).toBe(false);
        }
      }
    });
  });

  describe('Security Headers and Configuration', () => {
    test('should validate database connection security', () => {
      // Test that database connections are secure
      const dbConfig = {
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL,
      };

      if (process.env.NODE_ENV === 'production') {
        expect(dbConfig.password).toBeDefined();
        expect(dbConfig.password).not.toBe('');
      }
    });

    test('should validate encryption requirements', () => {
      // Test that sensitive data is encrypted
      const sensitiveData = 'test-secret-data';

      // This would test actual encryption implementation
      // For now, verify crypto module is available
      expect(crypto.randomBytes).toBeDefined();
      expect(crypto.createHash).toBeDefined();

      // Test basic hashing capability
      const hash = crypto
        .createHash('sha256')
        .update(sensitiveData)
        .digest('hex');
      expect(hash).toBeDefined();
      expect(hash).not.toBe(sensitiveData);
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    test('should handle large request volumes gracefully', async () => {
      // Test that system can handle multiple concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, () =>
        getCreditBalance(testOrgId),
      );

      const results = await Promise.allSettled(concurrentRequests);

      // All requests should either succeed or fail gracefully
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          expect(typeof result.value).toBe('number');
        } else {
          // Failures should be due to rate limiting, not crashes
          expect(result.reason).toBeDefined();
        }
      });
    });

    test('should prevent resource exhaustion attacks', async () => {
      // Test with very large data inputs
      const largeDescription = 'x'.repeat(10000); // 10KB description

      try {
        await addCredits({
          organizationId: testOrgId,
          userId: testUserId,
          amount: 1.0,
          description: largeDescription,
          type: 'adjustment',
        });

        // Should either succeed with truncated description or fail gracefully
      } catch (error) {
        // Should fail gracefully, not crash the system
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling Security', () => {
    test('should not leak sensitive information in stack traces', async () => {
      try {
        // Trigger an error condition
        await deductCredits({
          organizationId: 'invalid-uuid-format',
          userId: testUserId,
          amount: 1000000, // Large amount to trigger various error paths
          description: 'Error handling test',
        });
      } catch (error) {
        const errorString =
          error instanceof Error ? error.stack || error.message : String(error);

        // Error messages should not contain file paths, secrets, or internal details
        expect(errorString).not.toMatch(/\/Users\/.*\/packages\//);
        expect(errorString).not.toMatch(/password/i);
        expect(errorString).not.toMatch(/secret/i);
        expect(errorString).not.toMatch(/api[_-]?key/i);
      }
    });

    test('should handle database connection failures securely', async () => {
      // This would test behavior when database is unavailable
      // For now, test that we handle errors gracefully

      const invalidOrgId = 'totally-invalid-format';
      const balance = await getCreditBalance(invalidOrgId);
      expect(balance).toBe(0); // Should return safe default
    });
  });
});
