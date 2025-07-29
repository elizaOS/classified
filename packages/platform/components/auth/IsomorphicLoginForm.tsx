'use client';

import { useState, useEffect } from 'react';
import { useIsomorphicAuth } from '../../src/hooks/useIsomorphicAuth';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface IsomorphicLoginFormProps {
  onSuccess?: () => void;
  returnTo?: string;
  sessionId?: string;
}

export function IsomorphicLoginForm({
  onSuccess,
  returnTo = '/dashboard',
  sessionId,
}: IsomorphicLoginFormProps) {
  const auth = useIsomorphicAuth();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle successful authentication
  useEffect(() => {
    if (auth.isAuthenticated && !auth.isLoading) {
      onSuccess?.();
    }
  }, [auth.isAuthenticated, auth.isLoading, onSuccess]);

  // Handle auth errors
  useEffect(() => {
    if (auth.error) {
      setError(auth.error.message);
      setLoadingProvider(null);
    }
  }, [auth.error]);

  const handleOAuthSignIn = async (providerId: string) => {
    try {
      setLoadingProvider(providerId);
      setError(null);

      const result = await auth.signInWithOAuth(providerId, {
        returnTo,
        sessionId,
      });

      if (!result.success) {
        setError(result.error || `Failed to sign in with ${providerId}`);
        setLoadingProvider(null);
      }
      // If successful, the OAuth flow will handle the redirect
    } catch (err) {
      console.error(`OAuth sign in failed for ${providerId}:`, err);
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setLoadingProvider(null);
    }
  };

  if (auth.isLoading) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Initializing...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">
          Sign in to ElizaOS Platform
        </CardTitle>
        <p className="text-center text-sm text-gray-600">
          Choose your preferred sign-in method
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {auth.getOAuthProviders().map((provider) => (
            <Button
              key={provider.id}
              onClick={() => handleOAuthSignIn(provider.id)}
              disabled={loadingProvider !== null}
              variant="outline"
              className="flex h-12 w-full items-center justify-center gap-3"
              style={{
                borderColor:
                  loadingProvider === provider.id ? provider.color : undefined,
                color:
                  loadingProvider === provider.id ? provider.color : undefined,
              }}
            >
              {loadingProvider === provider.id ? (
                <>
                  <div
                    className="h-4 w-4 animate-spin rounded-full border-b-2"
                    style={{ borderColor: provider.color }}
                  ></div>
                  <span>Connecting to {provider.name}...</span>
                </>
              ) : (
                <>
                  <span className="text-lg">{provider.icon}</span>
                  <span>Continue with {provider.name}</span>
                </>
              )}
            </Button>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button
              onClick={() => setError(null)}
              variant="ghost"
              size="sm"
              className="mt-2 text-red-600 hover:text-red-700"
            >
              Dismiss
            </Button>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            By signing in, you agree to our{' '}
            <a href="/legal/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/legal/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>

        {/* Development info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 rounded-md bg-gray-50 p-3">
            <p className="text-xs text-gray-600">
              <strong>Environment:</strong>{' '}
              {typeof window !== 'undefined' && '__TAURI__' in window
                ? 'Tauri App'
                : 'Web Browser'}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              <strong>Auth State:</strong>{' '}
              {auth.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
