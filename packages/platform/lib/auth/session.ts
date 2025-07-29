/**
 * Session Management for WorkOS Authentication
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
// Use Web Crypto API for Edge Runtime compatibility
import {
  OrganizationRepository,
  UserRepository,
  UserSessionRepository,
  setDatabaseContext,
  clearDatabaseContext,
  type User,
  type Organization,
} from '../database';
import {
  workosAuth,
  mapWorkOSRoleToAppRole,
  getDomainFromEmail,
} from './workos';
import { env } from '../config/env-validation';
import { logger, authLogger } from '../logger';
import { AuthenticationError, DatabaseError, handleApiError } from '../errors';

// JWT secret key - validated at startup
function getJWTSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

const JWT_SECRET = getJWTSecret();

// Session configuration
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_TOKEN_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionData {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
  isAdmin: boolean;
  workosUserId?: string;
  workosOrganizationId?: string;
  status?: 'active' | 'inactive';
  organizationStatus?: 'active' | 'suspended';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Session Management Service
 */
export class SessionService {
  private orgRepo = new OrganizationRepository();
  private userRepo = new UserRepository();
  private sessionRepo = new UserSessionRepository();

  /**
   * Create JWT access token
   */
  private async createAccessToken(sessionData: SessionData): Promise<string> {
    const jwt = await new SignJWT(sessionData as Record<string, any>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .setIssuer('elizaos-platform')
      .setAudience('elizaos-users')
      .sign(JWT_SECRET);

    return jwt;
  }

  /**
   * Create refresh token (random string)
   */
  private createRefreshToken(): string {
    // Use Web Crypto API for Edge Runtime compatibility
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
  }

  /**
   * Verify and decode JWT token
   */
  async verifyAccessToken(token: string): Promise<SessionData | null> {
    try {
      // Validate token format
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        authLogger.debug('Token verification failed: empty or invalid token');
        return null;
      }

      // Verify JWT
      const { payload } = await jwtVerify(token, JWT_SECRET, {
        issuer: 'elizaos-platform',
        audience: 'elizaos-users',
      });

      // Validate payload structure
      const sessionData = payload as unknown as SessionData;

      if (
        !sessionData.userId ||
        !sessionData.organizationId ||
        !sessionData.email
      ) {
        authLogger.warn(
          'Token verification failed: invalid payload structure',
          {
            hasUserId: !!sessionData.userId,
            hasOrgId: !!sessionData.organizationId,
            hasEmail: !!sessionData.email,
          },
        );
        return null;
      }

      authLogger.debug('Token verified successfully', {
        userId: sessionData.userId,
        organizationId: sessionData.organizationId,
        role: sessionData.role,
      });

      return sessionData;
    } catch (error) {
      // Handle specific JWT errors
      if (error instanceof Error) {
        if (error.name === 'JWTExpired') {
          authLogger.debug('Token verification failed: token expired');
          return null;
        }

        if (error.name === 'JWSInvalid') {
          authLogger.debug('Token verification failed: invalid signature');
          return null;
        }

        if (error.name === 'JWTClaimValidationFailed') {
          authLogger.debug(
            'Token verification failed: claim validation failed',
            {
              message: error.message,
            },
          );
          return null;
        }
      }

      // In development mode, provide more helpful error messages
      if (env.NODE_ENV === 'development') {
        authLogger.warn('🔧 Token verification failed in development mode', {
          error: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Unknown',
        });
        authLogger.info('💡 Troubleshooting tips:');
        authLogger.info(
          '  - Try the dev login: POST http://localhost:3333/api/auth/dev-login',
        );
        authLogger.info('  - Clear browser cookies for localhost:3333');
        authLogger.info('  - Check if JWT_SECRET is properly set');
      } else {
        authLogger.error('Token verification failed', error as Error, {
          tokenLength: token?.length || 0,
        });
      }

      return null;
    }
  }

