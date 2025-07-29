/**
 * Authentication Context System
 * Proper user and organization authentication for all services
 */

import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { User, Organization } from '@/lib/database/schema';

// Authentication context interface
export interface AuthContext {
  userId: string;
  organizationId: string;
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: string[];
  user: Partial<User>;
  organization: Partial<Organization>;
  sessionType: 'jwt' | 'wallet' | 'api_key';
  isAuthenticated: boolean;
}

// JWT payload structure
export interface JWTPayload {
  userId: string;
  organizationId: string;
  userRole: string;
  permissions: string[];
  sessionType: 'jwt' | 'wallet';
  iat: number;
  exp: number;
}

// Wallet-based JWT payload
export interface WalletJWTPayload extends JWTPayload {
  walletAddress: string;
  chainId: number;
  sessionType: 'wallet';
}

// API Key context
export interface ApiKeyContext {
  keyId: string;
  organizationId: string;
  userId?: string;
  permissions: string[];
  rateLimit: number;
  sessionType: 'api_key';
}

// Validation schemas
export const authContextSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  userRole: z.enum(['owner', 'admin', 'member', 'viewer']),
  permissions: z.array(z.string()),
  sessionType: z.enum(['jwt', 'wallet', 'api_key']),
  isAuthenticated: z.boolean(),
});

export const jwtPayloadSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  userRole: z.string(),
  permissions: z.array(z.string()),
  sessionType: z.enum(['jwt', 'wallet']),
  iat: z.number(),
  exp: z.number(),
});

export const walletJWTPayloadSchema = jwtPayloadSchema.extend({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number(),
  sessionType: z.literal('wallet'),
});

/**
 * JWT Token Management Service
 */
export class JWTService {
  private readonly jwtSecret: string;
  private readonly issuer: string = 'elizaos-platform';

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET!;
    if (!this.jwtSecret || this.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
  }

