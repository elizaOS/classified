/**
 * Authentication middleware for Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import type { User, Organization, Session, ApiKey } from '../types';
import { verifyJWT, extractBearerToken } from '../utils/jwt';
import { hashApiKey } from '../utils/crypto';
import { isValidApiKey } from '../utils/validation';
import { db } from '../database';
import { SessionManager } from '../auth/session';
import { loadConfig } from '../utils/config';

export interface AuthenticatedRequest extends NextRequest {
  user?: User;
  organization?: Organization;
  session?: Session;
  apiKey?: ApiKey;
}

export async function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  options?: {
    required?: boolean;
    allowApiKey?: boolean;
  },
) {
  return async (req: NextRequest) => {
    const config = loadConfig();
    const sessionManager = new SessionManager();

    // Check for API key authentication
    if (options?.allowApiKey !== false) {
      const apiKeyHeader = req.headers.get('x-api-key');

      if (apiKeyHeader && isValidApiKey(apiKeyHeader)) {
        const keyHash = hashApiKey(apiKeyHeader);
        const apiKey = await db.getApiKeyByHash(keyHash);

        if (apiKey && apiKey.isActive) {
          // Check if expired
          if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            if (options?.required) {
              return NextResponse.json(
                {
                  success: false,
                  error: {
                    code: 'API_KEY_EXPIRED',
                    message: 'API key has expired',
                  },
                },
                { status: 401 },
              );
            }
          } else {
            // Update last used
            await db.updateApiKey(apiKey.id, { lastUsedAt: new Date() });

            // Get user and organization
            const user = await db.getUserById(apiKey.userId);
            let organization: Organization | undefined;
            if (apiKey.organizationId) {
              const org = await db.getOrganizationById(apiKey.organizationId);
              organization = org || undefined;
            }

            if (user) {
              const authenticatedReq = req as AuthenticatedRequest;
              authenticatedReq.user = user;
              authenticatedReq.organization = organization;
              authenticatedReq.apiKey = apiKey;

              return handler(authenticatedReq);
            }
          }
        }
      }
    }

    // Check for JWT authentication
    const authHeader = req.headers.get('authorization');
    const token = extractBearerToken(authHeader || undefined);

    if (token) {
      try {
        const payload = await verifyJWT(token, config.jwtSecret);

        if (payload.type !== 'access') {
          if (options?.required) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: 'INVALID_TOKEN_TYPE',
                  message: 'Invalid token type',
                },
              },
              { status: 401 },
            );
          }
        } else {
          // TODO: Implement session validation if needed
          // For now, we trust the JWT payload since it's verified
          {
            // Get user and organization
            const user = await db.getUserById(payload.userId);
            let organization: Organization | undefined;
            if (payload.organizationId) {
              const org = await db.getOrganizationById(payload.organizationId);
              organization = org || undefined;
            }

            if (user) {
              const authenticatedReq = req as AuthenticatedRequest;
              authenticatedReq.user = user;
              authenticatedReq.organization = organization;
              authenticatedReq.session = undefined; // TODO: Set actual session when session validation is implemented

              return handler(authenticatedReq);
            }
          }
        }
      } catch (error) {
        if (options?.required) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_TOKEN',
                message: 'Invalid authentication token',
              },
            },
            { status: 401 },
          );
        }
      }
    }

    // No authentication found
    if (options?.required) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required',
          },
        },
        { status: 401 },
      );
    }

    // Continue without authentication
    return handler(req as AuthenticatedRequest);
  };
}

export function requireAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  options?: {
    allowApiKey?: boolean;
  },
) {
  return withAuth(handler, { ...options, required: true });
}
