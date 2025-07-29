import { NextRequest } from 'next/server';
import { getDatabase } from '@/lib/database';
import { users, organizations, userSessions } from '@/lib/database/schema';
import { eq, and } from 'drizzle-orm';
import { verifyJWT } from '@/lib/server/utils/jwt';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  organizationId: string;
  role: string;
}

export interface AuthenticatedOrganization {
  id: string;
  name: string;
  slug: string;
  creditBalance: string;
  stripeCustomerId: string | null;
}

export interface AuthenticationResult {
  user: AuthenticatedUser | null;
  organization: AuthenticatedOrganization | null;
  session: any | null;
}

/**
 * Authenticate user from request using JWT token or session cookie
 */
export async function authenticateUser(
  request: NextRequest,
): Promise<AuthenticationResult> {
  try {
    // Try JWT token first (Authorization header)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          // SECURITY: Fail-safe when JWT_SECRET is missing
          console.error(
            '❌ JWT_SECRET not configured - rejecting JWT authentication',
          );
          // Do NOT continue to session cookies for JWT auth - fail fast
          return { user: null, organization: null, session: null };
        }

        const payload = await verifyJWT(token, jwtSecret);

        if (payload && typeof payload === 'object' && 'userId' in payload) {
          const userId = payload.userId as string;
          return await getUserWithOrganization(userId);
        } else {
          console.warn('Invalid JWT payload structure');
          return { user: null, organization: null, session: null };
        }
      } catch (jwtError) {
        console.warn('JWT verification failed:', jwtError);
        // Return explicit failure for JWT authentication
        return { user: null, organization: null, session: null };
      }
    }

    // Try session cookie
    const sessionToken = request.cookies.get('session-token')?.value;
    if (sessionToken) {
      return await authenticateSession(sessionToken);
    }

    return { user: null, organization: null, session: null };
  } catch (error) {
    console.error('Authentication error:', error);
    return { user: null, organization: null, session: null };
  }
}

/**
 * Authenticate using session token
 */
async function authenticateSession(
  sessionToken: string,
): Promise<AuthenticationResult> {
  try {
    // Find active session
    const database = await getDatabase();
    const [session] = await database
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.sessionToken, sessionToken),
          // Session not expired (comparing with current timestamp)
        ),
      )
      .limit(1);

    if (!session || new Date() > session.expiresAt) {
      return { user: null, organization: null, session: null };
    }

    // Update last active timestamp
    const database2 = await getDatabase();
    await database2
      .update(userSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(userSessions.id, session.id));

    return await getUserWithOrganization(session.userId);
  } catch (error) {
    console.error('Session authentication error:', error);
    return { user: null, organization: null, session: null };
  }
}

/**
 * Get user with organization details
 */
async function getUserWithOrganization(
  userId: string,
): Promise<AuthenticationResult> {
  try {
    const database = await getDatabase();
    const [result] = await database
      .select({
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          organizationId: users.organizationId,
          role: users.role,
        },
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          creditBalance: organizations.creditBalance,
          stripeCustomerId: organizations.stripeCustomerId,
        },
      })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(and(eq(users.id, userId), eq(users.isActive, true)))
      .limit(1);

    if (!result) {
      return { user: null, organization: null, session: null };
    }

    return {
      user: result.user,
      organization: result.organization,
      session: null,
    };
  } catch (error) {
    console.error('Error fetching user with organization:', error);
    return { user: null, organization: null, session: null };
  }
}

/**
 * Session Manager class for backward compatibility
 */
export class SessionManager {
  private static instance: SessionManager;

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async createSession(
    userId: string,
    options: {
      ipAddress?: string;
      userAgent?: string;
      expiresInDays?: number;
    } = {},
  ): Promise<{ sessionToken: string; refreshToken: string }> {
    const { ipAddress, userAgent, expiresInDays = 30 } = options;

    // Generate secure tokens
    const sessionToken = crypto.randomUUID();
    const refreshToken = crypto.randomUUID();

    // Get user's organization
    const database = await getDatabase();
    const [user] = await database
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Store session in database
    const database2 = await getDatabase();
    await database2.insert(userSessions).values({
      userId,
      organizationId: user.organizationId,
      sessionToken,
      refreshToken,
      ipAddress,
      userAgent,
      expiresAt,
    });

    return { sessionToken, refreshToken };
  }

  async validateSession(
    sessionToken: string,
  ): Promise<AuthenticatedUser | null> {
    const result = await authenticateSession(sessionToken);
    return result.user;
  }

  async refreshSession(
    refreshToken: string,
  ): Promise<{ sessionToken: string; refreshToken: string } | null> {
    try {
      // Find session by refresh token
      const database = await getDatabase();
      const [session] = await database
        .select()
        .from(userSessions)
        .where(eq(userSessions.refreshToken, refreshToken))
        .limit(1);

      if (!session || new Date() > session.expiresAt) {
        return null;
      }

      // Generate new tokens
      const newSessionToken = crypto.randomUUID();
      const newRefreshToken = crypto.randomUUID();

      // Update session with new tokens
      const database2 = await getDatabase();
      await database2
        .update(userSessions)
        .set({
          sessionToken: newSessionToken,
          refreshToken: newRefreshToken,
          lastActiveAt: new Date(),
        })
        .where(eq(userSessions.id, session.id));

      return {
        sessionToken: newSessionToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      console.error('Session refresh error:', error);
      return null;
    }
  }

  async deleteSession(sessionToken: string): Promise<void> {
    const database = await getDatabase();
    await database
      .delete(userSessions)
      .where(eq(userSessions.sessionToken, sessionToken));
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    const database = await getDatabase();
    await database.delete(userSessions).where(eq(userSessions.userId, userId));
  }
}
