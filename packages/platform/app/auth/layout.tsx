import { Suspense } from 'react';
import Link from 'next/link';
import Logo from '@/components/ui/logo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <div className="flex h-full flex-grow flex-col items-center justify-between gap-8 py-8">
        <Logo />
        <div className="w-full max-w-md">{children}</div>
        <div>
          <p className="text-sm">
            By proceeding you acknowledge that you have read, understood and
            agree to our <Link href="/legal/terms">Terms of Service</Link> and{' '}
            <Link href="/legal/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </Suspense>
  );
}
