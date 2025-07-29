import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sign } from 'jsonwebtoken';

async function handlePOST(request: NextRequest) {
  // During build time, return a stub response to prevent database access
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.BUILD_MODE === 'export' ||
    process.env.NEXT_EXPORT === 'true'
  ) {
    return NextResponse.json(
      { error: 'API not available during build time' },
      { status: 503 },
    );
  }

  // Only allow in development mode
  const isDevelopment =
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_DEV_MODE === 'true';

  if (!isDevelopment) {
    return NextResponse.json(
      {
        success: false,
        error: 'Dev login only available in development mode',
        debug: {
          NODE_ENV: process.env.NODE_ENV,
          NEXT_PUBLIC_DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE,
        },
      },
      { status: 403 },
    );
  }

  try {
    // Create dev user and organization data with proper UUIDs
    const devUser = {
      id: 'a0000000-0000-4000-8000-000000000001',
      email: 'dev@elizaos.ai',
      firstName: 'Developer',
      lastName: 'User',
      organizationId: 'a0000000-0000-4000-8000-000000000002',
      role: 'owner',
      emailVerified: true,
    };

    const devOrganization = {
      id: 'a0000000-0000-4000-8000-000000000002',
      name: 'ElizaOS Development',
      slug: 'elizaos-dev',
      creditBalance: '1000.0',
      subscriptionTier: 'premium',
    };

    // Create proper JWT tokens
    const jwtSecret =
      process.env.JWT_SECRET ||
      'development-jwt-secret-key-at-least-32-characters-long-for-local-dev-only';

    const accessTokenPayload = {
      userId: devUser.id,
      organizationId: devUser.organizationId,
      email: devUser.email,
      role: devUser.role,
      isAdmin: true,
      iss: 'elizaos-platform',
      aud: 'elizaos-users',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    };

    const refreshTokenPayload = {
      userId: devUser.id,
      organizationId: devUser.organizationId,
      iss: 'elizaos-platform',
      aud: 'elizaos-users',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };

    const accessToken = sign(accessTokenPayload, jwtSecret);
    const refreshToken = sign(refreshTokenPayload, jwtSecret);

    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: devUser,
          organization: devOrganization,
          tokens: {
            accessToken,
            refreshToken,
          },
          message: 'Developer login successful',
        },
      },
      { status: 200 },
    );

    // Set cookies properly on the response
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    // Set access token cookie
    response.cookies.set('auth-token', accessToken, {
      ...cookieOptions,
      expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // Set refresh token cookie
    response.cookies.set('refresh-token', refreshToken, {
      ...cookieOptions,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    return response;
  } catch (error) {
    console.error('Dev login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: String(error),
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
