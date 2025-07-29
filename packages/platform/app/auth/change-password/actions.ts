'use server';

import { parseNextCookie } from '@/lib/cookie';
import axios from 'axios';
import { cookies } from 'next/headers';

export async function changePassword({
  token,
  password,
  confirmPassword,
}: {
  token: string;
  password: string;
  confirmPassword: string;
}) {
  try {
    const response = await axios
      .post(`${process.env.NEXT_PUBLIC_API_URL}/auth/change-password`, {
        token,
        password,
        confirm_password: confirmPassword,
      })
      .catch((err) => err.response.data);

    if (response.error) {
      return response;
    } else {
      // Get cookies from response headers
      const setCookie = response.headers['set-cookie'];

      // Set cookies from API response
      if (setCookie) {
        const cookieStore = await cookies();
        setCookie.forEach((cookie: string) => {
          const parsedCookie = parseNextCookie(cookie);
          cookieStore.set(
            parsedCookie.name,
            parsedCookie.value,
            parsedCookie.options,
          );
        });
      }

      return { success: true };
    }
  } catch (err) {
    console.error(err);

    return {
      error: 'Internal server error.',
      code: 'internal_server_error',
    };
  }
}
