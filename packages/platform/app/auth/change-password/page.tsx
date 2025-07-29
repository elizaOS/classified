'use client';

import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import toast from '@/lib/toast';
import { getErrorMessage, getResponseMessage } from '@/messages';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { changePassword } from './actions';

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    try {
      // validate token exists
      if (!token) {
        toast({
          message: getErrorMessage('missing_token'),
          mode: 'error',
        });
        return;
      }

      // validate password exists
      if (!password || !confirmPassword) {
        toast({
          message: 'Please enter a new password.',
          mode: 'error',
        });
        return;
      }

      // validate passwords match
      if (password !== confirmPassword) {
        toast({
          message: 'Passwords do not match.',
          mode: 'error',
        });
        return;
      }

      const res = await changePassword({ token, password, confirmPassword });
      console.log('res55: ', res);

      if (res.success) {
        toast({
          message: getResponseMessage('password_changed'),
          mode: 'success',
        });
        router.push('/dashboard');
      } else if (res.error) {
        if (res.code === 'weak_password') {
          toast({
            message: res.error,
            mode: 'error',
          });
        } else {
          toast({
            message: getErrorMessage(res.code),
            mode: 'error',
          });
        }
      }
    } catch (error: any) {
      console.log('74: ', error);
      if (error.code === 'weak_password') {
        toast({
          message: error.error,
          mode: 'error',
        });
      } else {
        toast({
          message: getErrorMessage(error.code),
          mode: 'error',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1>Change your password</h1>
      <p>Enter a new password below to change your password.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Input
          type="password"
          placeholder="New password"
          value={password}
          handleChange={(e) => setPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          handleChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button
          className="w-full"
          type="submit"
          disabled={isLoading || !password || !confirmPassword}
          loading={isLoading}
        >
          Change password
        </Button>
        <div className="text-center">
          <Link className="no-underline" href="/auth/forgot-password">
            or request a new reset link
          </Link>
        </div>
      </form>
    </div>
  );
}
