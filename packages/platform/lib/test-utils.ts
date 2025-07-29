/**
 * Test Utilities
 *
 * Utilities for setting up and cleaning up test data in unit and integration tests
 */

import { getDatabase, closeDatabase } from './database';
import {
  organizations,
  users,
  agents,
  conversations,
  messages,
  memories,
} from './database/schema';
import { eq } from 'drizzle-orm';

export interface TestOrganization {
  id: string;
  organizationId: string;
  userId: string;
  orgData: any;
  userData: any;
}

export interface TestUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  workosUserId: string;
}

// Export the database connection getter for direct testing
export const getTestDatabase = getDatabase;

/**
 * Create a test organization with a test user for integration testing
 */
export async function createTestOrganization(
  name: string = 'Test',
): Promise<TestOrganization> {
  const db = await getDatabase();

  try {
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
      id: org.id,
      organizationId: org.id,
      userId: user.id,
      orgData: org,
      userData: user,
    };
  } catch (error) {
    console.error('Failed to create test organization:', error);
    throw error;
  }
}

/**
 * Create a test user in an existing organization
 */
export async function createTestUser(
  organizationId: string,
  email?: string,
  name?: string,
): Promise<TestUser> {
  const db = await getDatabase();

  try {
    const userResult = await db
      .insert(users)
      .values({
        organizationId,
        email: email || `test-user-${Date.now()}@example.com`,
        name: name || 'Test User',
        role: 'user',
        status: 'active',
        workosUserId: `test_user_${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return userResult[0];
  } catch (error) {
    console.error('Failed to create test user:', error);
    throw error;
  }
}

/**
 * Clean up all test data - can be called with or without organizationId
 */
export async function clearTestDatabase(
  organizationId?: string,
): Promise<void> {
  const db = await getDatabase();

  try {
    if (organizationId) {
      console.log(`Cleaning up test data for organization: ${organizationId}`);

      // Delete in reverse dependency order to avoid foreign key constraints

      // 1. Delete memories
      await db
        .delete(memories)
        .where(eq(memories.organizationId, organizationId));

      // 2. Delete messages
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

      console.log(
        `Successfully cleaned up test data for organization: ${organizationId}`,
      );
    } else {
      // Clear all test data (for test isolation)
      console.log('Clearing all test data');

      await db.delete(memories);
      await db.delete(messages);
      await db.delete(conversations);
      await db.delete(agents);
      await db.delete(users);
      await db.delete(organizations);

      console.log('Successfully cleared all test data');
    }
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
  const db = await getDatabase();

  try {
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
  } catch (error) {
    console.error('Failed to create test agent:', error);
    throw error;
  }
}

/**
 * Create a test conversation for testing message flows
 */
export async function createTestConversation(
  organizationId: string,
  agentId: string,
  userId: string,
): Promise<string> {
  const db = await getDatabase();

  try {
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
  } catch (error) {
    console.error('Failed to create test conversation:', error);
    throw error;
  }
}

/**
 * Verify test database isolation - ensure no data leaks between tests
 */
export async function verifyDatabaseIsolation(
  organizationId: string,
): Promise<boolean> {
  const db = await getDatabase();

  try {
    // Check that no data exists for this organization
    const [orgMemories, orgMessages, orgConversations] = await Promise.all([
      db
        .select()
        .from(memories)
        .where(eq(memories.organizationId, organizationId)),
      db
        .select()
        .from(messages)
        .where(eq(messages.organizationId, organizationId)),
      db
        .select()
        .from(conversations)
        .where(eq(conversations.organizationId, organizationId)),
    ]);

    const hasNoData =
      orgMemories.length === 0 &&
      orgMessages.length === 0 &&
      orgConversations.length === 0;

    if (!hasNoData) {
      console.warn(
        `Database isolation check failed for org ${organizationId}:`,
        {
          memories: orgMemories.length,
          messages: orgMessages.length,
          conversations: orgConversations.length,
        },
      );
    }

    return hasNoData;
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
      const db = await getDatabase();
      await db.execute('SELECT 1');
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
 * Close database connections - should be called in test teardown
 */
export async function closeTestDatabase(): Promise<void> {
  try {
    await closeDatabase();
    console.log('Database connections closed successfully');
  } catch (error) {
    console.error('Failed to close database connections:', error);
    // Don't throw - cleanup should be best effort
  }
}

/**
 * Setup test database - ensures database is ready and connections are established
 */
export async function setupTestDatabase(): Promise<boolean> {
  try {
    // Initialize database connection
    const db = await getDatabase();

    // Test the connection
    await db.execute('SELECT 1');

    console.log('Test database setup completed successfully');
    return true;
  } catch (error) {
    console.error('Failed to setup test database:', error);
    return false;
  }
}

/**
 * Complete test environment setup - combines database setup with isolation verification
 */
export async function setupTestEnvironment(
  organizationId?: string,
): Promise<boolean> {
  try {
    // First setup database
    const dbReady = await setupTestDatabase();
    if (!dbReady) {
      return false;
    }

    // If organization provided, verify isolation
    if (organizationId) {
      const isolated = await verifyDatabaseIsolation(organizationId);
      if (!isolated) {
        console.warn(
          'Database isolation verification failed, but continuing with tests',
        );
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to setup test environment:', error);
    return false;
  }
}

/**
 * Complete test environment teardown - cleanup data and close connections
 */
export async function teardownTestEnvironment(
  organizationId?: string,
): Promise<void> {
  try {
    // Clean up test data if organization provided
    if (organizationId) {
      await clearTestDatabase(organizationId);
    }

    // Close database connections
    await closeTestDatabase();

    console.log('Test environment teardown completed');
  } catch (error) {
    console.error('Failed to teardown test environment:', error);
    // Don't throw - cleanup should be best effort
  }
}
