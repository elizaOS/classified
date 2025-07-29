import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
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

    return NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Logout error:', error);

    // Even if there's an error, we should clear the cookies
    try {
      await sessionService.clearSessionCookies();
    } catch (cookieError) {
      console.error('Error clearing cookies:', cookieError);
    }

    return NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
