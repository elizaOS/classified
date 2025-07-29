'use client';

import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import axios from 'axios';
import toast from '@/lib/toast';
import Link from 'next/link';
import { ApiError } from '@/types';
import Divider from '@/components/ui/divider';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [password, setPassword] = useState('');
  const [isDevSignupLoading, setIsDevSignupLoading] = useState(false);
  const router = useRouter();
  const isDevelopment = process.env.NODE_ENV === 'development';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axios.post(
        '/api/auth/signup',
        {
          email,
          firstName,
          lastName,
          organizationName,
          password,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true,
        },
      );

      if (response.status === 201) {
        toast({
          message: 'Account created successfully! Welcome to ElizaOS.',
          mode: 'success',
        });
        router.push('/dashboard');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const apiError = error.response.data as ApiError;
        toast({
          message: apiError.error,
          mode: 'error',
        });
      } else {
        toast({
          message: 'An unexpected error occurred',
          mode: 'error',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDevSignup() {
    setIsDevSignupLoading(true);

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

      if (response.status === 200) {
        toast({
          message: 'Developer signup successful! Welcome to ElizaOS.',
          mode: 'success',
        });
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Dev signup error:', error);
      toast({
        message: 'Dev signup failed',
        mode: 'error',
      });
    }

    setIsDevSignupLoading(false);
  }

  return (
    <div className="flex flex-col gap-6" data-cy="signup-page">
      <div className="flex flex-col gap-2">
        <h1 data-cy="signup-title">Get started with your dashboard</h1>
        <p data-cy="signup-subtitle">
          Free for 14 days &mdash; no credit card required.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-6"
        data-cy="signup-form"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            value={firstName}
            handleChange={(e) => setFirstName(e.target.value)}
            label="First name"
            type="text"
            name="firstName"
            placeholder="John"
            required
            data-cy="firstName-input"
          />
          <Input
            value={lastName}
            handleChange={(e) => setLastName(e.target.value)}
            label="Last name"
            type="text"
            name="lastName"
            placeholder="Doe"
            data-cy="lastName-input"
          />
        </div>

        <Input
          value={email}
          handleChange={(e) => setEmail(e.target.value)}
          label="Work email address"
          type="email"
          name="email"
          placeholder="name@company.com"
          required
          data-cy="email-input"
        />

        <Input
          value={organizationName}
          handleChange={(e) => setOrganizationName(e.target.value)}
          label="Organization name"
          type="text"
          name="organizationName"
          placeholder="Your Company"
          required
          data-cy="organizationName-input"
        />

        <Input
          value={password}
          handleChange={(e) => setPassword(e.target.value)}
          label="Password"
          type="password"
          name="password"
          placeholder="Minimum 8 characters, make it strong"
          required
          data-cy="password-input"
        />

        <Button
          className="w-full"
          type="submit"
          disabled={
            isLoading || !email || !firstName || !organizationName || !password
          }
          loading={isLoading}
          data-cy="signup-submit-button"
        >
          Start for free
        </Button>

        <div className="text-center">
          <Link
            className="no-underline"
            href="/auth/login"
            data-cy="login-link"
          >
            or login instead
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
            onClick={handleDevSignup}
            disabled={isDevSignupLoading}
            loading={isDevSignupLoading}
            data-cy="dev-signup-btn"
          >
            Dev Signup
          </Button>
          <p className="mt-2 text-center text-xs text-gray-500">
            Instantly create developer account with full access (dev@elizaos.ai)
          </p>
        </div>
      )}
    </div>
  );
}
