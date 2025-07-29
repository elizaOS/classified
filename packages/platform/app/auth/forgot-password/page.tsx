'use client';

import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import Link from 'next/link';
import toast from '@/lib/toast';
import { useState } from 'react';
import axios from 'axios';
import { getErrorMessage } from '@/messages';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (emailSent) {
    return (
      <div className="flex flex-col gap-6">
        <h1>Check your inbox!</h1>
        <p>
          Thanks! If <b>{email}</b> matches an email we have on file, follow the
          instructions we sent to reset your password.
        </p>

        <p>
          If you haven&apos;t received an email in a few minutes, check your
          spam or try logging in with a different email.
        </p>

        <div className="text-center">
          <Link className="no-underline" href="/auth/login">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1>Forgot Password</h1>
        <p>Get a link to reset your password</p>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();

          if (!email) {
            return;
          }

          setLoading(true);
          await axios
            .post(
              `${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`,
              {
                email,
              },
              {
                headers: {
                  withCredentials: true,
                },
              },
            )
            .then((res) => {
              toast({
                message: 'Password reset sent! ',
                description:
                  "You'll receive an email if your are registered in our system.",
                mode: 'success',
              });

              setEmailSent(true);
            })
            .catch((err) => {
              toast({
                message: getErrorMessage(err.response?.data?.code),
                mode: 'error',
              });
            })
            .finally(() => {
              setLoading(false);
            });
        }}
        className="flex flex-col gap-6"
      >
        <Input
          type="email"
          placeholder="name@company.com"
          label="Email address"
          value={email}
          handleChange={(e) => setEmail(e.target.value)}
        />
        <Button className="w-full" type="submit" disabled={!email || loading}>
          {loading ? 'Sending...' : 'Request reset link'}
        </Button>
        <div className="text-center">
          <Link className="no-underline" href="/auth/login">
            or login with email instead
          </Link>
        </div>
      </form>
    </div>
  );
}
