import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';
import { wrapHandlers } from '@/lib/api/route-wrapper';

async function handleGET(request: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const refreshToken = cookieStore.get('refresh-token');

  try {
    const response = await axios.get(`${apiUrl}/auth/refresh`, {
      headers: {
        Cookie: `refresh-token=${refreshToken?.value}`,
      },
      withCredentials: true,
    });

    const setCookie = response.headers['set-cookie'];
    console.log('Set-Cookie:', setCookie);
    if (response.status !== 200) {
      return NextResponse.redirect(
        new URL('/auth/login?error=no-refresh', request.url),
      );
    }

    const redirectResponse = NextResponse.redirect(
      new URL('/dashboard', request.url),
    );

    // Forward the Set-Cookie header from the API response
    if (setCookie) {
      setCookie.forEach((cookie) => {
        redirectResponse.headers.append('Set-Cookie', cookie);
      });
    }

    return redirectResponse;
  } catch (error) {
    return NextResponse.redirect(
      new URL('/auth/login?error=other-error-refresh', request.url),
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
