/**
 * JWT utility functions for token management
 */

import { SignJWT, jwtVerify } from 'jose';
import type { User, Session, TokenPair } from '../types';

export interface JWTPayload {
  userId: string;
  sessionId: string;
  organizationId?: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

// Simple interface for minimal JWT payloads
export interface SimpleJWTPayload {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
}

// Overload for simple token creation (used by signup and dev-login)
export async function createTokenPair(
  payload: SimpleJWTPayload,
): Promise<TokenPair>;

export async function createTokenPair(
  user: User,
  session: Session,
  jwtSecret: string,
  organizationId?: string,
): Promise<TokenPair>;

// Implementation that handles both overloads
export async function createTokenPair(
  userOrPayload: User | SimpleJWTPayload,
  session?: Session,
  jwtSecret?: string,
  organizationId?: string,
): Promise<TokenPair> {
  const jwtSecretKey = jwtSecret || process.env.JWT_SECRET;
  if (!jwtSecretKey) {
    throw new Error(
      'JWT_SECRET environment variable is required for token creation',
    );
  }
  if (jwtSecretKey.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  // Check if this is the simple payload version
  if ('userId' in userOrPayload && !session) {
    const payload = userOrPayload as SimpleJWTPayload;
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((now + ACCESS_TOKEN_EXPIRY) * 1000);

    // Create access token
    const accessToken = await new SignJWT({
      userId: payload.userId,
      organizationId: payload.organizationId,
      email: payload.email,
      role: payload.role,
      isAdmin: ['owner', 'admin'].includes(payload.role),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + ACCESS_TOKEN_EXPIRY)
      .setIssuer('elizaos-platform')
      .setAudience('elizaos-users')
      .sign(new TextEncoder().encode(jwtSecretKey));

    // Create refresh token (simplified payload for refresh)
    const refreshToken = await new SignJWT({
      userId: payload.userId,
      organizationId: payload.organizationId,
      type: 'refresh',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + REFRESH_TOKEN_EXPIRY)
      .setIssuer('elizaos-platform')
      .setAudience('elizaos-users')
      .sign(new TextEncoder().encode(jwtSecretKey));

    return {
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  // Original implementation for full User/Session
  const user = userOrPayload as User;
  if (!session || !jwtSecret) {
    throw new Error(
      'Session and jwtSecret are required for full User token creation',
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + ACCESS_TOKEN_EXPIRY) * 1000);

  // Create access token
  const accessToken = await new SignJWT({
    userId: user.id,
    sessionId: session.id,
    organizationId,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_EXPIRY)
    .sign(new TextEncoder().encode(jwtSecret));

  // Create refresh token
  const refreshToken = await new SignJWT({
    userId: user.id,
    sessionId: session.id,
    organizationId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TOKEN_EXPIRY)
    .sign(new TextEncoder().encode(jwtSecret));

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}

export async function verifyJWT(
  token: string,
  jwtSecret: string,
): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret),
    );

    return payload as unknown as JWTPayload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Generate a simple JWT token for testing purposes
 */
export async function generateJWT(
  payload: Record<string, any>,
): Promise<string> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  const secret = new TextEncoder().encode(jwtSecret);

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}
