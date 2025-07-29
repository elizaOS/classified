'use server';

import axios from 'axios';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function handleLogout() {
  'use server';

  try {
    const cookieStore = await cookies();

    // Call the logout API endpoint
    const _response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth-token=${cookieStore.get('auth-token')?.value}; refresh-token=${cookieStore.get('refresh-token')?.value}`,
      },
    });

    // Clear cookies manually as well
    cookieStore.delete('auth-token');
    cookieStore.delete('refresh-token');

    console.log('Logout successful');
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookies even if API call fails
    const cookieStore = await cookies();
    cookieStore.delete('auth-token');
    cookieStore.delete('refresh-token');
  } finally {
    redirect('/auth/login');
  }
}

export async function handleRestoreUser() {
  'use server';

  const cookieStore = await cookies();
  return axios
    .patch(
      `${process.env.NEXT_PUBLIC_API_URL}/users/restore`,
      {},
      {
        headers: {
          Cookie: `auth-token=${cookieStore.get('auth-token')?.value}`,
        },
        withCredentials: true,
      },
    )
    .then((res: any) => {
      return res.data;
    })
    .catch((err: any) => {
      return err.response.data;
    });
}
