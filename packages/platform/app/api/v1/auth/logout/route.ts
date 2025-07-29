import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { authService, sessionService } from '@/lib/auth/session';
import { cookies } from 'next/headers';

async function handlePOST(request: NextRequest) {
  try {
    // Get current access token from cookies to destroy session
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth-token')?.value;

    if (authToken) {
      // Destroy the session in database
      await sessionService.destroySession(authToken);
    }

    // Clear session cookies using the sessionService method
    await sessionService.clearSessionCookies();

    const response = {
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to logout' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
