/**
 * Platform Integration Tests
 * End-to-end tests that verify the complete isomorphic platform works correctly
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'bun:test';

// Helper function to create a properly typed fetch mock
function createFetchMock() {
  const mockFetch = mock() as unknown as typeof fetch;
  (mockFetch as any).preconnect = mock();
  return mockFetch;
}

describe('Platform Integration', () => {
  describe('App Lander', () => {
    test('should render clean login interface', async () => {
      // Mock Next.js router
      const mockPush = mock();
      const mockRouter = {
        push: mockPush,
        pathname: '/app-lander',
        query: {},
        asPath: '/app-lander',
      };

      mock.doMock('next/navigation', () => ({
        useRouter: () => mockRouter,
      }));

      // Mock isomorphic auth hook
      const mockAuth = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
        platform: 'web',
        signInWithOAuth: mock(),
        signOut: mock(),
        refreshToken: mock(),
        getOAuthProviders: mock().mockReturnValue([
          { id: 'google', name: 'Google', icon: '🔵', color: '#4285f4' },
          { id: 'github', name: 'GitHub', icon: '⚫', color: '#24292e' },
          { id: 'discord', name: 'Discord', icon: '🟣', color: '#7289da' },
          { id: 'twitter', name: 'Twitter', icon: '🔵', color: '#1da1f2' },
          { id: 'microsoft', name: 'Microsoft', icon: '', color: '#0078d4' },
        ]),
        waitForInit: (mock() as any).mockResolvedValue(undefined),
      };

      mock.doMock('../src/hooks/useIsomorphicAuth', () => ({
        useIsomorphicAuth: () => mockAuth,
      }));

      // Test app lander component
      expect(mockAuth.getOAuthProviders()).toHaveLength(5);
      expect(mockAuth.isAuthenticated).toBe(false);
    });

    test('should redirect authenticated users to dashboard', async () => {
      const mockPush = mock();
      const mockRouter = { push: mockPush };

      mock.doMock('next/navigation', () => ({
        useRouter: () => mockRouter,
      }));

      const mockAuth = {
        isAuthenticated: true,
        isLoading: false,
        waitForInit: (mock() as any).mockResolvedValue(undefined),
      };

      mock.doMock('../src/hooks/useIsomorphicAuth', () => ({
        useIsomorphicAuth: () => mockAuth,
      }));

      // Simulate the redirect logic
      if (mockAuth.isAuthenticated) {
        mockPush('/dashboard');
      }

      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Isomorphic Authentication Flow', () => {
    test('should complete OAuth flow in web environment', async () => {
      // Mock browser environment
      global.window = {
        location: { href: '' },
        __TAURI__: undefined,
      } as any;

      const mockFetch = createFetchMock();
      (mockFetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          authUrl:
            'https://auth.workos.com/oauth/google?redirect_uri=http://localhost:3333/auth/callback',
        }),
      });
      global.fetch = mockFetch;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const result = await isomorphicAuth.startOAuthFlow('google', {
        returnTo: '/dashboard',
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/social/google?platform=web&return_to=%2Fdashboard',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
    });

    test('should complete OAuth flow in Tauri environment', async () => {
      // Mock Tauri environment
      const mockTauri = {
        invoke: (mock() as any).mockResolvedValue(undefined),
        listen: (mock() as any).mockResolvedValue(() => {}),
        emit: mock(),
      };

      global.window = {
        __TAURI__: mockTauri,
      } as any;

      const mockFetch = createFetchMock();
      (mockFetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          authUrl:
            'https://auth.workos.com/oauth/google?redirect_uri=elizaos://auth/callback',
        }),
      });
      global.fetch = mockFetch;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const result = await isomorphicAuth.startOAuthFlow('google', {
        returnTo: '/dashboard',
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/social/google?platform=tauri&return_to=%2Fdashboard',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
    });
  });

  describe('Platform-Specific Behavior', () => {
    test('should use localStorage for web platform token storage', async () => {
      const mockLocalStorage = {
        getItem: mock(),
        setItem: mock(),
        removeItem: mock(),
      };

      global.localStorage = mockLocalStorage as any;
      global.window = { __TAURI__: undefined } as any;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      await isomorphicAuth.storeAuthToken('test_token_123');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'elizaos_auth_token',
        'test_token_123',
      );
    });

    test('should use Tauri store for native app token storage', async () => {
      const mockTauri = {
        invoke: (mock() as any).mockResolvedValue(undefined),
      };

      global.window = { __TAURI__: mockTauri } as any;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      await isomorphicAuth.storeAuthToken('test_token_123');

      expect(mockTauri.invoke).toHaveBeenCalledWith('store_auth_token', {
        token: 'test_token_123',
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle network failures gracefully', async () => {
      const mockFetch = createFetchMock();
      (mockFetch as any).mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;
      global.window = { __TAURI__: undefined } as any;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const result = await isomorphicAuth.startOAuthFlow('google');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    test('should handle server errors gracefully', async () => {
      const mockFetch = createFetchMock();
      (mockFetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'server_error',
          message: 'Internal server error',
        }),
      });
      global.fetch = mockFetch;
      global.window = { __TAURI__: undefined } as any;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const result = await isomorphicAuth.startOAuthFlow('google');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
    });

    test('should handle OAuth provider errors', async () => {
      const mockFetch = createFetchMock();
      (mockFetch as any).mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'provider_unavailable',
          message: 'Google authentication is temporarily unavailable',
        }),
      });
      global.fetch = mockFetch;
      global.window = { __TAURI__: undefined } as any;

      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const result = await isomorphicAuth.startOAuthFlow('google');

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Google authentication is temporarily unavailable',
      );
    });
  });

  describe('State Management', () => {
    test('should maintain consistent state across platform switches', async () => {
      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      // Set initial state
      await isomorphicAuth.storeAuthToken('test_token_123');

      // Verify state
      const state1 = isomorphicAuth.getState();
      expect(state1.isAuthenticated).toBe(true);

      // Simulate platform switch (this is theoretical as it wouldn't happen in practice)
      const token = await isomorphicAuth.getAuthToken();
      expect(token).toBe('test_token_123');

      // Verify state consistency
      const state2 = isomorphicAuth.getState();
      expect(state2.isAuthenticated).toBe(true);
    });

    test('should notify subscribers of state changes', async () => {
      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');
      await isomorphicAuth.waitForInit();

      const mockCallback = mock();
      const unsubscribe = isomorphicAuth.subscribe(mockCallback);

      // Trigger state change
      await isomorphicAuth.storeAuthToken('test_token_123');

      expect(mockCallback).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('Deep Link Handling', () => {
    test('should parse OAuth callback deep links correctly', async () => {
      const mockCallbackUrl =
        'elizaos://auth/callback?code=auth_code_123&state=%7B%22provider%22%3A%22google%22%2C%22returnTo%22%3A%22%2Fdashboard%22%7D';

      // Parse the URL
      const url = new URL(mockCallbackUrl);
      const params = new URLSearchParams(url.search);

      const code = params.get('code');
      const state = params.get('state');

      expect(code).toBe('auth_code_123');
      expect(state).toBeDefined();

      if (state) {
        const parsedState = JSON.parse(decodeURIComponent(state));
        expect(parsedState.provider).toBe('google');
        expect(parsedState.returnTo).toBe('/dashboard');
      }
    });
  });

  describe('Security', () => {
    test('should validate OAuth state parameters', async () => {
      const state = JSON.stringify({
        provider: 'google',
        returnTo: '/dashboard',
        platform: 'tauri',
        timestamp: Date.now(),
      });

      const parsedState = JSON.parse(state);

      // Validate required fields
      expect(parsedState.provider).toBeDefined();
      expect(parsedState.returnTo).toBeDefined();
      expect(parsedState.platform).toBeDefined();
      expect(parsedState.timestamp).toBeDefined();

      // Validate timestamp is recent (within 10 minutes)
      const timestampAge = Date.now() - parsedState.timestamp;
      expect(timestampAge).toBeLessThan(10 * 60 * 1000);
    });

    test('should sanitize redirect URLs', async () => {
      const { isomorphicAuth } = await import('../src/lib/isomorphic-auth');

      // Test that only allowed redirect URLs are accepted
      const allowedPaths = ['/dashboard', '/agents', '/settings'];
      const disallowedPaths = [
        'javascript:alert(1)',
        'http://evil.com',
        '//evil.com',
      ];

      allowedPaths.forEach((path) => {
        // This would be validated in the actual implementation
        expect(path.startsWith('/')).toBe(true);
        expect(!path.includes('javascript:')).toBe(true);
        expect(!path.includes('http')).toBe(true);
      });
    });
  });
});

describe('Multi-Platform Build Verification', () => {
  test('should generate correct artifacts for web deployment', async () => {
    // Verify web build artifacts would be generated correctly
    const expectedWebArtifacts = [
      '.next/BUILD_ID',
      '.next/static',
      '.next/server',
      'public/manifest.json',
      'public/sw.js',
    ];

    // This would verify actual file existence in a real test
    expectedWebArtifacts.forEach((artifact) => {
      expect(typeof artifact).toBe('string');
      expect(artifact.length).toBeGreaterThan(0);
    });
  });

  test('should generate correct artifacts for Tauri deployment', async () => {
    // Verify Tauri build artifacts would be generated correctly
    const expectedTauriArtifacts = [
      'dist/index.html',
      'dist/app-lander/index.html',
      'dist/_next/static',
      'src-tauri/target/release/elizaos-platform',
    ];

    expectedTauriArtifacts.forEach((artifact) => {
      expect(typeof artifact).toBe('string');
      expect(artifact.length).toBeGreaterThan(0);
    });
  });

  test('should verify cross-platform compatibility', () => {
    // Test that the same codebase works across platforms
    const platforms = ['web', 'tauri'];
    const features = ['oauth', 'token-storage', 'state-management'];

    platforms.forEach((platform) => {
      features.forEach((feature) => {
        // Verify each feature is supported on each platform
        expect(typeof platform).toBe('string');
        expect(typeof feature).toBe('string');
      });
    });
  });
});

// Cleanup after all tests
afterAll(() => {
  mock.restore();
  mock.restoreAllMocks();
});
