'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  isomorphicAuth,
  type AuthState,
  type OAuthProvider,
} from '../lib/isomorphic-auth';

export interface UseIsomorphicAuthReturn extends AuthState {
  signInWithOAuth: (
    providerId: string,
    options?: { returnTo?: string; sessionId?: string },
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  getOAuthProviders: () => OAuthProvider[];
  waitForInit: () => Promise<void>;
}

export function useIsomorphicAuth(): UseIsomorphicAuthReturn {
  const [authState, setAuthState] = useState<AuthState>(
    isomorphicAuth.getState(),
  );

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = isomorphicAuth.subscribe(setAuthState);

    // Initialize auth service if not already done
    isomorphicAuth.waitForInit().catch((error) => {
      console.error('Auth initialization failed:', error);
    });

    return unsubscribe;
  }, []);

  const signInWithOAuth = useCallback(
    async (
      providerId: string,
      options?: { returnTo?: string; sessionId?: string },
    ) => {
      return isomorphicAuth.startOAuthFlow(providerId, options);
    },
    [],
  );

  const signOut = useCallback(async () => {
    return isomorphicAuth.signOut();
  }, []);

  const refreshToken = useCallback(async () => {
    return isomorphicAuth.refreshToken();
  }, []);

  const getOAuthProviders = useCallback(() => {
    return isomorphicAuth.getOAuthProviders();
  }, []);

  const waitForInit = useCallback(async () => {
    return isomorphicAuth.waitForInit();
  }, []);

  return {
    ...authState,
    signInWithOAuth,
    signOut,
    refreshToken,
    getOAuthProviders,
    waitForInit,
  };
}
