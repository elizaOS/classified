import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { wrapHandlers } from '@/lib/api/route-wrapper';

async function handleGET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(
      new URL('/auth/confirm-email?error=token-missing', request.url),
    );
  }

  try {
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/confirm`,
      { token },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
      },
    );

    const setCookie = response.headers['set-cookie'];
    console.log('Set-Cookie:', setCookie);

    if (response.status !== 200) {
      return NextResponse.redirect(
        new URL('/auth/login?error=confirm-email-token-invalid', request.url),
      );
    }

    const redirectResponse = NextResponse.redirect(
      new URL(response.data.data.redirect_url || '/dashboard', request.url),
    );

    // Forward the Set-Cookie header from the API response
    if (setCookie) {
      setCookie.forEach((cookie) => {
        redirectResponse.headers.append('Set-Cookie', cookie);
      });
    }

    return redirectResponse;
  } catch (error: any) {
    const errorData = error.response.data;

    if (errorData.code === 'invalid_update_token') {
      return NextResponse.redirect(
        new URL('/settings/account?error=invalid_update_token', request.url),
      );
    } else {
      return NextResponse.redirect(
        new URL('/auth/login?error=invalid_token', request.url),
      );
    }
  }
}

export const { GET } = wrapHandlers({ handleGET });
