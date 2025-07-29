/**
 * API Adapter that works with both local API routes and external API service
 * Allows for gradual migration without breaking existing functionality
 */

interface ApiConfig {
  mode: 'local' | 'external';
  externalBaseUrl?: string;
}

class ApiAdapter {
  private config: ApiConfig;

  constructor(config: ApiConfig = { mode: 'local' }) {
    this.config = config;
  }

  private async callLocalApi<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(endpoint, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  }

  private async callExternalApi<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.config.externalBaseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (this.config.mode === 'external' && this.config.externalBaseUrl) {
      return this.callExternalApi<T>(endpoint, options);
    } else {
      return this.callLocalApi<T>(endpoint, options);
    }
  }

  // Gradually migrate endpoints
  async getCharacters(
    params: any = {},
  ): Promise<{ characters: any[]; stats: any }> {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/characters?${query}`);
  }

  async createCharacter(data: any): Promise<any> {
    return this.request('/api/characters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

// Auto-detect environment and configure adapter
const getApiConfig = (): ApiConfig => {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    // In Tauri app, use external API
    return {
      mode: 'external',
      externalBaseUrl:
        process.env.API_BASE_URL || 'https://api.platform.elizaos.com',
    };
  } else if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost'
  ) {
    // In production web app, use external API
    return {
      mode: 'external',
      externalBaseUrl:
        process.env.API_BASE_URL || 'https://api.platform.elizaos.com',
    };
  } else {
    // In development, use local API routes
    return { mode: 'local' };
  }
};

export const apiAdapter = new ApiAdapter(getApiConfig());
