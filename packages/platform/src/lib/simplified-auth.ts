import { apiClient } from './api-client';
import { SecurityManager } from './security';
import { useState, useEffect } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  token: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}

class SimplifiedAuthManager {
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
  };

  private listeners: Array<(state: AuthState) => void> = [];

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      const hasToken = await apiClient.loadStoredToken();
      if (hasToken) {
        // Verify token is still valid
        await this.verifyCurrentSession();
      }
    } catch (error) {
      console.warn('Failed to initialize auth:', error);
      this.clearAuth();
    }
  }

  private async verifyCurrentSession(): Promise<boolean> {
    try {
      const response = await apiClient.request<{ user: any }>('/api/auth/me');
      if (response.success && response.data) {
        this.setAuthState({
          isAuthenticated: true,
          user: response.data.user,
          token: apiClient['authToken'], // Access private property
        });
        return true;
      }
    } catch (error) {
      console.warn('Session verification failed:', error);
    }

    this.clearAuth();
    return false;
  }

  async login(
    credentials: LoginCredentials,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Input validation
      if (!credentials.email || !credentials.password) {
        return { success: false, error: 'Email and password are required' };
      }

      // Sanitize inputs
      const sanitizedEmail = SecurityManager.sanitizeInput(
        credentials.email,
      ).toLowerCase();
      const sanitizedPassword = SecurityManager.sanitizeInput(
        credentials.password,
      );

      if (!this.isValidEmail(sanitizedEmail)) {
        return { success: false, error: 'Invalid email format' };
      }

      if (sanitizedPassword.length < 8) {
        return {
          success: false,
          error: 'Password must be at least 8 characters',
        };
      }

      const authData = await apiClient.authenticate(
        sanitizedEmail,
        sanitizedPassword,
      );

      this.setAuthState({
        isAuthenticated: true,
        user: authData.user,
        token: authData.token,
      });

      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  }

  async register(
    data: RegisterData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Input validation
      if (!data.email || !data.password || !data.name) {
        return {
          success: false,
          error: 'Email, password, and name are required',
        };
      }

      // Sanitize inputs
      const sanitizedData = {
        email: SecurityManager.sanitizeInput(data.email).toLowerCase(),
        password: SecurityManager.sanitizeInput(data.password),
        name: SecurityManager.sanitizeInput(data.name),
        organizationName: data.organizationName
          ? SecurityManager.sanitizeInput(data.organizationName)
          : undefined,
      };

      if (!this.isValidEmail(sanitizedData.email)) {
        return { success: false, error: 'Invalid email format' };
      }

      if (sanitizedData.password.length < 8) {
        return {
          success: false,
          error: 'Password must be at least 8 characters',
        };
      }

      if (sanitizedData.name.length < 2) {
        return { success: false, error: 'Name must be at least 2 characters' };
      }

      const response = await apiClient.request<{ token: string; user: any }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(sanitizedData),
        },
      );

      if (response.success && response.data) {
        // Store token and set auth state
        apiClient['authToken'] = response.data.token;
        await apiClient['storeTokenSecurely'](response.data.token);

        this.setAuthState({
          isAuthenticated: true,
          user: response.data.user,
          token: response.data.token,
        });

        return { success: true };
      }

      return {
        success: false,
        error: response.error || 'Registration failed',
      };
    } catch (error) {
      console.error('Registration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }

  async logout(): Promise<void> {
    try {
      // Attempt to invalidate session on server
      await apiClient.request('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Server logout failed:', error);
    } finally {
      this.clearAuth();
    }
  }

  async resetPassword(
    email: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const sanitizedEmail = SecurityManager.sanitizeInput(email).toLowerCase();

      if (!this.isValidEmail(sanitizedEmail)) {
        return { success: false, error: 'Invalid email format' };
      }

      const response = await apiClient.request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: sanitizedEmail }),
      });

      return response.success
        ? { success: true }
        : { success: false, error: response.error || 'Reset password failed' };
    } catch (error) {
      console.error('Reset password failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reset password failed',
      };
    }
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.authState.isAuthenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      const sanitizedCurrent = SecurityManager.sanitizeInput(currentPassword);
      const sanitizedNew = SecurityManager.sanitizeInput(newPassword);

      if (sanitizedNew.length < 8) {
        return {
          success: false,
          error: 'New password must be at least 8 characters',
        };
      }

      const response = await apiClient.request('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: sanitizedCurrent,
          newPassword: sanitizedNew,
        }),
      });

      return response.success
        ? { success: true }
        : { success: false, error: response.error || 'Change password failed' };
    } catch (error) {
      console.error('Change password failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Change password failed',
      };
    }
  }

  private clearAuth(): void {
    apiClient.clearAuth();
    this.setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
    });
  }

  private setAuthState(newState: AuthState): void {
    this.authState = { ...newState };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.authState);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Public API
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  getUser(): any | null {
    return this.authState.user;
  }

  getToken(): string | null {
    return this.authState.token;
  }

  onAuthStateChange(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

/**
 * Custom React hook for using auth state
 * Must be used outside of the class component
 */
export function useAuthState(): AuthState {
  const [state, setState] = useState(auth.getAuthState());

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChange(setState);
    return unsubscribe;
  }, []);

  return state;
}

export const auth = new SimplifiedAuthManager();
export type { AuthState, LoginCredentials, RegisterData };
