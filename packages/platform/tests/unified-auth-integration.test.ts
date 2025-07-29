/**
 * Integration tests for unified authentication flow
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// Mock DOM APIs for Node environment
const localStorageMock = {
  getItem: mock(),
  setItem: mock(),
  removeItem: mock(),
  clear: mock(),
};

// Mock global objects
Object.defineProperty(global, 'window', {
  value: {
    localStorage: localStorageMock,
    location: {
      href: 'http://localhost:3333',
    },
    open: mock(),
  },
  writable: true,
});

// Also mock localStorage globally
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Helper function to create a properly typed fetch mock
function createFetchMock() {
  const mockFetch = mock() as unknown as typeof fetch;
  (mockFetch as any).preconnect = mock();
  return mockFetch;
}

// Mock fetch
const mockFetch = createFetchMock();
global.fetch = mockFetch;

describe('Unified Authentication Integration', () => {
  let unifiedAuth: any;

  beforeEach(async () => {
    // Clear all mocks
    localStorageMock.clear.mockClear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();

    // Reset fetch mock
    (mockFetch as any).mockClear();

    // Re-import auth service
    const authModule = await import('../src/lib/unified-auth');
    unifiedAuth = authModule.unifiedAuth;
  });

  describe('End-to-End OAuth Flow', () => {
    test('should complete full OAuth flow for web platform', async () => {
      // Mock successful OAuth initiation
      global.window.location.href = '';

      // Start OAuth flow
      const result = await unifiedAuth.startOAuthFlow('google', {
        returnTo: '/dashboard',
        sessionId: 'test-session',
      });

      expect(result.success).toBe(true);
      expect(global.window.location.href).toBe(
        '/api/auth/social/google?platform=web&return_to=%2Fdashboard&session_id=test-session',
      );
    });

    test('should handle OAuth callback completion', async () => {
      // Mock successful callback API
      const fetchMock = mockFetch as any;
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          session: {
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            user: {
              id: 'user-123',
              email: 'test@example.com',
              name: 'Test User',
            },
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          },
        }),
      } as any);

      const success = await unifiedAuth.completeOAuthFlow(
        'auth-code',
        'state-data',
      );

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'auth-code', state: 'state-data' }),
        credentials: 'include',
      });
    });

    test('should handle OAuth errors gracefully', async () => {
      // Mock failed callback API
      const fetchMock = mockFetch as any;
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'auth_failed',
          message: 'Authentication failed',
        }),
      } as any);

      const success = await unifiedAuth.completeOAuthFlow(
        'invalid-code',
        'state-data',
      );

      expect(success).toBe(false);
    });
  });

  describe('Session Management Integration', () => {
    test('should store and retrieve sessions correctly', async () => {
      const mockSession = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        expiresAt: Date.now() + 3600000,
      };

      // Store session
      await (unifiedAuth as any).storeSession(mockSession);

      // Verify localStorage was called
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'elizaos_auth_session',
        JSON.stringify(mockSession),
      );

      // Mock localStorage return
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSession));

      // Retrieve session
      const storedSession = await (unifiedAuth as any).getStoredSession();
      expect(storedSession).toEqual(mockSession);
    });

    test('should refresh tokens when needed', async () => {
      // Mock successful refresh API
      const fetchMock = mockFetch as any;
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          session: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            user: {
              id: 'user-123',
              email: 'test@example.com',
              name: 'Test User',
            },
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          },
        }),
      } as any);

      const success = await unifiedAuth.refreshToken();

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
    });

    test('should sign out and clear sessions', async () => {
      // Mock logout API
      const fetchMock = mockFetch as any;
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as any);

      await unifiedAuth.signOut();

      // Verify localStorage was cleared
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'elizaos_auth_session',
      );

      // Verify logout API was called
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    });
  });

  describe('Cross-Platform Compatibility', () => {
    test('should handle Tauri environment correctly', async () => {
      // Mock Tauri environment
      Object.defineProperty(global.window, '__TAURI__', {
        value: {
          invoke: mock(),
        },
        writable: true,
        configurable: true,
      });
      const authModule = await import('../src/lib/unified-auth');
      const tauriAuth = authModule.unifiedAuth;

      // Mock successful fetch for OAuth URL
      const fetchMock = mockFetch as any;
      fetchMock.mockResolvedValue({
        ok: true,
        url: 'https://accounts.google.com/oauth2/auth?...',
      } as any);

      const result = await tauriAuth.startOAuthFlow('google');
      expect(result.success).toBe(true);

      // Verify it uses absolute URLs for API calls
      const apiUrl = (tauriAuth as any).getApiBaseUrl();
      expect(apiUrl).toBe(
        process.env.NEXT_PUBLIC_API_BASE_URL ||
          'https://api.platform.elizaos.com',
      );

      // Cleanup
      delete (global.window as any).__TAURI__;
    });

    test('should fallback gracefully when Tauri APIs fail', async () => {
      // Mock Tauri environment but with failing APIs
      Object.defineProperty(global.window, '__TAURI__', {
        value: {},
        writable: true,
        configurable: true,
      });

      // The auth service should still work even without Tauri APIs
      const result = await unifiedAuth.startOAuthFlow('google');
      expect(result.success).toBe(true);

      // Cleanup
      delete (global.window as any).__TAURI__;
    });
  });

  describe('Error Handling', () => {
    test('should handle network failures gracefully', async () => {
      // Mock Tauri environment to trigger fetch call
      Object.defineProperty(global.window, '__TAURI__', {
        value: {
          invoke: mock(),
        },
        writable: true,
        configurable: true,
      });

      // Mock network failure
      const fetchMock = global.fetch as any;
      fetchMock.mockRejectedValue(new Error('Network error') as any);

      // Re-import to get new instance with Tauri environment
      const authModule = await import('../src/lib/unified-auth');
      const tauriAuth = authModule.unifiedAuth;

      const result = await tauriAuth.startOAuthFlow('google');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to open OAuth flow');

      // Cleanup
      delete (global.window as any).__TAURI__;
    });

    test('should handle invalid JSON in localStorage', async () => {
      // Mock invalid JSON in localStorage
      localStorageMock.getItem.mockReturnValue('invalid-json');

      const session = await (unifiedAuth as any).getStoredSession();
      expect(session).toBeNull();
    });

    test('should handle missing provider gracefully', async () => {
      const result = await unifiedAuth.startOAuthFlow('invalid-provider');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown provider');
    });
  });

  describe('State Management', () => {
    test('should notify listeners of state changes', async () => {
      const listener = mock();

      const unsubscribe = unifiedAuth.subscribe(listener);

      // Trigger a state change
      (unifiedAuth as any).setState({ isLoading: false });

      expect(listener).toHaveBeenCalled();

      // Cleanup
      unsubscribe();
    });

    test('should handle authentication state correctly', async () => {
      // Initially not authenticated
      let state = unifiedAuth.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();

      // Mock successful authentication
      const mockSession = {
        accessToken: 'test-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        expiresAt: Date.now() + 3600000,
      };

      await (unifiedAuth as any).setSession(mockSession);

      // Should now be authenticated
      state = unifiedAuth.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockSession.user);
      expect(state.error).toBeNull();
    });
  });

  describe('Provider Configuration', () => {
    test('should have correct OAuth providers configured', () => {
      const providers = unifiedAuth.getOAuthProviders();

      expect(providers).toHaveLength(4);

      const providerIds = providers.map((p: any) => p.id);
      expect(providerIds).toContain('google');
      expect(providerIds).toContain('github');
      expect(providerIds).toContain('discord');
      expect(providerIds).toContain('microsoft');

      // Check provider details
      const googleProvider = providers.find((p: any) => p.id === 'google');
      expect(googleProvider).toMatchObject({
        id: 'google',
        name: 'Google',
        icon: '🔵',
        color: '#4285f4',
      });
    });

    test('should generate correct OAuth URLs', async () => {
      // Ensure clean environment (no Tauri)
      if ('__TAURI__' in global.window) {
        delete (global.window as any).__TAURI__;
      }

      global.window.location.href = '';

      // Re-import to get fresh instance without Tauri
      const authModule = await import('../src/lib/unified-auth');
      const webAuth = authModule.unifiedAuth;

      await webAuth.startOAuthFlow('github', {
        returnTo: '/profile',
        sessionId: 'session-456',
      });

      expect(global.window.location.href).toBe(
        '/api/auth/social/github?platform=web&return_to=%2Fprofile&session_id=session-456',
      );
    });
  });
});
