/**
 * Database Test Utilities
 *
 * Utilities for setting up and cleaning up test data in integration tests.
 * All functions use proper database connection management via getDatabase() calls
 * and include appropriate error handling and connection cleanup.
 *
 * Key Features:
 * - Proper connection management using getDatabase()
 * - No direct database access patterns
 * - Comprehensive error handling
 * - Test isolation verification
 * - Database health checking
 *
 * Usage:
 * - Call waitForDatabase() at test startup
 * - Use createTestOrganization() to set up test data
 * - Use cleanupTestDatabase() to clean up after tests
 * - Call cleanupDatabaseConnections() in global teardown
 */

import { getDatabase, closeDatabase } from '../../lib/database';
import {
  organizations,
  users,
  agents,
  conversations,
  messages,
  memories,
} from '../../lib/database/schema';
import { eq } from 'drizzle-orm';

export interface TestOrganization {
  organizationId: string;
  userId: string;
  orgData: any;
  userData: any;
}

/**
 * Create a test organization with a test user for integration testing
 */
export async function createTestOrganization(
  name: string,
): Promise<TestOrganization> {
  return await withDatabaseConnection(async (db) => {
    // Create test organization
    const orgResult = await db
      .insert(organizations)
      .values({
        name: `Test Org - ${name}`,
        slug: `test-org-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        subscriptionTier: 'pro', // Give test org full features
        subscriptionStatus: 'active',
        maxUsers: 100,
        maxAgents: 50,
        maxApiRequests: 100000,
        creditBalance: '1000.00',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const org = orgResult[0];

    // Create test user in the organization
    const userResult = await db
      .insert(users)
      .values({
        organizationId: org.id,
        email: `test-user-${Date.now()}@example.com`,
        name: 'Test User',
        role: 'admin',
        status: 'active',
        workosUserId: `test_user_${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const user = userResult[0];

    return {
      organizationId: org.id,
      userId: user.id,
      orgData: org,
      userData: user,
    };
  });
}

/**
 * Clean up all test data for an organization
 */
export async function cleanupTestDatabase(
  organizationId: string,
): Promise<void> {
  try {
    console.log(`Cleaning up test data for organization: ${organizationId}`);

    await withDatabaseConnection(async (db) => {
      // Delete in reverse dependency order to avoid foreign key constraints

      // 1. Delete memories first (depend on messages and conversations)
      await db
        .delete(memories)
        .where(eq(memories.organizationId, organizationId));

      // 2. Delete messages (depend on conversations)
      await db
        .delete(messages)
        .where(eq(messages.organizationId, organizationId));

      // 3. Delete conversations
      await db
        .delete(conversations)
        .where(eq(conversations.organizationId, organizationId));

      // 4. Delete agents
      await db.delete(agents).where(eq(agents.organizationId, organizationId));

      // 5. Delete users
      await db.delete(users).where(eq(users.organizationId, organizationId));

      // 6. Finally delete organization
      await db
        .delete(organizations)
        .where(eq(organizations.id, organizationId));
    });

    console.log(
      `Successfully cleaned up test data for organization: ${organizationId}`,
    );
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
    // Don't throw - cleanup should be best effort
  }
}

/**
 * Create a test agent in the database for testing
 */
export async function createTestAgent(
  organizationId: string,
  userId: string,
  characterConfig: any,
): Promise<string> {
  return await withDatabaseConnection(async (db) => {
    const agentResult = await db
      .insert(agents)
      .values({
        organizationId,
        createdByUserId: userId,
        name: characterConfig.name || 'Test Agent',
        description: 'Test agent for integration testing',
        character: characterConfig,
        plugins: [],
        runtimeConfig: {
          maxTokens: 4096,
          temperature: 0.7,
          model: 'gpt-4o-mini',
        },
        visibility: 'private',
        deploymentStatus: 'deployed',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return agentResult[0].id;
  });
}

/**
 * Create a test conversation for testing message flows
 */
export async function createTestConversation(
  organizationId: string,
  agentId: string,
  userId: string,
): Promise<string> {
  return await withDatabaseConnection(async (db) => {
    const conversationResult = await db
      .insert(conversations)
      .values({
        organizationId,
        agentId,
        userId,
        title: 'Test Conversation',
        participantIds: [userId],
        context: {
          purpose: 'integration-testing',
          environment: 'test',
        },
        settings: {
          maxMessages: 100,
          retentionDays: 7,
        },
        isActive: true,
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return conversationResult[0].id;
  });
}

/**
 * Verify test database isolation - ensure no data leaks between tests
 */
export async function verifyDatabaseIsolation(
  organizationId: string,
): Promise<boolean> {
  try {
    return await withDatabaseConnection(async (db) => {
      // Check that no data exists for this organization
      const [orgConversations, orgAgents, orgUsers] = await Promise.all([
        db
          .select()
          .from(conversations)
          .where(eq(conversations.organizationId, organizationId)),
        db
          .select()
          .from(agents)
          .where(eq(agents.organizationId, organizationId)),
        db.select().from(users).where(eq(users.organizationId, organizationId)),
      ]);

      const hasNoData =
        orgConversations.length === 0 &&
        orgAgents.length === 0 &&
        orgUsers.length === 0;

      if (!hasNoData) {
        console.warn(
          `Database isolation check failed for org ${organizationId}:`,
          {
            conversations: orgConversations.length,
            agents: orgAgents.length,
            users: orgUsers.length,
          },
        );
      }

      return hasNoData;
    });
  } catch (error) {
    console.error('Failed to verify database isolation:', error);
    return false;
  }
}

/**
 * Wait for database to be ready (useful for CI environments)
 */
export async function waitForDatabase(
  maxAttempts: number = 10,
  delayMs: number = 1000,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await withDatabaseConnection(async (db) => {
        await db.execute('SELECT 1');
      });
      console.log(`Database connection ready on attempt ${attempt}`);
      return true;
    } catch (error) {
      console.log(
        `Database connection attempt ${attempt}/${maxAttempts} failed:`,
        error,
      );

      if (attempt === maxAttempts) {
        console.error('Database connection failed after all attempts');
        return false;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

/**
 * Cleanup database connections for testing
 * Call this in test teardown to ensure clean shutdown
 */
export async function cleanupDatabaseConnections(): Promise<void> {
  try {
    await closeDatabase();
    console.log('Database connections cleaned up successfully');
  } catch (error) {
    console.error('Failed to cleanup database connections:', error);
    // Don't throw - cleanup should be best effort
  }
}

/**
 * Execute a database operation with proper connection management
 * This utility ensures consistent error handling and connection cleanup
 */
export async function withDatabaseConnection<T>(
  operation: (db: Awaited<ReturnType<typeof getDatabase>>) => Promise<T>,
): Promise<T> {
  let db;
  try {
    db = await getDatabase();
    return await operation(db);
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  } finally {
    // Connection is managed by the adapter pool, no need to close
  }
}

/**
 * Reset test database to clean state
 * WARNING: This will delete ALL data - only use in tests
 */
export async function resetTestDatabase(): Promise<void> {
  await withDatabaseConnection(async (db) => {
    // Delete all test data in dependency order
    await db.delete(memories);
    await db.delete(messages);
    await db.delete(conversations);
    await db.delete(agents);
    await db.delete(users);
    await db.delete(organizations);

    console.log('Test database reset completed');
  });
}

/**
 * Check if database connection is healthy
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    return await withDatabaseConnection(async (db) => {
      await db.execute('SELECT 1');
      return true;
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
