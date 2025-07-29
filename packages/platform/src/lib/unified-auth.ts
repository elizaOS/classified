/**
 * Unified Authentication Service
 * Uses WorkOS for both web and Tauri applications consistently
 */

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  avatar?: string;
  organizationId?: string;
  role?: string;
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
  icon: string;
  color: string;
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  { id: 'google', name: 'Google', icon: '🔵', color: '#4285f4' },
  { id: 'github', name: 'GitHub', icon: '⚫', color: '#24292e' },
  { id: 'discord', name: 'Discord', icon: '🟣', color: '#7289da' },
  { id: 'microsoft', name: 'Microsoft', icon: '🟦', color: '#0078d4' },
];

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  platform: 'web' | 'tauri';
}

export interface OAuthResult {
  success: boolean;
  error?: string;
  redirectUrl?: string;
}

type AuthListener = (state: AuthState) => void;

class UnifiedAuthService {
  private state: AuthState = {
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
    platform: this.detectPlatform(),
  };

  private listeners: AuthListener[] = [];
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  /**
   * Detect the current platform
   */
  private detectPlatform(): 'web' | 'tauri' {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      return 'tauri';
    }
    return 'web';
  }

  /**
   * Initialize the authentication service
   */
  private async initialize(): Promise<void> {
    try {
      this.setState({ isLoading: true, error: null });

      // Check for existing session
      const session = await this.getStoredSession();
      if (session && (await this.isSessionValid(session))) {
        this.setState({
          isAuthenticated: true,
          user: session.user,
          isLoading: false,
        });
      } else {
        // Clear invalid session
        await this.clearStoredSession();
        this.setState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.setState({
        isLoading: false,
        error: 'Failed to initialize authentication',
      });
    }
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
   * Get current authentication state
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Start OAuth flow for the specified provider
   */
  async startOAuthFlow(
    providerId: string,
    options: { returnTo?: string; sessionId?: string } = {},
  ): Promise<OAuthResult> {
    try {
      // Validate provider
      const provider = OAUTH_PROVIDERS.find((p) => p.id === providerId);
      if (!provider) {
        return {
          success: false,
          error: `Unknown provider: ${providerId}`,
        };
      }

      const { returnTo = '/dashboard' } = options;
      const platform = this.state.platform;

      // Build the OAuth initiation URL
      const params = new URLSearchParams({
        platform,
        return_to: returnTo,
        ...(options.sessionId && { session_id: options.sessionId }),
      });

      const apiUrl = this.getApiBaseUrl();
      const oauthUrl = `${apiUrl}/api/auth/social/${providerId}?${params}`;

      if (platform === 'tauri') {
        return this.handleTauriOAuth(oauthUrl);
      } else {
        return this.handleWebOAuth(oauthUrl);
      }
    } catch (error) {
      console.error('OAuth flow failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth flow failed',
      };
    }
  }

  /**
   * Handle OAuth for web platform
   */
  private async handleWebOAuth(oauthUrl: string): Promise<OAuthResult> {
    try {
      // For web, redirect directly to the OAuth URL
      window.location.href = oauthUrl;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to redirect to OAuth provider',
      };
    }
  }

  /**
   * Handle OAuth for Tauri platform
   */
  private async handleTauriOAuth(oauthUrl: string): Promise<OAuthResult> {
    try {
      // Check if we're actually in Tauri
      if (!('__TAURI__' in window)) {
        throw new Error('Tauri API not available');
      }

      // Get the actual OAuth URL from our API first
      const response = await fetch(oauthUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.message || 'Failed to get OAuth URL',
        };
      }

      // If this is a redirect response, we need to follow it
      const finalUrl = response.url;

      // For Tauri, open the OAuth URL in external browser
      try {
        // Use window.open as a fallback if Tauri shell is not available
        window.open(finalUrl, '_blank');

        // Listen for the OAuth callback
        this.listenForOAuthCallback();

        return { success: true };
      } catch (shellError) {
        console.warn(
          'Tauri shell not available, using window.open:',
          shellError,
        );
        window.open(finalUrl, '_blank');
        return { success: true };
      }
    } catch (error) {
      console.error('Tauri OAuth failed:', error);
      return {
        success: false,
        error: 'Failed to open OAuth flow',
      };
    }
  }

  /**
   * Listen for OAuth callback in Tauri
   */
  private async listenForOAuthCallback(): Promise<void> {
    // This would be implemented with proper Tauri event listeners
    // For now, we'll handle it through URL monitoring or deep links
    console.log('Listening for OAuth callback...');
  }

  /**
   * Complete OAuth flow with authorization code
   */
  async completeOAuthFlow(code: string, state: string): Promise<boolean> {
    try {
      const apiUrl = this.getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/auth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`OAuth callback failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.session) {
        await this.setSession(data.session);
        return true;
      }

      return false;
    } catch (error) {
      console.error('OAuth completion failed:', error);
      this.setState({ error: 'Authentication failed' });
      return false;
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      // Clear stored session
      await this.clearStoredSession();

      // Update state
      this.setState({
        isAuthenticated: false,
        user: null,
        error: null,
      });

      // Optionally notify server
      try {
        const apiUrl = this.getApiBaseUrl();
        await fetch(`${apiUrl}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch (error) {
        console.warn('Logout API call failed:', error);
      }
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }

  /**
   * Refresh the authentication token
   */
  async refreshToken(): Promise<boolean> {
    try {
      const apiUrl = this.getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        await this.signOut();
        return false;
      }

      const data = await response.json();
      if (data.session) {
        await this.setSession(data.session);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Set the user session
   */
  private async setSession(session: AuthSession): Promise<void> {
    await this.storeSession(session);
    this.setState({
      isAuthenticated: true,
      user: session.user,
      error: null,
    });
  }

  /**
   * Store session based on platform
   */
  private async storeSession(session: AuthSession): Promise<void> {
    const sessionData = JSON.stringify(session);

    if (this.state.platform === 'tauri') {
      try {
        // Try to use Tauri's secure storage
        if (
          typeof window !== 'undefined' &&
          '__TAURI__' in window &&
          (window as any).__TAURI__.invoke
        ) {
          await (window as any).__TAURI__.invoke('store_auth_session', {
            session: sessionData,
          });
          return;
        }
      } catch (error) {
        console.warn('Tauri storage failed, using localStorage:', error);
      }
    }

    // Fallback to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('elizaos_auth_session', sessionData);
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem('elizaos_auth_session', sessionData);
    }
  }

  /**
   * Get stored session
   */
  private async getStoredSession(): Promise<AuthSession | null> {
    try {
      let sessionData: string | null = null;

      if (this.state.platform === 'tauri') {
        try {
          if (
            typeof window !== 'undefined' &&
            '__TAURI__' in window &&
            (window as any).__TAURI__.invoke
          ) {
            sessionData = await (window as any).__TAURI__.invoke(
              'get_auth_session',
            );
          }
        } catch (error) {
          console.warn(
            'Tauri storage access failed, using localStorage:',
            error,
          );
        }
      }

      // Fallback to localStorage
      if (!sessionData) {
        if (typeof window !== 'undefined' && window.localStorage) {
          sessionData = window.localStorage.getItem('elizaos_auth_session');
        } else if (typeof localStorage !== 'undefined') {
          sessionData = localStorage.getItem('elizaos_auth_session');
        }
      }

      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      console.error('Failed to get stored session:', error);
      return null;
    }
  }

  /**
   * Clear stored session
   */
  private async clearStoredSession(): Promise<void> {
    if (this.state.platform === 'tauri') {
      try {
        if (
          typeof window !== 'undefined' &&
          '__TAURI__' in window &&
          (window as any).__TAURI__.invoke
        ) {
          await (window as any).__TAURI__.invoke('clear_auth_session');
        }
      } catch (error) {
        console.warn('Tauri storage clear failed, using localStorage:', error);
      }
    }

    // Always clear localStorage as well
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('elizaos_auth_session');
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('elizaos_auth_session');
    }
  }

  /**
   * Check if session is valid
   */
  private async isSessionValid(session: AuthSession): Promise<boolean> {
    // Check expiration
    if (Date.now() >= session.expiresAt) {
      return false;
    }

    // Optionally verify with server
    try {
      const apiUrl = this.getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/auth/verify`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.warn('Session verification failed:', error);
      return true; // Assume valid if verification fails
    }
  }

  /**
   * Get API base URL based on platform
   */
  private getApiBaseUrl(): string {
    // For Tauri apps, use absolute URLs
    if (
      this.state.platform === 'tauri' ||
      (typeof window !== 'undefined' && '__TAURI__' in window)
    ) {
      return (
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        'https://api.platform.elizaos.com'
      );
    }

    // For web apps, use relative URLs
    return '';
  }

  /**
   * Get available OAuth providers
   */
  getOAuthProviders(): OAuthProvider[] {
    return [...OAUTH_PROVIDERS];
  }

  /**
   * Subscribe to authentication state changes
   */
  subscribe(listener: AuthListener): () => void {
    this.listeners.push(listener);

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Update state and notify listeners
   */
  private setState(updates: Partial<AuthState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }
}

// Export singleton instance
export const unifiedAuth = new UnifiedAuthService();
export default unifiedAuth;
