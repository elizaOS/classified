'use server';

import axios from 'axios';
import { cookies } from 'next/headers';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export async function confirmEmail(token: string) {
  try {
    const cookieStore = await cookies();
    const res = await axios.post(
      `${apiUrl}/auth/confirm-email`,
      { token },
      {
        headers: {
          Cookie: `auth-token=${cookieStore.get('auth-token')?.value}`,
        },
      },
    );

    if (res.status === 200) {
      return { success: true };
    }

    return {
      success: false,
      error: 'Email confirmation failed',
    };
  } catch (error: any) {
    console.error('Email confirmation error:', error);
    return {
      success: false,
      error: error.response?.data?.message || 'Email confirmation failed',
    };
  }
}

export async function handleResendEmail() {
  'use server';

  const cookieStore = await cookies();
  const response = await axios.post(
    `${process.env.NEXT_PUBLIC_API_URL}/auth/resend-email`,
    {},
    {
      withCredentials: true,
      headers: {
        Cookie: `auth-token=${cookieStore.get('auth-token')?.value}`,
      },
    },
  );
  return response.data;
}