  /**
   * Generate standard JWT token for user authentication
   */
  generateUserToken(user: User, organization: Organization): string {
    const payload: JWTPayload = {
      userId: user.id,
      organizationId: user.organizationId,
      userRole: user.role as 'owner' | 'admin' | 'member' | 'viewer',
      permissions: this.getUserPermissions(user.role),
      sessionType: 'jwt',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    };

    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256',
      issuer: this.issuer,
    });
  }

  /**
   * Generate wallet-based JWT token
   */
  generateWalletToken(
    userId: string,
    organizationId: string,
    walletAddress: string,
    chainId: number,
    userRole: string = 'member',
  ): string {
    const payload: WalletJWTPayload = {
      userId,
      organizationId,
      userRole,
      permissions: this.getUserPermissions(userRole),
      walletAddress,
      chainId,
      sessionType: 'wallet',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    };

    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256',
      issuer: this.issuer,
    });
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): JWTPayload | WalletJWTPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.issuer,
        algorithms: ['HS256'],
      }) as JWTPayload | WalletJWTPayload;

      // Validate payload structure
      if (decoded.sessionType === 'wallet') {
        walletJWTPayloadSchema.parse(decoded);
      } else {
        jwtPayloadSchema.parse(decoded);
      }

      return decoded;
    } catch (error) {
      throw new Error(
        `Invalid JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(payload: JWTPayload): boolean {
    return payload.exp <= Math.floor(Date.now() / 1000);
  }

  /**
   * Refresh token (create new one with extended expiration)
   */
  refreshToken(payload: JWTPayload | WalletJWTPayload): string {
    const newPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    };

    return jwt.sign(newPayload, this.jwtSecret, {
      algorithm: 'HS256',
      issuer: this.issuer,
    });
  }

  /**
   * Get user permissions based on role
   */
  private getUserPermissions(role: string): string[] {
    const permissionMap: Record<string, string[]> = {
      owner: [
        'org:read',
        'org:write',
        'org:delete',
        'users:read',
        'users:write',
        'users:delete',
        'agents:read',
        'agents:write',
        'agents:delete',
        'agents:deploy',
        'billing:read',
        'billing:write',
        'api_keys:read',
        'api_keys:write',
        'api_keys:delete',
        'generations:read',
        'generations:write',
        'crypto:read',
        'crypto:write',
        'chat:read',
        'chat:write',
      ],
      admin: [
        'org:read',
        'users:read',
        'users:write',
        'agents:read',
        'agents:write',
        'agents:deploy',
        'billing:read',
        'api_keys:read',
        'api_keys:write',
        'generations:read',
        'generations:write',
        'crypto:read',
        'crypto:write',
        'chat:read',
        'chat:write',
      ],
      member: [
        'org:read',
        'users:read',
        'agents:read',
        'agents:write',
        'billing:read',
        'generations:read',
        'generations:write',
        'crypto:read',
        'crypto:write',
        'chat:read',
        'chat:write',
      ],
      viewer: [
        'org:read',
        'users:read',
        'agents:read',
        'billing:read',
        'generations:read',
        'chat:read',
      ],
    };

    return permissionMap[role] || permissionMap.viewer;
  }
}

/**
 * Authentication Context Builder
 */
export class AuthContextBuilder {
  private jwtService: JWTService;

  constructor() {
    this.jwtService = new JWTService();
  }

  /**
   * Build auth context from JWT token
   */
  async buildFromJWT(
    token: string,
    user?: User,
    organization?: Organization,
  ): Promise<AuthContext> {
    const payload = this.jwtService.verifyToken(token);

    if (this.jwtService.isTokenExpired(payload)) {
      throw new Error('Token has expired');
    }

    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      userRole: payload.userRole as 'owner' | 'admin' | 'member' | 'viewer',
      permissions: payload.permissions,
      user: user || {
        id: payload.userId,
        organizationId: payload.organizationId,
      },
      organization: organization || { id: payload.organizationId },
      sessionType: payload.sessionType,
      isAuthenticated: true,
    };
  }

  /**
   * Build auth context from API key
   */
  async buildFromApiKey(
    apiKeyContext: ApiKeyContext,
    user?: User,
    organization?: Organization,
  ): Promise<AuthContext> {
    return {
      userId: apiKeyContext.userId || 'api-key-user',
      organizationId: apiKeyContext.organizationId,
      userRole: 'member', // API keys have member-level permissions by default
      permissions: apiKeyContext.permissions,
      user: user || {
        id: apiKeyContext.userId,
        organizationId: apiKeyContext.organizationId,
      },
      organization: organization || { id: apiKeyContext.organizationId },
      sessionType: 'api_key',
      isAuthenticated: true,
    };
  }

  /**
   * Build guest context for unauthenticated requests
   */
  buildGuestContext(organizationId?: string): AuthContext {
    return {
      userId: 'guest',
      organizationId: organizationId || 'default',
      userRole: 'viewer',
      permissions: ['public:read'],
      user: { id: 'guest' },
      organization: { id: organizationId || 'default' },
      sessionType: 'jwt',
      isAuthenticated: false,
    };
  }

  /**
   * Build system context for internal operations
   */
  buildSystemContext(organizationId: string): AuthContext {
    return {
      userId: 'system',
      organizationId,
      userRole: 'owner',
      permissions: ['*'], // System has all permissions
      user: { id: 'system' },
      organization: { id: organizationId },
      sessionType: 'jwt',
      isAuthenticated: true,
    };
  }

  /**
   * Validate and normalize auth context
   */
  validateContext(context: Partial<AuthContext>): AuthContext {
    const result = authContextSchema.parse({
      ...context,
      isAuthenticated: context.isAuthenticated ?? false,
    });

    return {
      ...result,
      user: context.user || { id: result.userId },
      organization: context.organization || { id: result.organizationId },
    };
  }
}

/**
 * Permission checking utilities
 */
export class PermissionChecker {
  /**
   * Check if context has specific permission
   */
  static hasPermission(context: AuthContext, permission: string): boolean {
    if (context.permissions.includes('*')) {
      return true; // System permissions
    }

    return context.permissions.includes(permission);
  }

  /**
   * Check if context has any of the specified permissions
   */
  static hasAnyPermission(
    context: AuthContext,
    permissions: string[],
  ): boolean {
    if (context.permissions.includes('*')) {
      return true;
    }

    return permissions.some((permission) =>
      context.permissions.includes(permission),
    );
  }

  /**
   * Check if context has all specified permissions
   */
  static hasAllPermissions(
    context: AuthContext,
    permissions: string[],
  ): boolean {
    if (context.permissions.includes('*')) {
      return true;
    }

    return permissions.every((permission) =>
      context.permissions.includes(permission),
    );
  }

  /**
   * Check if context can access resource for organization
   */
  static canAccessOrganization(
    context: AuthContext,
    organizationId: string,
  ): boolean {
    return (
      context.organizationId === organizationId ||
      context.permissions.includes('*')
    );
  }

  /**
   * Check if context can modify resource
   */
  static canModify(context: AuthContext, resource: string): boolean {
    return (
      this.hasPermission(context, `${resource}:write`) ||
      this.hasPermission(context, `${resource}:delete`)
    );
  }

  /**
   * Ensure context has permission (throws if not)
   */
  static requirePermission(
    context: AuthContext,
    permission: string,
    message?: string,
  ): void {
    if (!this.hasPermission(context, permission)) {
      throw new Error(message || `Permission denied: ${permission} required`);
    }
  }

  /**
   * Ensure context can access organization (throws if not)
   */
  static requireOrganizationAccess(
    context: AuthContext,
    organizationId: string,
  ): void {
    if (!this.canAccessOrganization(context, organizationId)) {
      throw new Error(
        `Access denied: Cannot access organization ${organizationId}`,
      );
    }
  }
}

// Singleton instances
export const jwtService = new JWTService();
export const authContextBuilder = new AuthContextBuilder();

// Types are already exported as interfaces above
