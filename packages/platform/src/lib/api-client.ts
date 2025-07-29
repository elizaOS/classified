interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

class OfflineCapableApiClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private cache = new Map<string, CacheEntry<any>>();
  private offlineQueue: Array<{
    request: RequestInfo;
    options: RequestInit;
    resolve: any;
    reject: any;
  }> = [];
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor(
    baseUrl: string = process.env.API_BASE_URL ||
      'https://api.platform.elizaos.com',
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }
  }

  private handleOnline() {
    this.isOnline = true;
    this.processOfflineQueue();
  }

  private handleOffline() {
    this.isOnline = false;
  }

  private async processOfflineQueue() {
    while (this.offlineQueue.length > 0) {
      const { request, options, resolve, reject } = this.offlineQueue.shift()!;
      try {
        const response = await this.makeRequest(request, options);
        resolve(response);
      } catch (error) {
        reject(error);
      }
    }
  }

  private getCacheKey(url: string, options: RequestInit = {}): string {
    const method = options.method || 'GET';
    const body = options.body || '';
    return `${method}:${url}:${body}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttlSeconds = 300): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  private async makeRequest<T>(
    endpoint: string | RequestInfo,
    options: RequestInit = {},
  ): Promise<T> {
    const url =
      typeof endpoint === 'string' ? `${this.baseUrl}${endpoint}` : endpoint;

    // Initialize base headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Safely merge headers from options
    if (options.headers) {
      // Handle different header types
      if (options.headers instanceof Headers) {
        // Headers object
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        // Array of tuples
        options.headers.forEach(([key, value]) => {
          headers[key] = String(value);
        });
      } else {
        // Plain object
        Object.entries(options.headers).forEach(([key, value]) => {
          headers[key] = String(value);
        });
      }
    }

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    cacheOptions?: { ttl?: number; staleWhileRevalidate?: boolean },
  ): Promise<ApiResponse<T>> {
    const cacheKey = this.getCacheKey(endpoint, options);
    const method = options.method || 'GET';

    // Check cache for GET requests
    if (method === 'GET' && cacheOptions) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        // Return cached data immediately
        const result: ApiResponse<T> = {
          success: true,
          data: cached,
          cached: true,
        };

        // If stale-while-revalidate, update cache in background
        if (cacheOptions.staleWhileRevalidate && this.isOnline) {
          this.makeRequest<T>(endpoint, options)
            .then((data) => this.setCache(cacheKey, data, cacheOptions.ttl))
            .catch(() => {}); // Ignore background errors
        }

        return result;
      }
    }

    // If offline and not cached, queue the request
    if (!this.isOnline && method !== 'GET') {
      return new Promise((resolve, reject) => {
        this.offlineQueue.push({
          request: endpoint,
          options,
          resolve: (data: T) => resolve({ success: true, data }),
          reject: (error: Error) =>
            resolve({ success: false, error: error.message }),
        });
      });
    }

    try {
      const data = await this.makeRequest<T>(endpoint, options);

      // Cache successful GET responses
      if (method === 'GET' && cacheOptions) {
        this.setCache(cacheKey, data, cacheOptions.ttl);
      }

      return { success: true, data };
    } catch (error) {
      console.error('API request failed:', error);

      // Try to return stale cache data if available
      if (method === 'GET') {
        const staleCache = this.cache.get(cacheKey);
        if (staleCache) {
          return {
            success: true,
            data: staleCache.data,
            cached: true,
          };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Simplified authentication without OAuth complexity
  async authenticate(
    email: string,
    password: string,
  ): Promise<{ token: string; user: any }> {
    const response = await this.request<{ token: string; user: any }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );

    if (response.success && response.data) {
      this.authToken = response.data.token;
      await this.storeTokenSecurely(response.data.token);
      return response.data;
    }

    throw new Error(response.error || 'Authentication failed');
  }

  private async storeTokenSecurely(token: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        // Dynamic import for Tauri - only load when needed
        try {
          // @ts-expect-error - Tauri API only available in Tauri builds
          const { invoke } = await import('@tauri-apps/api/tauri');
          await invoke('store_auth_token', { token });
        } catch (tauriError) {
          console.warn(
            'Tauri API not available, falling back to localStorage:',
            tauriError,
          );
          localStorage.setItem('elizaos_auth_token', token);
        }
      } else {
        // Fallback to localStorage for web/PWA
        localStorage.setItem('elizaos_auth_token', token);
      }
    } catch (error) {
      console.warn('Failed to store token securely:', error);
    }
  }

  async loadStoredToken(): Promise<boolean> {
    try {
      let token: string | null = null;

      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        try {
          // @ts-expect-error - Tauri API only available in Tauri builds
          const { invoke } = await import('@tauri-apps/api/tauri');
          token = await invoke('get_auth_token');
        } catch (tauriError) {
          console.warn(
            'Tauri API not available, falling back to localStorage:',
            tauriError,
          );
          token = localStorage.getItem('elizaos_auth_token');
        }
      } else if (typeof window !== 'undefined') {
        token = localStorage.getItem('elizaos_auth_token');
      }

      if (token) {
        this.authToken = token;
        return true;
      }
    } catch (error) {
      console.warn('Failed to load stored token:', error);
    }

    return false;
  }

  clearAuth(): void {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('elizaos_auth_token');
      if ('__TAURI__' in window) {
        // @ts-expect-error - Tauri API only available in Tauri builds
        import('@tauri-apps/api/tauri')
          .then(({ invoke }) => {
            invoke('clear_auth_token').catch(() => {});
          })
          .catch(() => {
            // Ignore Tauri import errors
          });
      }
    }
  }

  // API methods with caching
  async getCharacters(
    params: any = {},
  ): Promise<{ characters: any[]; stats: any }> {
    const query = new URLSearchParams(params).toString();
    const response = await this.request<{ characters: any[]; stats: any }>(
      `/api/characters?${query}`,
      {},
      { ttl: 60, staleWhileRevalidate: true },
    );

    if (!response.success) {
      throw new Error(response.error);
    }

    return response.data!;
  }

  async createCharacter(data: any): Promise<any> {
    const response = await this.request<any>('/api/characters', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return response.data;
  }

  // Add similar methods for agents, conversations, etc.
}

export const apiClient = new OfflineCapableApiClient();
export default apiClient;
