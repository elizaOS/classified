/**
 * Environment Configuration for Isomorphic App
 * Handles environment variables safely for both web and Tauri environments
 */

export interface EnvironmentConfig {
  // API Configuration
  apiBaseUrl: string;
  isProduction: boolean;
  isDevelopment: boolean;

  // Platform Detection
  isTauri: boolean;
  isWeb: boolean;

  // OAuth Configuration (public values only)
  workosClientId?: string;
  workosRedirectUri: string;

  // App Configuration
  appName: string;
  appVersion: string;
  appIdentifier: string;
}

/**
 * Get environment configuration safely
 * This function ensures no secrets are exposed to the client
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  // Detect platform
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
  const isWeb = !isTauri;

  // Detect environment
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  // Determine API base URL
  let apiBaseUrl: string;
  if (isTauri) {
    // For Tauri apps, always use the external API
    apiBaseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      'https://api.platform.elizaos.com';
  } else if (isProduction) {
    // For production web, use external API
    apiBaseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      'https://api.platform.elizaos.com';
  } else {
    // For development web, use local API routes
    apiBaseUrl = '';
  }

  // OAuth redirect URI
  let workosRedirectUri: string;
  if (isTauri) {
    workosRedirectUri = 'elizaos://auth/callback';
  } else if (isProduction) {
    workosRedirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://platform.elizaos.com'}/auth/callback`;
  } else {
    workosRedirectUri = 'http://localhost:3333/auth/callback';
  }

  return {
    // API Configuration
    apiBaseUrl,
    isProduction,
    isDevelopment,

    // Platform Detection
    isTauri,
    isWeb,

    // OAuth Configuration (only safe public values)
    workosClientId: process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID,
    workosRedirectUri,

    // App Configuration
    appName: 'ElizaOS Platform',
    appVersion: '1.0.0',
    appIdentifier: 'com.elizaos.platform',
  };
}

/**
 * Get server-side environment variables
 * This should only be used on the server side where secrets are safe
 */
export function getServerEnvironmentConfig() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'getServerEnvironmentConfig() should only be called on the server side',
    );
  }

  return {
    // WorkOS Configuration (server-side only)
    workosApiKey: process.env.WORKOS_API_KEY,
    workosClientId: process.env.WORKOS_CLIENT_ID,
    workosRedirectUri: process.env.WORKOS_REDIRECT_URI,
    workosWebhookSecret: process.env.WORKOS_WEBHOOK_SECRET,

    // JWT Configuration
    jwtSecret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,

    // Database Configuration
    databaseUrl: process.env.DATABASE_URL,

    // Other secrets
    encryptionKey: process.env.ENCRYPTION_KEY,
    stripeApiKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

    // App URLs
    appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL,
    apiUrl: process.env.API_BASE_URL,
  };
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = getEnvironmentConfig();

  // Validate public configuration
  if (!config.apiBaseUrl && config.isProduction) {
    errors.push('NEXT_PUBLIC_API_BASE_URL is required in production');
  }

  // Server-side validation (only run on server)
  if (typeof window === 'undefined') {
    try {
      const serverConfig = getServerEnvironmentConfig();

      if (!serverConfig.workosApiKey) {
        errors.push('WORKOS_API_KEY is required');
      }

      if (!serverConfig.workosClientId) {
        errors.push('WORKOS_CLIENT_ID is required');
      }

      if (!serverConfig.jwtSecret) {
        errors.push('JWT_SECRET or NEXTAUTH_SECRET is required');
      }

      if (config.isProduction && !serverConfig.databaseUrl) {
        errors.push('DATABASE_URL is required in production');
      }
    } catch (error) {
      // This is expected when called from client side
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get environment-specific build configuration
 */
export function getBuildConfig() {
  const config = getEnvironmentConfig();

  return {
    // Build mode for Next.js
    buildMode: process.env.BUILD_MODE || 'default',

    // Asset prefix for Tauri builds
    assetPrefix: process.env.BUILD_MODE === 'export' ? './' : '',

    // Output configuration
    output: process.env.BUILD_MODE === 'export' ? 'export' : undefined,

    // Image optimization
    images:
      process.env.BUILD_MODE === 'export' ? { unoptimized: true } : undefined,

    // Trailing slash for static builds
    trailingSlash: process.env.BUILD_MODE === 'export',

    // Environment variables to expose to client
    env: {
      NEXT_PUBLIC_API_BASE_URL: config.apiBaseUrl,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_WORKOS_CLIENT_ID: process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID,
      BUILD_MODE: process.env.BUILD_MODE || 'default',
    },
  };
}

// Default export
const envConfig = {
  getEnvironmentConfig,
  getServerEnvironmentConfig,
  validateEnvironment,
  getBuildConfig,
};

export default envConfig;
