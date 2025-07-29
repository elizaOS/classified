'use client';

import { useState, useEffect } from 'react';
import { AutocoderWorkspace } from '@/components/autocoder/AutocoderWorkspace';
import { useAuth } from '@/lib/auth/useAuth';
import { Spinner } from '@/components/ui/spinner';

export default function AutocoderPage() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner variant="light" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Authentication Required
          </h1>
          <p className="text-gray-600">
            Please log in to access the Autocoder.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Autocoder</h1>
        <p className="mt-1 text-gray-600">
          AI-Powered Development - Collaborate with AI to build, test, and
          deploy plugins automatically
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <AutocoderWorkspace userId={user.id} />
      </div>
    </div>
  );
}
