import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Removed axios import - using fetch for Edge Runtime compatibility
import { cookies } from 'next/headers';
// Temporarily disable database-dependent middleware for Edge Runtime compatibility
// import { apiAuthMiddleware, authRateLimitMiddleware, securityHeadersMiddleware } from './lib/middleware/auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for API routes and static assets to prevent loops
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next();
  }

  // CYPRESS DEV MODE BYPASS: If we're in development and have a dev auth token, skip auth checks
  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  const cookieStore = await cookies();
  const authToken = cookieStore.get('auth-token')?.value;

  if (isDev && authToken === 'dev-auth-token-123') {
    // Allow all authenticated routes in dev mode with dev token
    return NextResponse.next();
  }

  // TODO: Re-enable security headers middleware with Edge Runtime compatibility
  // Apply security headers to all requests
  // const response = securityHeadersMiddleware(request);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // Allow legal pages, client-static assets, and landing pages to be accessed without authentication
  if (
    pathname === '/' ||
    pathname.startsWith('/legal') ||
    pathname.startsWith('/client-static') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/autocoder-lander' ||
    pathname === '/website-lander' ||
    pathname === '/app-lander'
  ) {
    return NextResponse.next();
  }

  if (!apiUrl) {
    console.error('NEXT_PUBLIC_API_URL is not defined');
    return NextResponse.next();
  }

  try {
    // TODO: retain the initial request url to be redirected back to after login

    // Get auth token from cookies
    const authToken = cookieStore.get('auth-token')?.value;

    // If no auth token exists, redirect to login (unless already on auth pages)
    if (!authToken) {
      const authPath = pathname.startsWith('/auth');
      if (!authPath) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
      }
      return NextResponse.next();
    }

    const response = await fetch(
      `${request.nextUrl.origin}/api/auth/identity`,
      {
        headers: {
          Cookie: `auth-token=${authToken}`,
        },
        credentials: 'include',
      },
    ).catch(() => new Response(null, { status: 500 }));

    const authPath = pathname.startsWith('/auth');
    const isPasswordPath =
      pathname.startsWith('/auth/forgot-password') ||
      pathname.startsWith('/auth/change-password');

    // attempt to refresh the auth token
    if (response.status === 401) {
      const refreshToken = request.cookies.get('refresh-token')?.value;
      if (refreshToken) {
        const refreshResponse = await fetch(
          `${request.nextUrl.origin}/api/auth/refresh`,
          {
            headers: {
              Cookie: `refresh-token=${refreshToken}`,
            },
            credentials: 'include',
          },
        ).catch(() => new Response(null, { status: 500 }));

        if (refreshResponse.status === 200) {
          // Set cookies from the refresh response
          const response = NextResponse.next();

          if (authPath && !isPasswordPath && pathname !== '/auth/confirm') {
            return NextResponse.redirect(new URL('/dashboard', request.url));
          }

          const cookies = refreshResponse.headers.get('set-cookie');
          if (cookies) {
            if (Array.isArray(cookies)) {
              cookies.forEach((cookie) => {
                response.headers.append('Set-Cookie', cookie);
              });
            } else if (typeof cookies === 'string') {
              response.headers.append('Set-Cookie', cookies);
            }
          }

          return response;
        }
      }

      // Both auth token and refresh token are invalid - clear them and redirect to login
      if (!authPath) {
        const loginRedirect = NextResponse.redirect(
          new URL('/auth/login', request.url),
        );
        // Clear invalid cookies
        loginRedirect.cookies.delete('auth-token');
        loginRedirect.cookies.delete('refresh-token');
        return loginRedirect;
      }
      // For fetch, we need to parse the response body
      let responseData;
      try {
        responseData = response.status < 500 ? await response.json() : null;
      } catch {
        responseData = null;
      }

      if (responseData?.code === 'session_expired' && !authPath) {
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.append('error', 'session_expired');
        return NextResponse.redirect(loginUrl);
      }

      if (!authPath) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
      }

      return NextResponse.next();
    }

    // User exists and is authenticated
    let userData;
    try {
      userData = response.status === 200 ? await response.json() : null;
    } catch {
      userData = null;
    }

    const emailConfirmed = userData && userData.email_confirmed;
    const updateEmailRequested = userData && userData.updated_email;

    const nextResponse = NextResponse.next();

    // Add cookies from the original response to all responses
    const cookies = response.headers.get('set-cookie');

    if (cookies) {
      if (Array.isArray(cookies)) {
        cookies.forEach((cookie) => {
          nextResponse.headers.append('Set-Cookie', cookie);
        });
      } else {
        nextResponse.headers.append('Set-Cookie', cookies);
      }
    }

    if (
      userData &&
      emailConfirmed &&
      pathname.startsWith('/auth/confirm-email')
    ) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (
      (updateEmailRequested && pathname.startsWith('/auth/confirm')) ||
      (!emailConfirmed && pathname.startsWith('/auth/confirm'))
    ) {
      return nextResponse;
    }

    if (
      !emailConfirmed &&
      userData &&
      !pathname.startsWith('/auth/confirm-email')
    ) {
      return NextResponse.redirect(new URL('/auth/confirm-email', request.url));
    }

    if (
      !emailConfirmed &&
      userData &&
      pathname.startsWith('/auth/confirm-email')
    ) {
      return nextResponse;
    }

    if (!emailConfirmed && userData && !pathname.startsWith('/auth/confirm')) {
      return NextResponse.redirect(new URL('/auth/confirm-email', request.url));
    }

    if (userData) {
      if (
        authPath &&
        !isPasswordPath &&
        pathname !== '/dashboard'
        // Allow landing page to show for authenticated users
        // || pathname === '/'
      ) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    return nextResponse;
  } catch (err) {
    const pathname = request.nextUrl.pathname;
    const authPath = pathname.startsWith('/auth');
    const emailConfirmed = pathname.startsWith('/auth/confirm-email');

    if (!authPath || emailConfirmed) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sw.js (service worker)
     * - assets (static assets)
     * - images (public images)
     * - icons (public icons)
     * Note: API routes are now excluded to prevent middleware loops
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|assets|images|icons|api/).*)',
  ],
};
