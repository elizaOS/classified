'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  unifiedAuth,
  type AuthState,
  type OAuthProvider,
  type OAuthResult,
} from '../lib/unified-auth';

export interface UseUnifiedAuthReturn extends AuthState {
  signInWithOAuth: (
    providerId: string,
    options?: { returnTo?: string; sessionId?: string },
  ) => Promise<OAuthResult>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  getOAuthProviders: () => OAuthProvider[];
  waitForInit: () => Promise<void>;
}

export function useUnifiedAuth(): UseUnifiedAuthReturn {
  const [authState, setAuthState] = useState<AuthState>(unifiedAuth.getState());

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = unifiedAuth.subscribe(setAuthState);

    // Initialize auth service if not already done
    unifiedAuth.waitForInit().catch((error) => {
      console.error('Auth initialization failed:', error);
    });

    return unsubscribe;
  }, []);

  const signInWithOAuth = useCallback(
    async (
      providerId: string,
      options?: { returnTo?: string; sessionId?: string },
    ): Promise<OAuthResult> => {
      return unifiedAuth.startOAuthFlow(providerId, options);
    },
    [],
  );

  const signOut = useCallback(async () => {
    return unifiedAuth.signOut();
  }, []);

  const refreshToken = useCallback(async () => {
    return unifiedAuth.refreshToken();
  }, []);

  const getOAuthProviders = useCallback(() => {
    return unifiedAuth.getOAuthProviders();
  }, []);

  const waitForInit = useCallback(async () => {
    return unifiedAuth.waitForInit();
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
