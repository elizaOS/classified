/**
 * Isomorphic Authentication Service
 * Handles OAuth flow for both web and Tauri applications
 */

import { SecurityManager } from './security';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  organizationId?: string;
  role?: string;
  isAdmin?: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
  expiresAt: number;
}

export interface OAuthProvider {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  { id: 'google', name: 'Google', icon: '🔍', color: '#4285f4' },
  { id: 'github', name: 'GitHub', icon: '⚡', color: '#333' },
  { id: 'discord', name: 'Discord', icon: '💬', color: '#7289da' },
  { id: 'microsoft', name: 'Microsoft', icon: '🪟', color: '#0078d4' },
];

export interface AuthError {
  code: string;
  message: string;
  provider?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: AuthError | null;
  platform?: 'web' | 'tauri';
}

export type AuthListener = (state: AuthState) => void;

class IsomorphicAuthService {
  private state: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: true,
    error: null,
    platform: 'web',
  };

  private listeners: AuthListener[] = [];
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  /**
   * Initialize authentication service
   */
  private async initialize(): Promise<void> {
    try {
      this.setState({
        isLoading: true,
        error: null,
        platform: this.isTauriEnvironment() ? 'tauri' : 'web',
      });

      // Try to load existing session
      const session = await this.loadStoredSession();
      if (session) {
        // Verify session is still valid
        const isValid = await this.verifySession(session);
        if (isValid) {
          this.setState({
            isAuthenticated: true,
            user: session.user,
            token: session.accessToken,
            isLoading: false,
          });
          return;
        } else {
          // Session expired, clear it
          await this.clearStoredSession();
        }
      }

      this.setState({
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.setState({
        isLoading: false,
        error: {
          code: 'INIT_FAILED',
          message: 'Authentication initialization failed',
        },
      });
    }
  }

  /**
   * Get current authentication state
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Start OAuth flow for a specific provider
   */
  async startOAuthFlow(
    providerId: string,
    options: {
      returnTo?: string;
      sessionId?: string;
    } = {},
  ): Promise<{ success: boolean; authUrl?: string; error?: string }> {
    try {
      const { returnTo = '/dashboard', sessionId } = options;

      // Check if provider is supported
      const provider = OAUTH_PROVIDERS.find((p) => p.id === providerId);
      if (!provider) {
        return {
          success: false,
          error: `Unsupported OAuth provider: ${providerId}`,
        };
      }

      // Detect environment
      const isTauri = this.isTauriEnvironment();

      if (isTauri) {
        // For Tauri apps, use custom protocol handling
        return this.startTauriOAuthFlow(providerId, { returnTo, sessionId });
      } else {
        // For web apps, use direct redirect
        return this.startWebOAuthFlow(providerId, { returnTo, sessionId });
      }
    } catch (error) {
      console.error('OAuth flow start failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'OAuth flow failed to start',
      };
    }
  }

  /**
   * Start OAuth flow for web applications
   */
  private async startWebOAuthFlow(
    providerId: string,
    options: { returnTo?: string; sessionId?: string },
  ): Promise<{ success: boolean; authUrl?: string; error?: string }> {
    try {
      const response = await fetch(`/api/auth/social/${providerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.message || 'OAuth flow failed',
        };
      }

      const data = await response.json();

      // Redirect to OAuth provider
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return { success: true };
      }

      return {
        success: false,
        error: 'No auth URL received',
      };
    } catch (error) {
      console.error('Web OAuth flow failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Web OAuth flow failed',
      };
    }
  }

  /**
   * Start OAuth flow for Tauri applications
   */
  private async startTauriOAuthFlow(
    providerId: string,
    options: { returnTo?: string; sessionId?: string },
  ): Promise<{ success: boolean; authUrl?: string; error?: string }> {
    try {
      // Get OAuth URL from our API
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        'https://api.platform.elizaos.com';
      const response = await fetch(`${baseUrl}/api/auth/social/${providerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...options,
          platform: 'tauri',
          redirectUri: 'elizaos://auth/callback', // Custom protocol for Tauri
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.message || 'OAuth flow failed',
        };
      }

      const data = await response.json();

      if (data.authUrl) {
        // Open OAuth URL in external browser and wait for callback
        return this.handleTauriOAuthRedirect(data.authUrl, providerId, options);
      }

      return {
        success: false,
        error: 'No auth URL received',
      };
    } catch (error) {
      console.error('Tauri OAuth flow failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Tauri OAuth flow failed',
      };
    }
  }

  /**
   * Handle OAuth redirect for Tauri applications
   */
  private async handleTauriOAuthRedirect(
    authUrl: string,
    providerId: string,
    options: { returnTo?: string; sessionId?: string },
  ): Promise<{ success: boolean; authUrl?: string; error?: string }> {
    try {
      // Import Tauri APIs dynamically
      // @ts-expect-error - Tauri API only available in Tauri builds
      const { invoke } = await import('@tauri-apps/api/tauri');
      // @ts-expect-error - Tauri API only available in Tauri builds
      const { open } = await import('@tauri-apps/api/shell');

      // Open OAuth URL in external browser
      await open(authUrl);

      // Start listening for the OAuth callback
      return new Promise((resolve) => {
        const timeoutId = setTimeout(
          () => {
            resolve({
              success: false,
              error: 'OAuth timeout - please try again',
            });
          },
          5 * 60 * 1000,
        ); // 5 minute timeout

        // Listen for OAuth callback from Tauri backend
        const handleOAuthCallback = async (code: string, state: string) => {
          clearTimeout(timeoutId);

          try {
            // Exchange code for tokens
            const session = await this.exchangeOAuthCode(code, state);
            if (session) {
              await this.setSession(session);
              resolve({ success: true });
            } else {
              resolve({
                success: false,
                error: 'Failed to exchange OAuth code',
              });
            }
          } catch (error) {
            resolve({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'OAuth callback failed',
            });
          }
        };

        // Register callback handler with Tauri
        invoke('register_oauth_callback', {
          providerId,
          callback: handleOAuthCallback,
        }).catch((error: any) => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: `Failed to register OAuth callback: ${error}`,
          });
        });
      });
    } catch (error) {
      console.error('Tauri OAuth redirect failed:', error);
      return {
        success: false,
        error: 'Failed to open OAuth flow in browser',
      };
    }
  }

  /**
   * Exchange OAuth authorization code for session tokens
   */
  private async exchangeOAuthCode(
    code: string,
    state: string,
  ): Promise<AuthSession | null> {
    try {
      const baseUrl = this.isTauriEnvironment()
        ? process.env.NEXT_PUBLIC_API_BASE_URL ||
          'https://api.platform.elizaos.com'
        : '';

      const response = await fetch(`${baseUrl}/api/auth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
      });

      if (!response.ok) {
        throw new Error(`OAuth exchange failed: ${response.status}`);
      }

      const data = await response.json();
      return data.session;
    } catch (error) {
      console.error('OAuth code exchange failed:', error);
      return null;
    }
  }

  /**
   * Set authentication session
   */
  private async setSession(session: AuthSession): Promise<void> {
    try {
      // Store session securely
      await this.storeSession(session);

      // Update state
      this.setState({
        isAuthenticated: true,
        user: session.user,
        token: session.accessToken,
        error: null,
      });
    } catch (error) {
      console.error('Failed to set session:', error);
      throw error;
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    try {
      // Clear stored session
      await this.clearStoredSession();

      // Update state
      this.setState({
        isAuthenticated: false,
        user: null,
        token: null,
        error: null,
      });

      // Notify backend of logout (optional, for session cleanup)
      try {
        const baseUrl = this.isTauriEnvironment()
          ? process.env.NEXT_PUBLIC_API_BASE_URL ||
            'https://api.platform.elizaos.com'
          : '';

        await fetch(`${baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.state.token}`,
          },
        });
      } catch (error) {
        // Ignore logout API errors
        console.warn('Logout API call failed:', error);
      }
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<boolean> {
    try {
      const session = await this.loadStoredSession();
      if (!session?.refreshToken) {
        return false;
      }

      const baseUrl = this.isTauriEnvironment()
        ? process.env.NEXT_PUBLIC_API_BASE_URL ||
          'https://api.platform.elizaos.com'
        : '';

      const response = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });

      if (!response.ok) {
        // Refresh failed, clear session
        await this.clearStoredSession();
        this.setState({
          isAuthenticated: false,
          user: null,
          token: null,
        });
        return false;
      }

      const data = await response.json();
      await this.setSession(data.session);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Verify if session is still valid
   */
  private async verifySession(session: AuthSession): Promise<boolean> {
    try {
      // Check expiration
      if (Date.now() >= session.expiresAt) {
        return false;
      }

      // Optionally verify with server
      const baseUrl = this.isTauriEnvironment()
        ? process.env.NEXT_PUBLIC_API_BASE_URL ||
          'https://api.platform.elizaos.com'
        : '';

      const response = await fetch(`${baseUrl}/api/auth/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Session verification failed:', error);
      return false;
    }
  }

  /**
   * Store session securely
   */
  private async storeSession(session: AuthSession): Promise<void> {
    const sessionData = JSON.stringify(session);

    if (this.isTauriEnvironment()) {
      try {
        // @ts-expect-error - Tauri API only available in Tauri builds
        const { invoke } = await import('@tauri-apps/api/tauri');
        await invoke('store_auth_session', {
          session: SecurityManager.encryptToken(sessionData),
        });
      } catch (error) {
        console.warn(
          'Tauri session storage failed, using localStorage:',
          error,
        );
        localStorage.setItem(
          'elizaos_auth_session',
          SecurityManager.encryptToken(sessionData),
        );
      }
    } else {
      localStorage.setItem(
        'elizaos_auth_session',
        SecurityManager.encryptToken(sessionData),
      );
    }
  }

  /**
   * Load stored session
   */
  private async loadStoredSession(): Promise<AuthSession | null> {
    try {
      let encryptedSession: string | null = null;

      if (this.isTauriEnvironment()) {
        try {
          // @ts-expect-error - Tauri API only available in Tauri builds
          const { invoke } = await import('@tauri-apps/api/tauri');
          encryptedSession = await invoke('get_auth_session');
        } catch (error) {
          console.warn(
            'Tauri session loading failed, using localStorage:',
            error,
          );
          encryptedSession = localStorage.getItem('elizaos_auth_session');
        }
      } else {
        encryptedSession = localStorage.getItem('elizaos_auth_session');
      }

      if (!encryptedSession) {
        return null;
      }

      const sessionData = SecurityManager.decryptToken(encryptedSession);
      return JSON.parse(sessionData);
    } catch (error) {
      console.error('Failed to load stored session:', error);
      return null;
    }
  }

  /**
   * Clear stored session
   */
  private async clearStoredSession(): Promise<void> {
    if (this.isTauriEnvironment()) {
      try {
        // @ts-expect-error - Tauri API only available in Tauri builds
        const { invoke } = await import('@tauri-apps/api/tauri');
        await invoke('clear_auth_session');
      } catch (error) {
        console.warn(
          'Tauri session clearing failed, using localStorage:',
          error,
        );
        localStorage.removeItem('elizaos_auth_session');
      }
    } else {
      localStorage.removeItem('elizaos_auth_session');
    }
  }

  /**
   * Check if running in Tauri environment
   */
  private isTauriEnvironment(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  }

  /**
   * Update internal state and notify listeners
   */
  private setState(updates: Partial<AuthState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Auth state listener error:', error);
      }
    });
  }

  /**
   * Subscribe to authentication state changes
   */
  subscribe(listener: AuthListener): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get available OAuth providers
   */
  getOAuthProviders(): OAuthProvider[] {
    return [...OAUTH_PROVIDERS];
  }

  /**
   * Store authentication token
   */
  async storeAuthToken(token: string): Promise<void> {
    try {
      if (this.isTauriEnvironment()) {
        // Store in Tauri secure storage
        // @ts-expect-error - Tauri API only available in Tauri builds
        const { invoke } = await import('@tauri-apps/api/tauri');
        await invoke('store_auth_token', { token });
      } else {
        // Store in web localStorage (could be enhanced with encryption)
        localStorage.setItem('auth_token', token);
      }

      // Update state
      this.setState({ token });
    } catch (error) {
      console.error('Failed to store auth token:', error);
      throw error;
    }
  }

  /**
   * Get stored authentication token
   */
  async getAuthToken(): Promise<string | null> {
    try {
      if (this.isTauriEnvironment()) {
        // Get from Tauri secure storage
        // @ts-expect-error - Tauri API only available in Tauri builds
        const { invoke } = await import('@tauri-apps/api/tauri');
        return await invoke('get_auth_token');
      } else {
        // Get from web localStorage
        return localStorage.getItem('auth_token');
      }
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }
}

// Export singleton instance
export const isomorphicAuth = new IsomorphicAuthService();
export type { IsomorphicAuthService };
export default isomorphicAuth;
