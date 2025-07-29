import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';

async function handleGET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          error: 'missing_token',
          message: 'Authorization header missing or invalid',
        },
        { status: 401 },
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify the token using the session service
      const sessionData = await sessionService.verifyAccessToken(token);
      const isValid = sessionData !== null;

      if (isValid) {
        return NextResponse.json({
          valid: true,
          message: 'Token is valid',
        });
      } else {
        return NextResponse.json(
          {
            valid: false,
            error: 'invalid_token',
            message: 'Token is invalid or expired',
          },
          { status: 401 },
        );
      }
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError);

      return NextResponse.json(
        {
          valid: false,
          error: 'verify_failed',
          message: 'Token verification failed',
        },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error('Auth verify error:', error);

    return NextResponse.json(
      {
        error: 'verify_error',
        message: 'Authentication verification failed',
      },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'missing_token', message: 'Token is required' },
        { status: 400 },
      );
    }

    try {
      // Verify the token using the session service
      const sessionData = await sessionService.verifyAccessToken(token);
      const isValid = sessionData !== null;

      if (isValid) {
        return NextResponse.json({
          valid: true,
          message: 'Token is valid',
        });
      } else {
        return NextResponse.json(
          {
            valid: false,
            error: 'invalid_token',
            message: 'Token is invalid or expired',
          },
          { status: 401 },
        );
      }
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError);

      return NextResponse.json(
        {
          valid: false,
          error: 'verify_failed',
          message: 'Token verification failed',
        },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error('Auth verify API error:', error);

    return NextResponse.json(
      {
        error: 'verify_error',
        message: 'Authentication verification failed',
      },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
