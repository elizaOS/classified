'use client';

import { useState, useEffect } from 'react';
import { auth, type AuthState } from '../lib/simplified-auth';

export function useAuth(): AuthState & {
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    organizationName?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (
    email: string,
  ) => Promise<{ success: boolean; error?: string }>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
} {
  const [authState, setAuthState] = useState<AuthState>(auth.getAuthState());

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChange(setAuthState);
    return unsubscribe;
  }, []);

  return {
    ...authState,
    login: (email: string, password: string) => auth.login({ email, password }),
    register: auth.register.bind(auth),
    logout: auth.logout.bind(auth),
    resetPassword: auth.resetPassword.bind(auth),
    changePassword: auth.changePassword.bind(auth),
  };
}
