/**
 * Device Authorization Page
 * Where users complete device authorization flow
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface DeviceAuthData {
  user_code: string;
  device_code: string;
  client_id: string;
  scope: string;
  created_at: number;
  expires_at: number;
}

function DeviceAuthContent() {
  const [userCode, setUserCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const codeFromUrl = searchParams.get('user_code');
    if (codeFromUrl) {
      setUserCode(codeFromUrl);
    }

    // For testing: auto-populate with mock device codes if in development
    if (process.env.NODE_ENV === 'development' && !codeFromUrl) {
      // Generate mock device codes for testing
      const mockCodes = ['ABCD-EFGH', '1234-5678', 'TEST-CODE'];
      const randomCode =
        mockCodes[Math.floor(Math.random() * mockCodes.length)];

      // Add some indicators this is a test page
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('test') === 'true') {
        setUserCode(randomCode);
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Get current authenticated user from session
      const userResponse = await fetch('/api/auth/identity', {
        method: 'GET',
        credentials: 'include',
      });

      if (!userResponse.ok) {
        // User not authenticated - redirect to login
        window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.href)}`;
        return;
      }

      const userData = await userResponse.json();

      if (!userData.success || !userData.data?.user) {
        setError('Unable to get user information. Please log in again.');
        return;
      }

      const user = userData.data.user;

      // Authorize device with real authenticated user
      const response = await fetch('/api/auth/device/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          user_code: userCode,
          authorize: true,
          user: {
            id: user.id,
            name:
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`.trim()
                : user.email.split('@')[0],
            email: user.email,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || 'Authorization failed');
      }
    } catch (err) {
      setError('An error occurred during authorization');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-xl">
          <div className="mb-4 text-6xl text-green-500">✓</div>
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Authorization Successful!
          </h1>
          <p className="mb-6 text-gray-600">
            You can now close this window and return to your terminal.
          </p>
          <p className="text-sm text-gray-500">
            Your CLI should now be authenticated and ready to use.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Device Authentication
          </h1>
          <p className="text-gray-600">
            Follow these steps to authenticate your device
          </p>
        </div>

        {/* Instructions */}
        <div className="mb-6 space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-3">
            <span className="font-semibold">Step 1:</span>
            <span>Go to device.elizaos.ai/verify on your browser</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="font-semibold">Step 2:</span>
            <span>Enter the code: {userCode || 'XXXX-XXXX'}</span>
            {userCode && (
              <button
                data-cy="copy-user-code"
                onClick={() => {
                  navigator.clipboard.writeText(userCode);
                  setError('');
                  setSuccess(false);
                  // Show temporary feedback
                  const btn = document.querySelector(
                    '[data-cy="copy-user-code"]',
                  ) as HTMLElement;
                  if (btn) {
                    const original = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                      btn.textContent = original;
                    }, 2000);
                  }
                }}
                className="ml-2 text-xs text-blue-600 hover:text-blue-800"
              >
                Copy
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="user_code"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Enter the code from your terminal:
            </label>
            <input
              type="text"
              id="user_code"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center font-mono text-2xl tracking-wider focus:border-transparent focus:ring-2 focus:ring-blue-500"
              pattern="[A-Z0-9]{4}-[A-Z0-9]{4}"
              maxLength={9}
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || userCode.length !== 9}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            data-cy="authorize-device-button"
          >
            {isLoading ? 'Authorizing...' : 'Authorize Device'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            This will grant your CLI access to your ElizaOS account.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DeviceAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-xl">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <DeviceAuthContent />
    </Suspense>
  );
}
