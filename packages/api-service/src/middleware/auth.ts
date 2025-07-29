/**
 * Authentication middleware for API service
 */

import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { apiKeys, users, organizations } from '../database/schema.js';
import { getDatabase } from '../database/connection.js';
import type { APIServiceConfig } from '../types/index.js';

// Define context variables type
export type AuthContext = {
  user?: {
    id: string;
    organizationId?: string;
  };
  apiKey?: {
    id: string;
    permissions: string[];
  };
  organization?: {
    id: string;
    subscriptionTier: string;
    limits: {
      maxApiRequests: number;
      maxTokensPerRequest: number;
      allowedModels: string[];
      allowedProviders: string[];
    };
  };
};

export function authMiddleware(config: APIServiceConfig) {
  return async (c: Context, next: Next) => {
    // Skip auth for health endpoints and auth routes
    const path = c.req.path;
    const isHealthEndpoint = path === '/health' || path === '/health/ready';
    const isAuthEndpoint = path.startsWith('/api/auth/');
    
    if (isHealthEndpoint || isAuthEndpoint) {
      return next();
    }

    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
      return c.json(
        {
          error: {
            message: 'Authorization header required',
            type: 'authentication_error',
            code: 'missing_auth_header',
          },
        },
        401
      );
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return c.json(
        {
          error: {
            message: 'Invalid authorization format',
            type: 'authentication_error',
            code: 'invalid_auth_format',
          },
        },
        401
      );
    }

    try {
      // Check if it's an API key (starts with 'eliza_')
      if (token.startsWith('eliza_')) {
        await validateAPIKey(c, token, config);
      } else {
        // Assume it's a JWT token
        await validateJWTToken(c, token, config);
      }

      return await next();
    } catch (error) {
      console.error('Authentication error:', error);

      return c.json(
        {
          error: {
            message: 'Invalid authentication credentials',
            type: 'authentication_error',
            code: 'invalid_credentials',
          },
        },
        401
      );
    }
  };
}

async function validateAPIKey(
  c: Context,
  apiKey: string,
  config: APIServiceConfig
) {
  const db = getDatabase();
  
  try {
    // Find all API keys for this organization (we need to check hashes)
    const keys = await db
      .select({
        id: apiKeys.id,
        keyHash: apiKeys.keyHash,
        permissions: apiKeys.permissions,
        organizationId: apiKeys.organizationId,
        userId: apiKeys.userId,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        rateLimit: apiKeys.rateLimit,
      })
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, apiKey.substring(0, 10))); // Use prefix for faster lookup

    // Check each key hash
    let validKey = null;
    for (const key of keys) {
      if (await bcrypt.compare(apiKey, key.keyHash)) {
        validKey = key;
        break;
      }
    }

    if (!validKey) {
      throw new Error('Invalid API key');
    }

    // Check if key is active
    if (!validKey.isActive) {
      throw new Error('API key is inactive');
    }

    // Check expiration
    if (validKey.expiresAt && new Date(validKey.expiresAt) < new Date()) {
      throw new Error('API key has expired');
    }

    // Get organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, validKey.organizationId))
      .limit(1);

    if (!org) {
      throw new Error('Organization not found');
    }

    // Store auth data in context
    c.set('user', {
      id: validKey.userId,
      organizationId: validKey.organizationId,
    });
    
    c.set('apiKey', {
      id: validKey.id,
      permissions: validKey.permissions as string[],
    });
    
    c.set('organization', {
      id: org.id,
      subscriptionTier: org.subscriptionTier || 'free',
      limits: {
        maxApiRequests: validKey.rateLimit || 100,
        maxTokensPerRequest: 4000,
        allowedModels: ['gpt-4o-mini', 'claude-3.5-sonnet'],
        allowedProviders: ['openai', 'anthropic'],
      },
    });

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ 
        lastUsedAt: new Date(),
        usageCount: (validKey as any).usageCount + 1,
      })
      .where(eq(apiKeys.id, validKey.id));

  } catch (error) {
    console.error('API key validation error:', error);
    throw new Error('Invalid API key');
  }
}

async function validateJWTToken(
  c: Context,
  token: string,
  config: APIServiceConfig
) {
  const db = getDatabase();
  
  try {
    // Verify JWT
    const payload = await verify(token, config.jwtSecret) as {
      sub: string;
      email: string;
      organizationId: string;
      exp: number;
    };

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token has expired');
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Get organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, payload.organizationId))
      .limit(1);

    if (!org) {
      throw new Error('Organization not found');
    }

    // Store auth data in context
    c.set('user', {
      id: user.id,
      organizationId: user.organizationId,
    });
    
    c.set('organization', {
      id: org.id,
      subscriptionTier: org.subscriptionTier || 'free',
      limits: {
        maxApiRequests: 1000,
        maxTokensPerRequest: 4000,
        allowedModels: ['gpt-4o-mini', 'claude-3.5-sonnet'],
        allowedProviders: ['openai', 'anthropic'],
      },
    });

  } catch (error) {
    console.error('JWT validation error:', error);
    throw new Error('Invalid JWT token');
  }
}
