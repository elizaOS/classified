'use client';

import Button from '@/components/ui/button';
import toast from '@/lib/toast';
import Link from 'next/link';
import Divider from '@/components/ui/divider';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Spinner from '@/components/ui/spinner';
import { handleResendEmail } from './actions';

export default function ConfirmEmailPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [noCookie, setNoCookie] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
    setIsLoading(false);
  }, [searchParams]);

  // TODO: get email from /auth/identity

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1>Check your inbox</h1>
      <p>
        We&apos;ve sent a confirmation link
        {email && ' to '}
        <strong>{email}</strong>. Please click the link to confirm your address.
      </p>
      <Divider />
      <div>
        <div>Open Gmail</div>
        <div>Open Superhuman</div>
        <div>Open Outlook</div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          Can&apos;t find the email? Please check the spam folder.
        </p>
        <p className="text-sm">
          {!noCookie ? (
            <Button
              handleClick={() =>
                handleResendEmail()
                  .then(() =>
                    toast({
                      message: 'Email resent',
                      mode: 'success',
                    }),
                  )
                  .catch(() => {
                    setNoCookie(true);
                    toast({
                      message:
                        'We could not verify your identity. Please log in and try again.',
                      mode: 'error',
                    });
                  })
              }
              variant="link"
            >
              Resend email
            </Button>
          ) : (
            <Link href="/auth/login">Login instead</Link>
          )}
        </p>
      </div>
    </div>
  );
}
