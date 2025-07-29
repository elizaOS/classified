import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { authService, sessionService } from '@/lib/auth/session';

async function handleGET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      const errorUrl = new URL('/auth/login', request.url);
      errorUrl.searchParams.set('error', error);
      errorUrl.searchParams.set('message', 'Authentication failed');
      return NextResponse.redirect(errorUrl.toString());
    }

    // Validate required parameters
    if (!code) {
      const errorUrl = new URL('/auth/login', request.url);
      errorUrl.searchParams.set('error', 'missing_code');
      errorUrl.searchParams.set('message', 'Authorization code missing');
      return NextResponse.redirect(errorUrl.toString());
    }

    // Parse state parameter for session migration info
    let stateData: any = {};
    if (state) {
      try {
        stateData = JSON.parse(state);
      } catch (error) {
        console.warn('Failed to parse state parameter:', error);
      }
    }

    try {
      // Authenticate with WorkOS and create session
      const sessionTokens = await authService.authenticateWithWorkOS(code, {
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });

      // Set authentication cookies
      const response = createAuthenticatedResponse(stateData, sessionTokens);

      // Handle session migration if there's a pending anonymous session
      if (stateData.sessionId) {
        try {
          await migrateAnonymousSession(
            stateData.sessionId,
            'authenticated-user',
            'user@example.com',
          );

          // Add success flag to redirect URL
          const redirectUrl = new URL(
            stateData.returnTo || '/dashboard',
            request.url,
          );
          redirectUrl.searchParams.set('auth_success', 'true');
          redirectUrl.searchParams.set('migrated', 'true');

          return NextResponse.redirect(redirectUrl.toString(), {
            headers: response.headers,
          });
        } catch (migrationError) {
          console.error('Session migration failed:', migrationError);
          // Continue with login even if migration fails
        }
      }

      // Redirect to intended destination
      const redirectUrl = new URL(
        stateData.returnTo || '/dashboard',
        request.url,
      );
      redirectUrl.searchParams.set('auth_success', 'true');

      return NextResponse.redirect(redirectUrl.toString(), {
        headers: response.headers,
      });
    } catch (authError) {
      console.error('WorkOS authentication failed:', authError);

      const errorUrl = new URL('/auth/login', request.url);
      errorUrl.searchParams.set('error', 'auth_failed');
      errorUrl.searchParams.set(
        'message',
        'Authentication with provider failed',
      );

      return NextResponse.redirect(errorUrl.toString());
    }
  } catch (error) {
    console.error('OAuth callback error:', error);

    const errorUrl = new URL('/auth/login', request.url);
    errorUrl.searchParams.set('error', 'callback_failed');
    errorUrl.searchParams.set('message', 'Authentication callback failed');

    return NextResponse.redirect(errorUrl.toString());
  }
}

// User creation is now handled by authService.authenticateWithWorkOS

async function migrateAnonymousSession(
  sessionId: string,
  userId: string,
  userEmail: string,
) {
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/migrate-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          userId,
          userEmail,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Migration API failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('Session migration successful:', result);

    return result;
  } catch (error) {
    console.error('Session migration failed:', error);
    throw error;
  }
}

function createAuthenticatedResponse(stateData: any, sessionTokens: any) {
  const isProduction = process.env.NODE_ENV === 'production';

  const response = new NextResponse();

  // Set authentication cookies
  response.cookies.set('auth-token', sessionTokens.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  });

  if (sessionTokens.refreshToken) {
    response.cookies.set('refresh-token', sessionTokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });
  }

  return response;
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state } = body;

    // Validate required parameters
    if (!code) {
      return NextResponse.json(
        { error: 'missing_code', message: 'Authorization code is required' },
        { status: 400 },
      );
    }

    // Parse state parameter
    let stateData: any = {};
    if (state) {
      try {
        stateData = JSON.parse(state);
      } catch (error) {
        console.warn('Failed to parse state parameter:', error);
      }
    }

    try {
      // Authenticate with WorkOS
      const sessionTokens = await authService.authenticateWithWorkOS(code, {
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });

      // Verify access token to get session data
      const sessionData = await sessionService.verifyAccessToken(
        sessionTokens.accessToken,
      );

      if (!sessionData) {
        throw new Error('Failed to verify session token');
      }

      // Return session data for programmatic use
      return NextResponse.json({
        success: true,
        session: {
          accessToken: sessionTokens.accessToken,
          refreshToken: sessionTokens.refreshToken,
          user: {
            id: sessionData.userId,
            email: sessionData.email,
            organizationId: sessionData.organizationId,
            role: sessionData.role,
            isAdmin: sessionData.isAdmin,
          },
          expiresAt: sessionTokens.expiresAt.getTime(),
        },
        message: 'Authentication successful',
      });
    } catch (authError) {
      console.error('WorkOS authentication failed:', authError);

      return NextResponse.json(
        {
          error: 'auth_failed',
          message: 'Authentication with provider failed',
        },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error('OAuth callback API error:', error);

    return NextResponse.json(
      {
        error: 'callback_failed',
        message: 'Authentication callback failed',
      },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
