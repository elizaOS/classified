/**
 * Token Refresh API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';

export const runtime = 'nodejs';

/**
 * GET /api/auth/refresh - Refresh access token
 */
async function handleGET(request: NextRequest) {
  try {
    // Get refresh token from cookies
    const refreshToken = request.cookies.get('refresh-token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token provided' },
        { status: 401 },
      );
    }

    // Refresh the session
    const tokens = await sessionService.refreshSession(refreshToken);

    if (!tokens) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 },
      );
    }

    // Create response with new tokens
    const response = NextResponse.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    });

    // Set new cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    // Set access token cookie
    response.cookies.set('auth-token', tokens.accessToken, {
      ...cookieOptions,
      expires: tokens.expiresAt,
    });

    // Set refresh token cookie (longer duration - 7 days)
    response.cookies.set('refresh-token', tokens.refreshToken, {
      ...cookieOptions,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Token refresh failed' },
      { status: 401 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
