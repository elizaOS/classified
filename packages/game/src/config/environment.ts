/**
 * Environment configuration for production-ready deployment
 * Centralizes all environment-specific settings
 */

interface EnvironmentConfig {
  API_BASE_URL: string;
  WEBSOCKET_URL: string;
  IS_PRODUCTION: boolean;
  IS_DEVELOPMENT: boolean;
  IS_TAURI: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  ENABLE_ERROR_REPORTING: boolean;
  ERROR_REPORTING_URL?: string;
  DEFAULT_BACKEND_PORT: number;
}

class Environment {
  private static instance: Environment;
  private config: EnvironmentConfig;

  private constructor() {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';

    // Get backend port from environment or use default
    const backendPort =
      process.env.REACT_APP_BACKEND_PORT || process.env.VITE_BACKEND_PORT || '7777';

    // Get API URLs from environment variables with proper fallbacks
    const apiBaseUrl = this.getApiBaseUrl(isDevelopment, backendPort);
    const websocketUrl = this.getWebsocketUrl(isDevelopment, backendPort);

    this.config = {
      API_BASE_URL: apiBaseUrl,
      WEBSOCKET_URL: websocketUrl,
      IS_PRODUCTION: isProduction,
      IS_DEVELOPMENT: isDevelopment,
      IS_TAURI: isTauri,
      LOG_LEVEL: isProduction ? 'error' : 'debug',
      ENABLE_ERROR_REPORTING: isProduction,
      ERROR_REPORTING_URL: process.env.REACT_APP_ERROR_REPORTING_URL,
      DEFAULT_BACKEND_PORT: parseInt(backendPort, 10),
    };

    // Log configuration in development
    if (isDevelopment) {
      console.info('Environment Configuration:', {
        ...this.config,
        // Don't log sensitive URLs in production
        API_BASE_URL: this.config.API_BASE_URL,
        WEBSOCKET_URL: this.config.WEBSOCKET_URL,
      });
    }
  }

  private getApiBaseUrl(isDevelopment: boolean, backendPort: string): string {
    // Check for explicit environment variable first
    const envApiUrl = process.env.REACT_APP_API_BASE_URL || process.env.VITE_API_BASE_URL;
    if (envApiUrl) {
      return envApiUrl;
    }

    // Check for window configuration (can be injected by server)
    if (typeof window !== 'undefined' && (window as any).__ELIZA_CONFIG__?.API_BASE_URL) {
      return (window as any).__ELIZA_CONFIG__.API_BASE_URL;
    }

    // In production, use relative URLs to work with any domain
    if (!isDevelopment) {
      return '/api';
    }

    // In development, use localhost with configured port
    return `http://localhost:${backendPort}`;
  }

  private getWebsocketUrl(isDevelopment: boolean, backendPort: string): string {
    // Check for explicit environment variable first
    const envWsUrl = process.env.REACT_APP_WEBSOCKET_URL || process.env.VITE_WEBSOCKET_URL;
    if (envWsUrl) {
      return envWsUrl;
    }

    // Check for window configuration (can be injected by server)
    if (typeof window !== 'undefined' && (window as any).__ELIZA_CONFIG__?.WEBSOCKET_URL) {
      return (window as any).__ELIZA_CONFIG__.WEBSOCKET_URL;
    }

    // In production, use relative WebSocket URL
    if (!isDevelopment && typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/ws`;
    }

    // In development, use localhost with configured port
    return `ws://localhost:${backendPort}`;
  }

  static getInstance(): Environment {
    if (!Environment.instance) {
      Environment.instance = new Environment();
    }
    return Environment.instance;
  }

  get apiBaseUrl(): string {
    return this.config.API_BASE_URL;
  }

  get websocketUrl(): string {
    return this.config.WEBSOCKET_URL;
  }

  get isProduction(): boolean {
    return this.config.IS_PRODUCTION;
  }

  get isDevelopment(): boolean {
    return this.config.IS_DEVELOPMENT;
  }

  get isTauri(): boolean {
    return this.config.IS_TAURI;
  }

  get logLevel(): string {
    return this.config.LOG_LEVEL;
  }

  get enableErrorReporting(): boolean {
    return this.config.ENABLE_ERROR_REPORTING;
  }

  get errorReportingUrl(): string | undefined {
    return this.config.ERROR_REPORTING_URL;
  }

  get defaultBackendPort(): number {
    return this.config.DEFAULT_BACKEND_PORT;
  }

  // Method to build full API URLs
  buildApiUrl(path: string): string {
    const baseUrl = this.apiBaseUrl.replace(/\/$/, ''); // Remove trailing slash
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  }

  // Method to update configuration at runtime (useful for testing)
  updateConfig(updates: Partial<EnvironmentConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Export singleton instance
export const env = Environment.getInstance();

// Export type for use in other files
export type { EnvironmentConfig };