  /**
   * Create user session and tokens
   */
  async createSession(
    user: User,
    organization: Organization,
    request: {
      ipAddress?: string;
      userAgent?: string;
    },
    options: {
      clearExistingSessions?: boolean;
    } = {},
  ): Promise<AuthTokens> {
    try {
      // Validate inputs
      if (!user || !user.id || !user.email) {
        throw new AuthenticationError('Invalid user data for session creation');
      }

      if (!organization || !organization.id) {
        throw new AuthenticationError(
          'Invalid organization data for session creation',
        );
      }

      const sessionData: SessionData = {
        userId: user.id,
        organizationId: organization.id,
        email: user.email,
        role: user.role,
        isAdmin: ['owner', 'admin'].includes(user.role),
        workosUserId: user.workosUserId || undefined,
        workosOrganizationId: organization.workosOrganizationId || undefined,
      };

      authLogger.info('Creating new session', {
        userId: user.id,
        organizationId: organization.id,
        role: user.role,
        clearExisting: options.clearExistingSessions,
        ipAddress: request.ipAddress,
      });

      // Clear existing sessions if requested (useful for dev login)
      if (options.clearExistingSessions) {
        await this.sessionRepo.deleteAllForUser(user.id);
        authLogger.debug('Cleared existing sessions for user', {
          userId: user.id,
        });
      }

      // Create tokens
      const accessToken = await this.createAccessToken(sessionData);
      const refreshToken = this.createRefreshToken();
      const expiresAt = new Date(Date.now() + SESSION_DURATION);

      // Store session in database
      await this.sessionRepo.create({
        userId: user.id,
        organizationId: organization.id,
        sessionToken: accessToken,
        refreshToken,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        expiresAt,
      });

      // Update user's last seen timestamp (skip context validation for dev login)
      await this.userRepo.updateLastSeen(user.id, true);

      authLogger.info('Session created successfully', {
        userId: user.id,
        organizationId: organization.id,
        expiresAt: expiresAt.toISOString(),
      });

      return {
        accessToken,
        refreshToken,
        expiresAt,
      };
    } catch (error) {
      authLogger.error('Failed to create session', error as Error, {
        userId: user?.id,
        organizationId: organization?.id,
        clearExisting: options.clearExistingSessions,
      });

      if (error instanceof AuthenticationError) {
        throw error;
      }

      // Handle database errors
      if (error instanceof Error && error.message.includes('database')) {
        throw new DatabaseError('Failed to store session in database');
      }

      throw new AuthenticationError('Session creation failed');
    }
  }

  /**
   * Refresh session tokens
   */
  async refreshSession(refreshToken: string): Promise<AuthTokens | null> {
    const session = await this.sessionRepo.getByRefreshToken(refreshToken);
    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    // Get fresh user and organization data
    await setDatabaseContext({
      organizationId: session.organizationId,
      userId: session.userId,
    });

    const user = await this.userRepo.getCurrent();
    const organization = await this.orgRepo.getCurrent();

    if (!user || !organization || !user.isActive) {
      await clearDatabaseContext();
      return null;
    }

    // Create new tokens
    const sessionData: SessionData = {
      userId: user.id,
      organizationId: organization.id,
      email: user.email,
      role: user.role,
      isAdmin: ['owner', 'admin'].includes(user.role),
      workosUserId: user.workosUserId || undefined,
      workosOrganizationId: organization.workosOrganizationId || undefined,
    };

    const newAccessToken = await this.createAccessToken(sessionData);
    const newRefreshToken = this.createRefreshToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    // Update session in database
    await this.sessionRepo.delete(session.sessionToken);
    await this.sessionRepo.create({
      userId: user.id,
      organizationId: organization.id,
      sessionToken: newAccessToken,
      refreshToken: newRefreshToken,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      expiresAt,
    });

    await clearDatabaseContext();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    };
  }

  /**
   * Get session from access token
   */
  async getSession(accessToken: string): Promise<SessionData | null> {
    const sessionData = await this.verifyAccessToken(accessToken);
    if (!sessionData) {
      return null;
    }

    // Check if this is a dev token (by checking if it has all required fields for standalone operation)
    const isDevToken =
      sessionData.userId &&
      sessionData.organizationId &&
      sessionData.email &&
      sessionData.role;

    if (isDevToken && process.env.NODE_ENV === 'development') {
      // For dev tokens, skip database session lookup and return the JWT data directly
      authLogger.debug('Using dev token without database session lookup', {
        userId: sessionData.userId,
        organizationId: sessionData.organizationId,
      });
      return sessionData;
    }

    // Verify session exists in database for non-dev tokens
    const session = await this.sessionRepo.getByToken(accessToken);
    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    // Update last active timestamp
    await this.sessionRepo.updateActivity(accessToken);

    return sessionData;
  }

  /**
   * Destroy session
   */
  async destroySession(accessToken: string): Promise<void> {
    await this.sessionRepo.delete(accessToken);
  }

  /**
   * Destroy all sessions for user
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    await this.sessionRepo.deleteAllForUser(userId);
  }

  /**
   * Revoke all sessions for user (alias for destroyAllUserSessions)
   */
  async revokeUserSessions(userId: string): Promise<void> {
    await this.destroyAllUserSessions(userId);
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    return this.sessionRepo.deleteExpired();
  }

  /**
   * Set session cookies
   */
  async setSessionCookies(tokens: AuthTokens): Promise<void> {
    const cookieStore = await cookies();

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    // Set access token cookie
    cookieStore.set('auth-token', tokens.accessToken, {
      ...cookieOptions,
      expires: tokens.expiresAt,
    });

    // Set refresh token cookie (longer duration)
    cookieStore.set('refresh-token', tokens.refreshToken, {
      ...cookieOptions,
      expires: new Date(Date.now() + REFRESH_TOKEN_DURATION),
    });
  }

  /**
   * Clear session cookies
   */
  async clearSessionCookies(): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.delete('auth-token');
    cookieStore.delete('refresh-token');
  }

  /**
   * Get session from cookies
   */
  async getSessionFromCookies(): Promise<SessionData | null> {
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth-token')?.value;

    if (!authToken) {
      return null;
    }

    return this.getSession(authToken);
  }
}

