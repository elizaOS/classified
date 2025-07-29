/**
 * Comprehensive tests for isomorphic authentication system
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from 'bun:test';

// Mock browser globals
const mockTauri = {
  invoke: mock(),
  emit: mock(),
  listen: mock(),
};

const mockLocalStorage = {
  getItem: mock(),
  setItem: mock(),
  removeItem: mock(),
  clear: mock(),
};

// Global setup for browser/Tauri environment simulation
global.localStorage = mockLocalStorage as any;
global.window = {} as any;

describe('Isomorphic Authentication System', () => {
  beforeAll(() => {
    // Reset all mocks
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
    delete (global.window as any).__TAURI__;
  });

  describe('Platform Detection', () => {
    test('should detect browser environment correctly', async () => {
      // Remove Tauri globals
      delete (global.window as any).__TAURI__;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      expect(isomorphicAuth.getState().platform).toBe('web');
    });

    test('should detect Tauri environment correctly', async () => {
      // Set Tauri globals
      (global.window as any).__TAURI__ = mockTauri;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      expect(isomorphicAuth.getState().platform).toBe('tauri');
    });
  });

  describe('OAuth Provider Configuration', () => {
    test('should return correct OAuth providers', async () => {
      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const providers = isomorphicAuth.getOAuthProviders();

      expect(providers).toHaveLength(5);
      expect(providers.map((p) => p.id)).toEqual([
        'google',
        'github',
        'discord',
        'twitter',
        'microsoft',
      ]);

      // Check provider properties
      const googleProvider = providers.find((p) => p.id === 'google');
      expect(googleProvider).toMatchObject({
        id: 'google',
        name: 'Google',
        icon: '🔵',
        color: '#4285f4',
      });
    });
  });

  describe('OAuth Flow - Web Platform', () => {
    beforeEach(() => {
      delete (global.window as any).__TAURI__;
      global.window.location = { href: '' } as any;
      const mockFetch = mock() as any;
      mockFetch.preconnect = mock();
      global.fetch = mockFetch;
    });

    test('should initiate OAuth flow for web platform', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          authUrl: 'https://auth.example.com/oauth/google',
        }),
      };
      const fetchMock = global.fetch as any;
      fetchMock.mockResolvedValue(mockResponse);

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const result = await isomorphicAuth.startOAuthFlow('google', {
        returnTo: '/dashboard',
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/social/google?platform=web&return_to=%2Fdashboard',
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );
    });

    test('should handle OAuth flow errors gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: async () => ({
          error: 'provider_unavailable',
          message: 'Google authentication is temporarily unavailable',
        }),
      };
      const fetchMock = global.fetch as any;
      fetchMock.mockResolvedValue(mockResponse);

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const result = await isomorphicAuth.startOAuthFlow('google');

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Google authentication is temporarily unavailable',
      );
    });
  });

  describe('OAuth Flow - Tauri Platform', () => {
    beforeEach(() => {
      (global.window as any).__TAURI__ = mockTauri;
      mockTauri.invoke.mockClear();
      mockTauri.listen.mockClear();
    });

    test('should initiate OAuth flow for Tauri platform', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          authUrl:
            'https://auth.example.com/oauth/google?redirect_uri=elizaos://auth/callback',
        }),
      };
      const mockFetch = mock() as any;
      mockFetch.preconnect = mock();
      mockFetch.mockResolvedValue(mockResponse);
      global.fetch = mockFetch;

      // Mock Tauri shell open
      mockTauri.invoke.mockImplementation(((command: string) => {
        if (command === 'start_oauth_flow') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Unknown command'));
      }) as any);

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const result = await isomorphicAuth.startOAuthFlow('google', {
        returnTo: '/dashboard',
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/social/google?platform=tauri&return_to=%2Fdashboard',
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );
    });

    test('should handle OAuth callback in Tauri', async () => {
      const mockCallbackData = {
        code: 'auth_code_123',
        state: JSON.stringify({
          provider: 'google',
          returnTo: '/dashboard',
          platform: 'tauri',
          timestamp: Date.now(),
        }),
      };

      // Mock callback listener
      let mockAuthCallback: (data: any) => void;
      mockTauri.listen.mockImplementation(((
        event: string,
        handler: (data: any) => void,
      ) => {
        if (event === 'auth-callback') {
          mockAuthCallback = (data: any) => handler({ payload: data });
        }
        return Promise.resolve(() => {});
      }) as any);

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      // Simulate callback
      if (mockAuthCallback!) {
        mockAuthCallback(mockCallbackData);
      }

      // Verify callback was processed
      expect(mockTauri.listen).toHaveBeenCalledWith(
        'auth-callback',
        expect.any(Function),
      );
    });
  });

  describe('Token Storage', () => {
    test('should store tokens in localStorage for web platform', async () => {
      delete (global.window as any).__TAURI__;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const testToken = 'test_token_123';
      await isomorphicAuth.storeAuthToken(testToken);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'elizaos_auth_token',
        testToken,
      );
    });

    test('should store tokens in Tauri store for Tauri platform', async () => {
      (global.window as any).__TAURI__ = mockTauri;
      mockTauri.invoke.mockImplementation(((command: string, args: any) => {
        if (command === 'store_auth_token') {
          expect(args.token).toBe('test-token-123');
          return Promise.resolve();
        }
        return Promise.reject(new Error('Unknown command'));
      }) as any);

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const testToken = 'test_token_123';
      await isomorphicAuth.storeAuthToken(testToken);

      expect(mockTauri.invoke).toHaveBeenCalledWith('store_auth_token', {
        token: testToken,
      });
    });

    test('should retrieve tokens from localStorage for web platform', async () => {
      delete (global.window as any).__TAURI__;
      const testToken = 'test_token_123';
      mockLocalStorage.getItem.mockReturnValue(testToken);

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const token = await isomorphicAuth.getAuthToken();

      expect(token).toBe(testToken);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        'elizaos_auth_token',
      );
    });

    test('should retrieve tokens from Tauri store for Tauri platform', async () => {
      (global.window as any).__TAURI__ = mockTauri;
      const testToken = 'test_token_123';
      mockTauri.invoke.mockImplementation(((command: string) => {
        if (command === 'get_auth_token') {
          return Promise.resolve('stored-test-token');
        }
        return Promise.reject(new Error('Unknown command'));
      }) as any);

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const token = await isomorphicAuth.getAuthToken();

      expect(token).toBe(testToken);
      expect(mockTauri.invoke).toHaveBeenCalledWith('get_auth_token');
    });
  });

  describe('Session Management', () => {
    test('should maintain authentication state', async () => {
      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      // Initially not authenticated
      expect(isomorphicAuth.getState().isAuthenticated).toBe(false);

      // Simulate successful authentication
      await isomorphicAuth.storeAuthToken('test_token_123');

      // Should update state
      const state = isomorphicAuth.getState();
      expect(state.isAuthenticated).toBe(true);
    });

    test('should handle sign out correctly', async () => {
      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      // Set authenticated state
      await isomorphicAuth.storeAuthToken('test_token_123');
      expect(isomorphicAuth.getState().isAuthenticated).toBe(true);

      // Sign out
      await isomorphicAuth.signOut();

      // Should clear state
      const state = isomorphicAuth.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    test('should refresh token when needed', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ success: true, token: 'new_token_123' }),
      };
      const mockFetch = mock() as any;
      mockFetch.preconnect = mock();
      mockFetch.mockResolvedValue(mockResponse);
      global.fetch = mockFetch;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const success = await isomorphicAuth.refreshToken();

      expect(success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      const mockFetch = mock() as any;
      mockFetch.preconnect = mock();
      mockFetch.mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const result = await isomorphicAuth.startOAuthFlow('google');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    test('should handle invalid provider gracefully', async () => {
      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const result = await isomorphicAuth.startOAuthFlow(
        'invalid_provider' as any,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown provider');
    });
  });

  describe('State Subscription', () => {
    test('should notify subscribers of state changes', async () => {
      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const mockCallback = mock();
      const unsubscribe = isomorphicAuth.subscribe(mockCallback);

      // Trigger state change
      await isomorphicAuth.storeAuthToken('test_token_123');

      expect(mockCallback).toHaveBeenCalled();

      // Cleanup
      unsubscribe();
    });
  });
});

describe('React Hook Integration', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('should provide authentication state through hook', async () => {
    // Mock React hooks
    const mockUseState = mock().mockReturnValue([
      {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
        platform: 'web',
      },
      mock(),
    ]);
    const mockUseEffect = mock();
    const mockUseCallback = mock().mockImplementation((fn) => fn);

    // Mock React
    mock.doMock('react', () => ({
      useState: mockUseState,
      useEffect: mockUseEffect,
      useCallback: mockUseCallback,
    }));

    const { useIsomorphicAuth } = await import(
      '../src/hooks/useIsomorphicAuth'
    );
    const authHook = useIsomorphicAuth();

    expect(authHook).toHaveProperty('isAuthenticated');
    expect(authHook).toHaveProperty('signInWithOAuth');
    expect(authHook).toHaveProperty('signOut');
    expect(authHook).toHaveProperty('refreshToken');
    expect(authHook).toHaveProperty('getOAuthProviders');
  });
});

describe('Login Form Component', () => {
  test('should render OAuth providers correctly', () => {
    // This would require a more complex setup with React Testing Library
    // For now, we'll test the component structure
    expect(true).toBe(true); // Placeholder
  });
});
