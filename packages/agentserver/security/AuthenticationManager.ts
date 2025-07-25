import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Authentication and Authorization Manager for ELIZA Game
 *
 * Implements secure authentication, role-based access control,
 * and session management to protect admin functions
 */

interface User {
  id: string;
  username: string;
  email?: string;
  roles: string[];
  permissions: string[];
  created: Date;
  lastLogin?: Date;
  active: boolean;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  created: Date;
  expires: Date;
  ip?: string;
  userAgent?: string;
  active: boolean;
}

interface AuthConfig {
  tokenSecret: string;
  sessionTimeout: number; // in milliseconds
  maxSessions: number;
  requireMFA: boolean;
  allowGuestAccess: boolean;
}

export class AuthenticationManager {
  private users = new Map<string, User>();
  private sessions = new Map<string, Session>();
  private config: AuthConfig;
  private loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = {
      tokenSecret: config.tokenSecret || crypto.randomBytes(32).toString('hex'),
      sessionTimeout: config.sessionTimeout || 24 * 60 * 60 * 1000, // 24 hours
      maxSessions: config.maxSessions || 5,
      requireMFA: config.requireMFA || false,
      allowGuestAccess: config.allowGuestAccess || false
    };

    // Create default admin user if none exists
    this.initializeDefaultAdmin();
  }

  /**
   * Initialize default admin user for initial setup
   */
  private initializeDefaultAdmin(): void {
    const adminId = 'admin-default';

    if (!this.users.has(adminId)) {
      const defaultAdmin: User = {
        id: adminId,
        username: 'admin',
        email: 'admin@eliza-game.local',
        roles: ['admin', 'system'],
        permissions: [
          'config:read',
          'config:write',
          'agent:control',
          'debug:access',
          'users:manage',
          'secrets:manage'
        ],
        created: new Date(),
        active: true
      };

      this.users.set(adminId, defaultAdmin);
      console.log('[AUTH] Default admin user created - CHANGE DEFAULT CREDENTIALS');
    }
  }

  /**
   * Authenticate user with username/password
   */
  async authenticate(
    username: string,
    password: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ token: string; user: User } | null> {
    try {
      // Check for rate limiting
      if (this.isRateLimited(ip || username)) {
        throw new Error('Too many login attempts. Please try again later.');
      }

      // For demo purposes, we'll use a simple authentication
      // In production, this should validate against a secure password hash
      const user = Array.from(this.users.values()).find(u => u.username === username);

      if (!user || !user.active) {
        this.recordFailedAttempt(ip || username);
        return null;
      }

      // Simple password check (in production, use bcrypt or similar)
      const validPassword = await this.validatePassword(password, user);
      if (!validPassword) {
        this.recordFailedAttempt(ip || username);
        return null;
      }

      // Create session
      const session = await this.createSession(user.id, ip, userAgent);

      // Update user last login
      user.lastLogin = new Date();

      // Clear failed attempts
      this.loginAttempts.delete(ip || username);

      console.log(`[AUTH] User authenticated: ${username} from ${ip || 'unknown'}`);

      return {
        token: session.token,
        user: { ...user }
      };

    } catch (error) {
      console.error(`[AUTH] Authentication error for ${username}:`, error.message);
      this.recordFailedAttempt(ip || username);
      throw error;
    }
  }

  /**
   * Create a new session for authenticated user
   */
  private async createSession(
    userId: string,
    ip?: string,
    userAgent?: string
  ): Promise<Session> {
    // Clean up expired sessions
    await this.cleanupExpiredSessions();

    // Check session limit
    const userSessions = Array.from(this.sessions.values())
      .filter(s => s.userId === userId && s.active);

    if (userSessions.length >= this.config.maxSessions) {
      // Remove oldest session
      const oldestSession = userSessions.sort((a, b) => a.created.getTime() - b.created.getTime())[0];
      this.sessions.delete(oldestSession.id);
      console.log(`[AUTH] Removed oldest session for user ${userId}`);
    }

    // Create new session
    const sessionId = crypto.randomUUID();
    const expires = new Date(Date.now() + this.config.sessionTimeout);

    // Create a simple secure token using crypto
    const tokenData = {
      sessionId,
      userId,
      exp: expires.getTime()
    };

    const tokenString = JSON.stringify(tokenData);
    const hmac = crypto.createHmac('sha256', this.config.tokenSecret);
    hmac.update(tokenString);
    const signature = hmac.digest('hex');

    const token = `${Buffer.from(tokenString).toString('base64')}.${signature}`;

    const session: Session = {
      id: sessionId,
      userId,
      token,
      created: new Date(),
      expires,
      ip,
      userAgent,
      active: true
    };

    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Validate a JWT token and return user session
   */
  async validateToken(token: string): Promise<{ user: User; session: Session } | null> {
    try {
      // Parse our custom token format
      const parts = token.split('.');
      if (parts.length !== 2) {
        return null;
      }

      const [tokenData, signature] = parts;
      const decodedData = Buffer.from(tokenData, 'base64').toString();

      // Verify signature
      const hmac = crypto.createHmac('sha256', this.config.tokenSecret);
      hmac.update(decodedData);
      const expectedSignature = hmac.digest('hex');

      if (signature !== expectedSignature) {
        return null;
      }

      const decoded = JSON.parse(decodedData);
      const session = this.sessions.get(decoded.sessionId);

      if (!session || !session.active) {
        return null;
      }

      // Check expiration
      if (session.expires < new Date()) {
        session.active = false;
        return null;
      }

      const user = this.users.get(session.userId);
      if (!user || !user.active) {
        session.active = false;
        return null;
      }

      return { user, session };

    } catch (error) {
      console.warn('[AUTH] Token validation failed:', error.message);
      return null;
    }
  }

  /**
   * Express middleware for authentication
   */
  authMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);

        if (!token) {
          if (this.config.allowGuestAccess) {
            // Allow guest access with limited permissions
            (req as any).user = { roles: ['guest'], permissions: [] };
            (req as any).session = null;
            return next();
          }

          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
          });
        }

        const auth = await this.validateToken(token);

        if (!auth) {
          return res.status(401).json({
            success: false,
            error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' }
          });
        }

        // Add user and session to request
        (req as any).user = auth.user;
        (req as any).session = auth.session;

        next();

      } catch (error) {
        console.error('[AUTH] Middleware error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'AUTH_ERROR', message: 'Authentication error' }
        });
      }
    };
  }

  /**
   * Express middleware for authorization (role/permission checking)
   */
  requirePermission(permission: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      if (!this.hasPermission(user, permission)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: `Permission denied: ${permission}` }
        });
      }

      next();
    };
  }

  /**
   * Express middleware for role checking
   */
  requireRole(role: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      if (!user.roles.includes(role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: `Role required: ${role}` }
        });
      }

      next();
    };
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(user: User, permission: string): boolean {
    // Admin role has all permissions
    if (user.roles.includes('admin') || user.roles.includes('system')) {
      return true;
    }

    return user.permissions.includes(permission);
  }

  /**
   * Logout user and invalidate session
   */
  async logout(token: string): Promise<boolean> {
    try {
      // Parse our custom token format
      const parts = token.split('.');
      if (parts.length !== 2) {
        return false;
      }

      const [tokenData, signature] = parts;
      const decodedData = Buffer.from(tokenData, 'base64').toString();

      // Verify signature
      const hmac = crypto.createHmac('sha256', this.config.tokenSecret);
      hmac.update(decodedData);
      const expectedSignature = hmac.digest('hex');

      if (signature !== expectedSignature) {
        return false;
      }

      const decoded = JSON.parse(decodedData);
      const session = this.sessions.get(decoded.sessionId);

      if (session) {
        session.active = false;
        console.log(`[AUTH] User logged out: ${session.userId}`);
        return true;
      }

      return false;

    } catch (error) {
      console.warn('[AUTH] Logout error:', error.message);
      return false;
    }
  }

  /**
   * Extract JWT token from request
   */
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Also check for token in cookies
    return req.cookies?.token || null;
  }

  /**
   * Validate password (simplified for demo)
   */
  private async validatePassword(password: string, user: User): Promise<boolean> {
    // In production, use bcrypt or similar to compare password hashes
    // For demo purposes, using simple comparison

    // Default admin password
    if (user.username === 'admin') {
      return password === 'admin123!'; // CHANGE THIS IN PRODUCTION
    }

    return false;
  }

  /**
   * Check if IP/username is rate limited
   */
  private isRateLimited(identifier: string): boolean {
    const attempts = this.loginAttempts.get(identifier);

    if (!attempts) {
      return false;
    }

    // Allow 5 attempts per 15 minutes
    const maxAttempts = 5;
    const timeWindow = 15 * 60 * 1000; // 15 minutes

    if (attempts.count >= maxAttempts) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();
      return timeSinceLastAttempt < timeWindow;
    }

    return false;
  }

  /**
   * Record failed login attempt
   */
  private recordFailedAttempt(identifier: string): void {
    const existing = this.loginAttempts.get(identifier);

    if (existing) {
      existing.count++;
      existing.lastAttempt = new Date();
    } else {
      this.loginAttempts.set(identifier, {
        count: 1,
        lastAttempt: new Date()
      });
    }
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();

    for (const [sessionId, session] of this.sessions) {
      if (session.expires < now) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  /**
   * Create new user (admin function)
   */
  async createUser(userData: Omit<User, 'id' | 'created'>): Promise<User> {
    const userId = crypto.randomUUID();

    const user: User = {
      id: userId,
      created: new Date(),
      ...userData
    };

    this.users.set(userId, user);

    console.log(`[AUTH] User created: ${user.username}`);

    return user;
  }

  /**
   * Get active sessions for monitoring
   */
  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(s => s.active);
  }
}

/**
 * Singleton instance for the game
 */
export const authManager = new AuthenticationManager();
