'use client';

import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import axios from 'axios';
import toast from '@/lib/toast';
import Link from 'next/link';
import { ApiError } from '@/types';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getErrorMessage } from '@/messages';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDevLoginLoading, setIsDevLoginLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isDevelopment =
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_DEV_MODE === 'true' ||
    (typeof window !== 'undefined' && (window as any).Cypress);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'confirm-email-token-invalid') {
      toast({
        message:
          'The confirmation link was invalid or has expired. Please login to request a new one.',
        mode: 'error',
      });
      router.replace('/auth/login');
    } else if (error === 'session_expired') {
      toast({
        message: getErrorMessage('session_expired'),
        mode: 'error',
      });
      router.replace('/auth/login');
    }

    const message = searchParams.get('message');
    if (message === 'email_updated') {
      toast({
        message:
          'Email updated successfully. You have been securely logged out of all devices.',
        mode: 'success',
      });
      router.replace('/auth/login');
    }
  }, [searchParams, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setIsLoading(true);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        { email, password },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        },
      );

      if (response.status === 200) {
        toast({
          message: 'Logged in successfully',
          mode: 'success',
        });

        // Use Next.js router for reliable navigation
        router.push('/dashboard');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const apiError = error.response.data as ApiError;
        toast({
          message: getErrorMessage(apiError.code),
          mode: 'error',
        });
      } else {
        toast({
          message: getErrorMessage('internal_server_error'),
          mode: 'error',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDevLogin() {
    setIsDevLoginLoading(true);

    try {
      const response = await axios.post(
        '/api/auth/dev-login',
        {},
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        },
      );

      if (response.status === 200 && response.data?.success) {
        toast({
          message: response.data?.data?.message || 'Developer login successful',
          mode: 'success',
        });

        // Use full page reload to ensure cookies are processed by middleware
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      console.error('Dev login error:', error);

      if (axios.isAxiosError(error) && error.response?.data) {
        toast({
          message: error.response.data.error || 'Dev login failed',
          mode: 'error',
        });
      } else {
        toast({
          message: 'Dev login failed',
          mode: 'error',
        });
      }
    } finally {
      setIsDevLoginLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-cy="login-page">
      <h1 data-cy="login-title">Log in to your account</h1>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-6"
        data-cy="login-form"
      >
        <Input
          label="Email address"
          type="email"
          name="email"
          placeholder="name@company.com"
          required
          value={email}
          handleChange={(e) => setEmail(e.target.value)}
          data-cy="email-input"
        />
        <Input
          label="Password"
          type="password"
          name="password"
          placeholder="Password"
          required
          value={password}
          handleChange={(e) => setPassword(e.target.value)}
          data-cy="password-input"
          hint={
            <Link
              className="text-xs text-typography-weak"
              href="/auth/forgot-password"
              tabIndex={-1}
              data-cy="forgot-password-link"
            >
              Forgot password?
            </Link>
          }
        />
        <Button
          className="w-full"
          type="submit"
          disabled={isLoading || !email || !password}
          loading={isLoading}
          data-cy="login-submit-button"
        >
          Continue with email
        </Button>

        <div className="text-center">
          <Link
            className="no-underline"
            href="/auth/signup"
            data-cy="signup-link"
          >
            or sign up instead
          </Link>
        </div>
      </form>

      {isDevelopment && (
        <div className="mt-4 border-t pt-4" data-cy="dev-mode-section">
          <div className="mb-3 text-center">
            <span className="bg-white px-2 text-sm text-gray-500">
              Development Mode
            </span>
          </div>
          <Button
            className="w-full bg-yellow-500 text-black hover:bg-yellow-600"
            onClick={handleDevLogin}
            disabled={isDevLoginLoading}
            loading={isDevLoginLoading}
            data-cy="dev-login-btn"
          >
            Dev Login
          </Button>
          <p className="mt-2 text-center text-xs text-gray-500">
            Instantly login as developer with full access (dev@elizaos.ai)
          </p>
          <p className="text-center text-xs text-gray-400">
            Use this if you see JWT errors
          </p>
        </div>
      )}
    </div>
  );
}
