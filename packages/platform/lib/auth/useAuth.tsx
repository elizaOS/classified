'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import React from 'react';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface Session {
  userId: string;
  organizationId: string;
  email: string;
  accessToken?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  const standaloneAuth = useStandaloneAuth();

  if (!context) {
    // If no context provider, use standalone hook
    return standaloneAuth;
  }
  return context;
}

function useStandaloneAuth(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session on mount
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/identity', {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();

        // Set user data
        setUser({
          id: userData.id,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          role: userData.role,
          organization: userData.organization
            ? {
                id: userData.organization.id,
                name: userData.organization.name,
                slug: userData.organization.slug,
              }
            : undefined,
        });

        // Set session data
        setSession({
          userId: userData.id,
          organizationId: userData.organization?.id,
          email: userData.email,
          accessToken: userData.accessToken, // If provided by the API
        });
      } else if (response.status === 401) {
        // User is not authenticated
        setUser(null);
        setSession(null);
      } else {
        throw new Error('Failed to check authentication status');
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setError(
        err instanceof Error ? err.message : 'Authentication check failed',
      );
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Login successful, refresh auth status
        await checkAuthStatus();
        return true;
      } else {
        setError(data.error || 'Login failed');
        return false;
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setLoading(true);

      // Call logout endpoint
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      // Clear local state
      setUser(null);
      setSession(null);
      setError(null);

      // Redirect to login page
      window.location.href = '/auth/login';
    } catch (err) {
      console.error('Logout error:', err);
      // Even if logout fails, clear local state
      setUser(null);
      setSession(null);
      window.location.href = '/auth/login';
    } finally {
      setLoading(false);
    }
  };

  const refreshAuth = async (): Promise<void> => {
    await checkAuthStatus();
  };

  return {
    user,
    session,
    loading,
    error,
    login,
    logout,
    refreshAuth,
  };
}

// Higher-order component for authentication
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { user, loading } = useAuth();

    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!user) {
      window.location.href = '/auth/login';
      return null;
    }

    return <Component {...props} />;
  };
}

// Hook for making authenticated API calls with automatic token injection
export function useAuthenticatedFetch() {
  const { session, refreshAuth } = useAuth();

  const authenticatedFetch = async (
    url: string,
    options: RequestInit = {},
  ): Promise<Response> => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authorization header if we have an access token
    if (session?.accessToken) {
      (headers as any)['Authorization'] = `Bearer ${session.accessToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // Always include cookies for session management
    };

    const response = await fetch(url, config);

    // If we get a 401, try to refresh the session
    if (response.status === 401) {
      await refreshAuth();
      // Retry the request once after refresh
      return fetch(url, config);
    }

    return response;
  };

  return authenticatedFetch;
}

// Hook for getting user-scoped API endpoints
export function useUserScopedApi() {
  const { session } = useAuth();
  const authFetch = useAuthenticatedFetch();

  return {
    // Get user's messages for a specific agent
    getMessages: async (
      agentId: string,
      params?: {
        limit?: number;
        offset?: number;
        conversationId?: string;
      },
    ) => {
      const searchParams = new URLSearchParams();
      searchParams.append('agentId', agentId);
      if (params?.limit) {
        searchParams.append('limit', params.limit.toString());
      }
      if (params?.offset) {
        searchParams.append('offset', params.offset.toString());
      }
      if (params?.conversationId) {
        searchParams.append('conversationId', params.conversationId);
      }

      const response = await authFetch(`/api/v1/messages?${searchParams}`);
      return response.json();
    },

    // Get user's memories for a specific agent
    getMemories: async (
      agentId: string,
      params?: {
        limit?: number;
        offset?: number;
        type?: string;
        roomId?: string;
        minImportance?: number;
      },
    ) => {
      const searchParams = new URLSearchParams();
      searchParams.append('agentId', agentId);
      if (params?.limit) {
        searchParams.append('limit', params.limit.toString());
      }
      if (params?.offset) {
        searchParams.append('offset', params.offset.toString());
      }
      if (params?.type) {
        searchParams.append('type', params.type);
      }
      if (params?.roomId) {
        searchParams.append('roomId', params.roomId);
      }
      if (params?.minImportance) {
        searchParams.append('minImportance', params.minImportance.toString());
      }

      const response = await authFetch(`/api/v1/memories?${searchParams}`);
      return response.json();
    },

    // Create a new message
    createMessage: async (data: {
      conversationId: string;
      agentId: string;
      content: any;
      role: 'user' | 'agent' | 'system';
      parentMessageId?: string;
    }) => {
      const response = await authFetch('/api/v1/messages', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },

    // Create a new memory
    createMemory: async (data: {
      agentId: string;
      content: any;
      type?: 'conversation' | 'fact' | 'preference' | 'skill';
      importance?: number;
      conversationId?: string;
      roomId?: string;
      entityId?: string;
    }) => {
      const response = await authFetch('/api/v1/memories', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },

    // Search memories with vector similarity
    searchMemories: async (data: {
      agentId: string;
      query: string;
      embedding: string;
      matchThreshold?: number;
      limit?: number;
    }) => {
      const response = await authFetch('/api/v1/memories/search', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },

    // Get user info (for debugging isolation)
    getUserInfo: () => ({
      userId: session?.userId,
      organizationId: session?.organizationId,
      email: session?.email,
    }),
  };
}
