/**
 * Centralized configuration constants for the ElizaOS Game
 * These values can be overridden by environment variables
 */

import { env } from './environment';

// Default values - can be overridden by environment variables
const DEFAULT_AGENT_ID = '2fbc0c27-50f4-09f2-9fe4-9dd27d76d46f';
const DEFAULT_ROOM_ID = 'ce5f41b4-fe24-4c01-9971-aecfed20a6bd';

/**
 * Application configuration constants
 * Values are resolved from environment variables with fallbacks to defaults
 */
export const CONFIG = {
  /**
   * Default agent ID for ELIZA agent
   * Can be overridden with ELIZA_AGENT_ID environment variable
   */
  AGENT_ID: (() => {
    // Check for environment variable in different contexts
    if (typeof window !== 'undefined') {
      // Browser environment - check for injected config
      return (window as any).__ELIZA_CONFIG__?.AGENT_ID || DEFAULT_AGENT_ID;
    }
    // Node.js environment
    return import.meta.env.VITE_ELIZA_AGENT_ID || DEFAULT_AGENT_ID;
  })(),

  /**
   * Default room ID for autonomous thoughts
   * Can be overridden with ELIZA_ROOM_ID environment variable
   */
  ROOM_ID: (() => {
    // Check for environment variable in different contexts
    if (typeof window !== 'undefined') {
      // Browser environment - check for injected config
      return (window as any).__ELIZA_CONFIG__?.ROOM_ID || DEFAULT_ROOM_ID;
    }
    // Node.js environment
    return import.meta.env.VITE_ELIZA_ROOM_ID || DEFAULT_ROOM_ID;
  })(),

  /**
   * API endpoints configuration
   */
  API: {
    BASE_URL: env.apiBaseUrl,
  },

  /**
   * WebSocket configuration
   */
  WEBSOCKET: {
    URL: env.websocketUrl,
  },
} as const;

/**
 * Type-safe access to configuration values
 */
export type ConfigType = typeof CONFIG;

/**
 * Utility to check if we're running in a browser environment
 */
export const isBrowser = typeof window !== 'undefined';

/**
 * Utility to check if we're running in a Node.js environment
 */
export const isNode = false; // In Vite/browser environment

/**
 * Get configuration value with runtime validation
 * @param key - Configuration key path (dot notation supported)
 * @param fallback - Fallback value if key is not found
 */
export function getConfig<T = string>(key: string, fallback: T): T {
  const keys = key.split('.');
  let value: any = CONFIG;

  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }

  return value !== undefined ? value : fallback;
}

/**
 * Validate that all required configuration values are present
 * @throws Error if required configuration is missing
 */
export function validateConfig(): void {
  const requiredKeys = ['AGENT_ID', 'ROOM_ID'];

  for (const key of requiredKeys) {
    const value = getConfig<string>(key, '');
    if (!value || value.trim() === '') {
      throw new Error(`Required configuration missing: ${key}`);
    }
  }
}

/**
 * Get runtime configuration info for debugging
 */
export function getConfigInfo() {
  return {
    environment: isBrowser ? 'browser' : isNode ? 'node' : 'unknown',
    agentId: CONFIG.AGENT_ID,
    roomId: CONFIG.ROOM_ID,
    apiBaseUrl: CONFIG.API.BASE_URL,
    websocketUrl: CONFIG.WEBSOCKET.URL,
    timestamp: new Date().toISOString(),
  };
}
