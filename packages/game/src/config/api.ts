/**
 * API configuration for direct backend connections
 * This replaces the Vite proxy setup for better Tauri compatibility
 */

import { env } from './environment';

export const BACKEND_URL = env.apiBaseUrl;

/**
 * Helper function to construct API URLs
 * @param path - API path (e.g., '/api/setup/status')
 * @returns Full URL for the API endpoint
 */
export const apiUrl = (path: string): string => {
  return env.buildApiUrl(path);
};

/**
 * Fetch wrapper with proper error handling and default options
 */
export const apiFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
  const url = apiUrl(path);

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response;
};