/**
 * Authentication Service - Handles the full auth flow
 */
export class AuthService {
  private sessionService = new SessionService();
  private orgRepo = new OrganizationRepository();
  private userRepo = new UserRepository();

  /**
   * Authenticate user with WorkOS and create local session
   */
  async authenticateWithWorkOS(
    code: string,
    request: {
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<AuthTokens> {
    // Get user data from WorkOS
    const { user: workosUser, organizationId: workosOrgId } =
      await workosAuth.authenticateWithCode(code);

    // Find or create organization
    let organization = workosOrgId
      ? await this.orgRepo.getByWorkosId(workosOrgId)
      : null;

    if (!organization) {
      // Try to find organization by domain
      const domain = getDomainFromEmail(workosUser.email);
      const existingOrg = await this.orgRepo.getBySlug(
        domain.replace('.', '-'),
      );

      if (existingOrg) {
        organization = existingOrg;
      } else {
        // Create new organization
        organization = await this.orgRepo.create({
          name: `${domain} Organization`,
          slug: domain.replace('.', '-'),
          workosOrganizationId: workosOrgId || undefined,
          billingEmail: workosUser.email,
        });
      }
    }

    // Set database context for organization
    await setDatabaseContext({
      organizationId: organization.id,
      isAdmin: true, // Temporary admin access for user operations
    });

    // Find or create user
    let user = workosUser.id
      ? await this.userRepo.getByWorkosId(workosUser.id)
      : await this.userRepo.getByEmail(workosUser.email);

    if (!user) {
      // Create new user
      user = await this.userRepo.create({
        organizationId: organization.id,
        workosUserId: workosUser.id,
        email: workosUser.email,
        firstName: workosUser.firstName || '',
        lastName: workosUser.lastName || '',
        profilePictureUrl: workosUser.profilePictureUrl,
        role: 'member', // TODO: Determine role from WorkOS membership
        emailVerified: workosUser.emailVerified || false,
        emailVerifiedAt: workosUser.emailVerified ? new Date() : undefined,
      });
    } else {
      // Update existing user with fresh WorkOS data
      user = await this.userRepo.updateById(user.id, {
        workosUserId: workosUser.id,
        firstName: workosUser.firstName || user.firstName,
        lastName: workosUser.lastName || user.lastName,
        profilePictureUrl:
          workosUser.profilePictureUrl || user.profilePictureUrl,
        emailVerified: workosUser.emailVerified || user.emailVerified,
        emailVerifiedAt: workosUser.emailVerified
          ? new Date()
          : user.emailVerifiedAt,
      });
    }

    if (!user) {
      throw new Error('Failed to create or update user');
    }

    // Create session - convert user object to match expected format
    const userForSession = {
      ...user,
      metadata: {}, // Add missing metadata field
      lastLoginAt: null, // Add missing lastLoginAt field
      createdAt: user.createdAt ? user.createdAt.getTime() : Date.now(),
      updatedAt: user.updatedAt ? user.updatedAt.getTime() : Date.now(),
    };
    // Convert organization dates to timestamps too
    const orgForSession = {
      ...organization,
      currentPeriodStart: organization.currentPeriodStart
        ? organization.currentPeriodStart.getTime()
        : null,
      currentPeriodEnd: organization.currentPeriodEnd
        ? organization.currentPeriodEnd.getTime()
        : null,
      createdAt: organization.createdAt
        ? organization.createdAt.getTime()
        : Date.now(),
      updatedAt: organization.updatedAt
        ? organization.updatedAt.getTime()
        : Date.now(),
    };
    const tokens = await this.sessionService.createSession(
      userForSession as any,
      orgForSession as any,
      request,
    );

    await clearDatabaseContext();

    return tokens;
  }

  /**
   * Login with email/password (for development/testing)
   */
  async loginWithEmail(
    email: string,
    password: string,
    request: {
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<AuthTokens | null> {
    // For development purposes - in production, use WorkOS
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Email/password login is only available in development');
    }

    // Simple email-based lookup (no password validation in dev)
    const domain = getDomainFromEmail(email);
    const organization = await this.orgRepo.getBySlug(domain.replace('.', '-'));

    if (!organization) {
      return null;
    }

    await setDatabaseContext({
      organizationId: organization.id,
    });

    const user = await this.userRepo.getByEmail(email);
    if (!user || !user.isActive) {
      await clearDatabaseContext();
      return null;
    }

    // Convert user and organization dates to timestamps
    const userForSession = {
      ...user,
      metadata: {},
      lastLoginAt: null,
      createdAt: user.createdAt ? user.createdAt.getTime() : Date.now(),
      updatedAt: user.updatedAt ? user.updatedAt.getTime() : Date.now(),
    };
    const orgForSession = {
      ...organization,
      currentPeriodStart: organization.currentPeriodStart
        ? organization.currentPeriodStart.getTime()
        : null,
      currentPeriodEnd: organization.currentPeriodEnd
        ? organization.currentPeriodEnd.getTime()
        : null,
      createdAt: organization.createdAt
        ? organization.createdAt.getTime()
        : Date.now(),
      updatedAt: organization.updatedAt
        ? organization.updatedAt.getTime()
        : Date.now(),
    };
    const tokens = await this.sessionService.createSession(
      userForSession as any,
      orgForSession as any,
      request,
    );
    await clearDatabaseContext();

    return tokens;
  }

  /**
   * Logout user
   */
  async logout(accessToken: string): Promise<void> {
    await this.sessionService.destroySession(accessToken);
  }

  /**
   * Get current user from session
   */
  async getCurrentUser(): Promise<User | null> {
    const sessionData = await this.sessionService.getSessionFromCookies();
    if (!sessionData) {
      return null;
    }

    // Check if this is a dev token with all required user data
    const isDevToken =
      sessionData.userId &&
      sessionData.organizationId &&
      sessionData.email &&
      sessionData.role;

    if (isDevToken && process.env.NODE_ENV === 'development') {
      // For dev tokens, return user data directly from JWT without database lookup
      authLogger.debug('Returning dev user data from JWT token', {
        userId: sessionData.userId,
        organizationId: sessionData.organizationId,
      });

      return {
        id: sessionData.userId,
        organizationId: sessionData.organizationId,
        email: sessionData.email,
        firstName: 'Developer',
        lastName: 'User',
        role: sessionData.role,
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        workosUserId: null,
        profilePictureUrl: null,
        preferences: {},
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
    }

    // For non-dev tokens, use database lookup
    await setDatabaseContext({
      organizationId: sessionData.organizationId,
      userId: sessionData.userId,
    });

    const user = await this.userRepo.getCurrent();
    await clearDatabaseContext();

    if (!user) {
      return null;
    }

    // Transform user to match expected type
    return {
      ...user,
      metadata: user.metadata || {},
    } as any;
  }

  /**
   * Get current organization from session
   */
  async getCurrentOrganization(): Promise<Organization | null> {
    const sessionData = await this.sessionService.getSessionFromCookies();
    if (!sessionData) {
      return null;
    }

    // Check if this is a dev token with all required organization data
    const isDevToken =
      sessionData.userId &&
      sessionData.organizationId &&
      sessionData.email &&
      sessionData.role;

    if (isDevToken && process.env.NODE_ENV === 'development') {
      // For dev tokens, return organization data directly without database lookup
      authLogger.debug('Returning dev organization data from JWT token', {
        organizationId: sessionData.organizationId,
      });

      return {
        id: sessionData.organizationId,
        name: 'ElizaOS Development',
        slug: 'elizaos-dev',
        subscriptionTier: 'premium',
        creditBalance: 1000,
        subscriptionStatus: 'active',
        workosOrganizationId: null,
        billingEmail: 'dev@elizaos.ai',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
    }

    // For non-dev tokens, use database lookup
    await setDatabaseContext({
      organizationId: sessionData.organizationId,
    });

    const organization = await this.orgRepo.getCurrent();
    await clearDatabaseContext();

    return organization;
  }
}

// Export singleton instances
export const sessionService = new SessionService();
export const authService = new AuthService();
