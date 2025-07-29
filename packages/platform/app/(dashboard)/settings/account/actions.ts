'use server';

import { ApiError, ApiResponse, User } from '@/types';

import axios from 'axios';
import { cookies } from 'next/headers';
import { parseNextCookie } from '@/lib/cookie';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export async function updateUser({
  user,
  firstName,
  lastName,
  email,
}: {
  user: User | null;
  firstName?: string;
  lastName?: string;
  email?: string;
}) {
  if (!user) {
    return;
  }

  const cookieStore = await cookies();
  await axios
    .patch(
      `${apiUrl}/users`,
      {
        first_name: firstName,
        last_name: lastName,
        email,
      },
      {
        headers: {
          Cookie: `auth-token=${cookieStore.get('auth-token')?.value}`,
        },
      },
    )
    .catch(() => {
      return null;
    });
}

export async function updateUserEmail({
  user,
  email,
}: {
  user: User | null;
  email: string;
}) {
  if (!user || !email) {
    return;
  }

  const cookieStore = await cookies();

  const response = await axios
    .patch(
      `${apiUrl}/users/email`,
      { email },
      {
        headers: {
          Cookie: cookieStore
            .getAll()
            .map((cookie) => `${cookie.name}=${cookie.value}`)
            .join('; '),
        },
      },
    )
    .then((res) => {
      return res.data;
    })
    .catch((_err) => {
      return _err.response.data;
    });

  return response;
}

export async function resendUpdateEmailConfirmation({
  user: _user,
}: {
  user: User | null;
}) {
  const cookieStore = await cookies();
  const response = await axios.post(
    `${apiUrl}/users/resend-email`,
    {},
    {
      headers: { Cookie: `auth-token=${cookieStore.get('auth-token')?.value}` },
    },
  );
  return response.data;
}

export async function verifyPassword({
  password,
}: {
  password: string;
}): Promise<ApiResponse | ApiError> {
  const cookieStore = await cookies();
  return await axios
    .post(
      `${apiUrl}/auth/verify-password`,
      {
        password,
      },
      {
        headers: {
          Cookie: `auth-token=${cookieStore.get('auth-token')?.value}`,
        },
      },
    )
    .then(async (res) => {
      const setCookieHeader: string | string[] | undefined =
        res.headers['set-cookie'];
      if (setCookieHeader) {
        setCookieHeader.forEach((c) => {
          const parsed = parseNextCookie(c);
          cookieStore.set(parsed.name, parsed.value, parsed.options);
        });
      }
      return res.data;
    })
    .catch((_err) => {
      return _err.response.data;
    });
}

export async function uploadAvatar({
  user,
  formData,
}: {
  user: User | null;
  formData: FormData;
}) {
  if (!user || !formData) {
    return;
  }

  const cookieStore = await cookies();
  const response = await axios
    .patch(`${apiUrl}/users/avatar`, formData, {
      headers: { Cookie: `auth-token=${cookieStore.get('auth-token')?.value}` },
    })
    .then((res) => {
      return res.data;
    })
    .catch((_err) => {
      return null;
    });

  return response;
}

export async function deleteAvatar() {
  try {
    const cookieStore = await cookies();
    const response = await axios
      .delete(`${apiUrl}/users/avatar`, {
        headers: {
          Cookie: `auth-token=${cookieStore.get('auth-token')?.value}`,
        },
      })
      .then((res) => res)
      .catch((_err) => {
        // Handle network errors when server is down
        if (!_err.response) {
          console.error('Network error - server may be down:', _err);
          throw new Error('Unable to connect to server');
        }
        return _err.response;
      });

    if (response.status === 204) {
      return null;
    }

    throw new Error(`Unexpected status code: ${response.status}`);
  } catch (err) {
    console.error('Error deleting avatar:', err);
    if (axios.isAxiosError(err)) {
      if (!err.response) {
        return 'Unable to connect to server. Please try again later.';
      }
      return err.response?.data || err.message;
    }
    return err;
  }
}

export async function changePassword({
  oldPassword,
  newPassword,
  confirmNewPassword,
}: {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<{
  message: string;
  error: string;
  code: string;
}> {
  try {
    const cookieStore = await cookies();
    const response = await axios.patch(
      `${apiUrl}/users/change-password`,
      {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      },
      {
        headers: {
          Cookie: `auth-token=${cookieStore.get('auth-token')?.value}`,
        },
      },
    );

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(`Unexpected status code: ${response.status}`);
  } catch (err) {
    console.error('Error changing password:', err);
    if (axios.isAxiosError(err)) {
      if (!err.response) {
        return {
          message: 'Unable to connect to server. Please try again later.',
          error: 'connection_error',
          code: 'connection_error',
        };
      }
      return err.response.data;
    }
    return {
      message: 'An unexpected error occurred',
      error: 'An unexpected error occurred',
      code: 'internal_server_error',
    };
  }
}

export async function deleteSessions() {
  const cookieStore = await cookies();
  const response = await axios
    .delete(`${apiUrl}/auth/sessions`, {
      headers: { Cookie: `auth-token=${cookieStore.get('auth-token')?.value}` },
    })
    .then((res) => {
      return res.data;
    })
    .catch((_err) => {
      return _err.response.data;
    });

  return response;
}
