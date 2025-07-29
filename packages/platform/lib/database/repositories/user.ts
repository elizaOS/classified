/**
 * User repository with RLS-aware database operations
 */

import { eq, and, or, desc, asc, ilike, count, lt } from 'drizzle-orm';
import { getDatabase } from '../index';
import {
  users,
  userSessions,
  type User,
  type NewUser,
  type UserSession,
  type NewUserSession,
} from '../index';
import {
  validateDatabaseContext,
  getCurrentOrganizationId,
  getCurrentUserId,
} from '../context';

export class UserRepository {
  private async getDb() {
    return await getDatabase();
  }

  /**
   * Get current user (based on RLS context)
   */
  async getCurrent(): Promise<User | null> {
    await validateDatabaseContext();

    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }

    const db = await this.getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user || null;
  }

  /**
   * Get user by ID (within organization)
   */
  async getById(id: string): Promise<User | null> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  /**
   * Get user by email (within organization)
   */
  async getByEmail(email: string): Promise<User | null> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  }

  /**
   * Get user by WorkOS user ID
   */
  async getByWorkosId(workosUserId: string): Promise<User | null> {
    const db = await this.getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.workosUserId, workosUserId))
      .limit(1);

    return user || null;
  }

  /**
   * Get all users in organization
   */
  async getAll(
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      role?: string;
      isActive?: boolean;
      sortBy?: 'name' | 'email' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<User[]> {
    await validateDatabaseContext();

    const {
      limit = 50,
      offset = 0,
      search,
      role,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // Build where conditions array
    const conditions: any[] = [];

    // Add search filter
    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
        ),
      );
    }

    // Add role filter
    if (role) {
      conditions.push(eq(users.role, role));
    }

    // Add active filter
    if (isActive !== undefined) {
      conditions.push(eq(users.isActive, isActive));
    }

    // Build and execute query
    const db = await this.getDb();
    const baseQuery = db.select().from(users);

    // Determine sort column
    const sortCol =
      sortBy === 'email'
        ? users.email
        : sortBy === 'name'
          ? users.firstName
          : users.createdAt;

    const finalQuery =
      conditions.length > 0
        ? baseQuery
            .where(and(...conditions))
            .orderBy(sortOrder === 'desc' ? desc(sortCol) : asc(sortCol))
            .limit(limit)
            .offset(offset)
        : baseQuery
            .orderBy(sortOrder === 'desc' ? desc(sortCol) : asc(sortCol))
            .limit(limit)
            .offset(offset);

    return finalQuery;
  }

  /**
   * Create a new user
   */
  async create(data: NewUser): Promise<User> {
    const db = await this.getDb();
    const [user] = await db
      .insert(users)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    return user;
  }

  /**
   * Update current user
   */
  async updateCurrent(data: Partial<NewUser>): Promise<User | null> {
    await validateDatabaseContext();

    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }

    const db = await this.getDb();
    const [user] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return user || null;
  }

  /**
   * Update user by ID (admin only)
   */
  async updateById(id: string, data: Partial<NewUser>): Promise<User | null> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const [user] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return user || null;
  }

  /**
   * Update user's last seen timestamp
   */
  async updateLastSeen(
    userId?: string,
    skipContextValidation = false,
  ): Promise<void> {
    // Skip context validation for dev login or when explicitly requested
    if (!skipContextValidation) {
      await validateDatabaseContext();
    }

    const targetUserId = userId || (await getCurrentUserId());
    if (!targetUserId) {
      return;
    }

    // Simply update the updatedAt timestamp since lastSeenAt/lastLoginAt fields were removed from schema
    const db = await this.getDb();
    await db
      .update(users)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId));
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivate(userId: string): Promise<boolean> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const result = await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return true; // If no error was thrown, operation was successful
  }

  /**
   * Reactivate user
   */
  async activate(userId: string): Promise<boolean> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const result = await db
      .update(users)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return true; // If no error was thrown, operation was successful
  }

  /**
   * Update user role (admin only)
   */
  async updateRole(userId: string, role: string): Promise<User | null> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const [user] = await db
      .update(users)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return user || null;
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string): Promise<User | null> {
    const db = await this.getDb();
    const [user] = await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return user || null;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<User['preferences']>,
  ): Promise<User | null> {
    const user = await this.getById(userId);
    if (!user) {
      return null;
    }

    const updatedPreferences = {
      ...user.preferences,
      ...preferences,
    };

    const db = await this.getDb();
    const [updatedUser] = await db
      .update(users)
      .set({
        preferences: updatedPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser || null;
  }

  /**
   * Get user count by role
   */
  async getCountByRole(): Promise<Record<string, number>> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const results = await db
      .select({
        role: users.role,
        count: count(users.id),
      })
      .from(users)
      .where(eq(users.isActive, true))
      .groupBy(users.role);

    return results.reduce(
      (acc: Record<string, number>, result: any) => {
        acc[result.role] = result.count;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Check if user exists by email in organization
   */
  async existsByEmail(email: string): Promise<boolean> {
    await validateDatabaseContext();

    const db = await this.getDb();
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return !!user;
  }

  /**
   * Check if user has permission
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const user = await this.getById(userId);
    if (!user) {
      return false;
    }

    // Role-based permissions
    const rolePermissions = {
      owner: ['*'], // All permissions
      admin: [
        'users:read',
        'users:write',
        'users:delete',
        'agents:read',
        'agents:write',
        'agents:delete',
        'api_keys:read',
        'api_keys:write',
        'api_keys:delete',
        'billing:read',
        'billing:write',
        'webhooks:read',
        'webhooks:write',
        'webhooks:delete',
        'audit_logs:read',
      ],
      member: [
        'users:read',
        'agents:read',
        'agents:write',
        'api_keys:read',
        'api_keys:write',
        'billing:read',
      ],
      viewer: ['users:read', 'agents:read', 'billing:read'],
    };

    const userPermissions =
      rolePermissions[user.role as keyof typeof rolePermissions] || [];

    return (
      userPermissions.includes('*') || userPermissions.includes(permission)
    );
  }

  /**
   * Get user by ID globally (bypasses RLS - for system operations like device auth)
   * WARNING: Use only for system operations that need to bypass organization boundaries
   */
  async getByIdGlobal(id: string): Promise<User | null> {
    const db = await this.getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  /**
   * Get user by email globally (bypasses RLS - for system operations like device auth)
   * WARNING: Use only for system operations that need to bypass organization boundaries
   */
  async getByEmailGlobal(email: string): Promise<User | null> {
    const db = await this.getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  }

  /**
   * Validate user exists and is active (for device authorization)
   */
  async validateUserForDeviceAuth(userId: string): Promise<{
    isValid: boolean;
    user?: User;
    error?: string;
  }> {
    const user = await this.getByIdGlobal(userId);

    if (!user) {
      return {
        isValid: false,
        error: 'User not found',
      };
    }

    if (!user.isActive) {
      return {
        isValid: false,
        error: 'User account is deactivated',
      };
    }

    return {
      isValid: true,
      user,
    };
  }
}

/**
 * User Session Repository
 */
export class UserSessionRepository {
  private async getDb() {
    return await getDatabase();
  }

  /**
   * Create a new session
   */
  async create(data: NewUserSession): Promise<UserSession> {
    const db = await this.getDb();
    const [session] = await db.insert(userSessions).values(data).returning();

    return session;
  }

  /**
   * Get session by token
   */
  async getByToken(sessionToken: string): Promise<UserSession | null> {
    const db = await this.getDb();
    const [session] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionToken, sessionToken))
      .limit(1);

    return session || null;
  }

  /**
   * Get session by refresh token
   */
  async getByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    const db = await this.getDb();
    const [session] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.refreshToken, refreshToken))
      .limit(1);

    return session || null;
  }

  /**
   * Update session activity
   */
  async updateActivity(sessionToken: string): Promise<UserSession | null> {
    const db = await this.getDb();
    const [session] = await db
      .update(userSessions)
      .set({
        lastActiveAt: new Date(),
      })
      .where(eq(userSessions.sessionToken, sessionToken))
      .returning();

    return session || null;
  }

  /**
   * Delete session
   */
  async delete(sessionToken: string): Promise<boolean> {
    const db = await this.getDb();
    const result = await db
      .delete(userSessions)
      .where(eq(userSessions.sessionToken, sessionToken));

    return true; // If no error was thrown, operation was successful
  }

  /**
   * Delete all sessions for user
   */
  async deleteAllForUser(userId: string): Promise<number> {
    const db = await this.getDb();
    const result = await db
      .delete(userSessions)
      .where(eq(userSessions.userId, userId));

    return 0; // Cannot determine actual count with Drizzle ORM
  }

  /**
   * Delete expired sessions
   */
  async deleteExpired(): Promise<number> {
    const db = await this.getDb();
    const result = await db
      .delete(userSessions)
      .where(lt(userSessions.expiresAt, new Date()));

    return 0; // Cannot determine actual count with Drizzle ORM
  }

  /**
   * Get all sessions for user
   */
  async getAllForUser(userId: string): Promise<UserSession[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.lastActiveAt));
  }
}

// Export singleton instances
export const userRepository = new UserRepository();
export const userSessionRepository = new UserSessionRepository();
