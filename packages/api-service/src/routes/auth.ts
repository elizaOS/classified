/**
 * Authentication routes for API service
 */

import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { users, apiKeys, organizations } from '../database/schema.js';
import { getDatabase } from '../database/connection.js';
import type { APIServiceConfig } from '../types/index.js';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationName: z.string().min(1).optional(),
});

const createApiKeySchema = z.object({
  name: z.string().min(1),
  permissions: z.array(z.string()).default(['completions:read']),
  expiresIn: z.enum(['30d', '90d', '1y', 'never']).optional(),
});

export function authRoutes(config: APIServiceConfig) {
  const app = new Hono();
  const db = getDatabase();

  // Login endpoint
  app.post('/login', async (c) => {
    try {
      const body = await c.req.json();
      const { email, password } = loginSchema.parse(body);

      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      
      if (!user || !await bcrypt.compare(password, user.passwordHash)) {
        return c.json({ 
          error: { 
            message: 'Invalid email or password',
            type: 'authentication_error' 
          } 
        }, 401);
      }

      // Generate JWT
      const token = await sign({
        sub: user.id,
        email: user.email,
        organizationId: user.organizationId,
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
      }, config.jwtSecret);

      return c.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            organizationId: user.organizationId,
          },
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof z.ZodError) {
        return c.json({ 
          error: { 
            message: 'Invalid request data',
            type: 'validation_error',
            details: error.errors 
          } 
        }, 400);
      }
      return c.json({ 
        error: { 
          message: 'Internal server error',
          type: 'internal_error' 
        } 
      }, 500);
    }
  });

  // Signup endpoint
  app.post('/signup', async (c) => {
    try {
      const body = await c.req.json();
      const { email, password, name, organizationName } = signupSchema.parse(body);

      // Check if user exists
      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        return c.json({ 
          error: { 
            message: 'Email already registered',
            type: 'validation_error' 
          } 
        }, 400);
      }

      // Create organization
      const orgId = nanoid();
      await db.insert(organizations).values({
        id: orgId,
        name: organizationName || `${name}'s Organization`,
        ownerId: '', // Will update after user creation
      });

      // Create user
      const userId = nanoid();
      const passwordHash = await bcrypt.hash(password, 10);
      
      await db.insert(users).values({
        id: userId,
        email,
        name,
        passwordHash,
        organizationId: orgId,
        role: 'owner',
      });

      // Update organization owner
      await db.update(organizations).set({ ownerId: userId }).where(eq(organizations.id, orgId));

      // Generate JWT
      const token = await sign({
        sub: userId,
        email,
        organizationId: orgId,
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
      }, config.jwtSecret);

      return c.json({
        success: true,
        data: {
          token,
          user: {
            id: userId,
            email,
            name,
            organizationId: orgId,
          },
        },
      });
    } catch (error) {
      console.error('Signup error:', error);
      if (error instanceof z.ZodError) {
        return c.json({ 
          error: { 
            message: 'Invalid request data',
            type: 'validation_error',
            details: error.errors 
          } 
        }, 400);
      }
      return c.json({ 
        error: { 
          message: 'Internal server error',
          type: 'internal_error' 
        } 
      }, 500);
    }
  });

  // Get current user
  app.get('/me', async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ 
        error: { 
          message: 'Not authenticated',
          type: 'authentication_error' 
        } 
      }, 401);
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    
    return c.json({
      success: true,
      data: {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          organizationId: dbUser.organizationId,
          role: dbUser.role,
        },
      },
    });
  });

  // Create API key
  app.post('/keys', async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ 
        error: { 
          message: 'Not authenticated',
          type: 'authentication_error' 
        } 
      }, 401);
    }

    try {
      const body = await c.req.json();
      const { name, permissions, expiresIn } = createApiKeySchema.parse(body);

      // Generate API key
      const keyId = nanoid();
      const keySecret = `eliza_${nanoid(32)}`;
      const keyHash = await bcrypt.hash(keySecret, 10);

      // Calculate expiration
      let expiresAt = null;
      if (expiresIn && expiresIn !== 'never') {
        const now = new Date();
        switch (expiresIn) {
          case '30d':
            expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
            break;
          case '1y':
            expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            break;
        }
      }

      // Create API key
      await db.insert(apiKeys).values({
        id: keyId,
        organizationId: user.organizationId,
        userId: user.id,
        name,
        keyHash,
        keyPrefix: keySecret.substring(0, 10),
        permissions,
        expiresAt,
      });

      return c.json({
        success: true,
        data: {
          apiKey: {
            id: keyId,
            name,
            key: keySecret, // Only returned on creation
            permissions,
            expiresAt,
            createdAt: new Date(),
          },
        },
      });
    } catch (error) {
      console.error('Create API key error:', error);
      if (error instanceof z.ZodError) {
        return c.json({ 
          error: { 
            message: 'Invalid request data',
            type: 'validation_error',
            details: error.errors 
          } 
        }, 400);
      }
      return c.json({ 
        error: { 
          message: 'Internal server error',
          type: 'internal_error' 
        } 
      }, 500);
    }
  });

  // List API keys
  app.get('/keys', async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ 
        error: { 
          message: 'Not authenticated',
          type: 'authentication_error' 
        } 
      }, 401);
    }

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, user.organizationId));

    return c.json({
      success: true,
      data: {
        apiKeys: keys.map(key => ({
          ...key,
          key: `${key.keyPrefix}...`, // Don't expose full key
        })),
      },
    });
  });

  // Delete API key
  app.delete('/keys/:id', async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ 
        error: { 
          message: 'Not authenticated',
          type: 'authentication_error' 
        } 
      }, 401);
    }

    const keyId = c.req.param('id');
    
    // Delete key (will only delete if it belongs to user's org)
    const result = await db
      .delete(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .where(eq(apiKeys.organizationId, user.organizationId));

    return c.json({
      success: true,
      data: {
        deleted: true,
      },
    });
  });

  return app;
}