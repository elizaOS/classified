/**
 * API Key Manager
 * Secure handling of API keys with encryption and validation
 */

import { logger } from './logger';

const API_KEY_STORAGE_PREFIX = 'eliza_encrypted_';
const MASKED_KEY_PREVIEW = '***SET***';
const MIN_KEY_LENGTH = 10;

interface ApiKeyValidation {
  isValid: boolean;
  error?: string;
}

export class ApiKeyManager {
  private static instance: ApiKeyManager;

  private constructor() {}

  static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }

  /**
   * Validate API key format and strength
   */
  validateApiKey(key: string, provider: string): ApiKeyValidation {
    if (!key || typeof key !== 'string') {
      return { isValid: false, error: 'API key is required' };
    }

    if (key === MASKED_KEY_PREVIEW) {
      return { isValid: true }; // Key is already set, no need to validate
    }

    if (key.length < MIN_KEY_LENGTH) {
      return { isValid: false, error: `API key must be at least ${MIN_KEY_LENGTH} characters` };
    }

    // Provider-specific validation
    switch (provider.toLowerCase()) {
      case 'openai':
        if (!key.startsWith('sk-')) {
          return { isValid: false, error: 'OpenAI API key should start with "sk-"' };
        }
        break;
      case 'anthropic':
        if (!key.includes('-')) {
          return { isValid: false, error: 'Invalid Anthropic API key format' };
        }
        break;
      // Add more provider-specific validations as needed
    }

    // Check for common mistakes
    if (key.includes(' ')) {
      return { isValid: false, error: 'API key should not contain spaces' };
    }

    if (key.includes('"') || key.includes("'")) {
      return { isValid: false, error: 'API key should not contain quotes' };
    }

    return { isValid: true };
  }

  /**
   * Store API key securely (encrypted in production)
   */
  async storeApiKey(provider: string, key: string): Promise<void> {
    const validation = this.validateApiKey(key, provider);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const storageKey = `${API_KEY_STORAGE_PREFIX}${provider}`;

    try {
      // In production, encrypt the key before storing
      if (process.env.NODE_ENV === 'production') {
        // Use Web Crypto API for encryption
        const encryptedKey = await this.encryptKey(key);
        localStorage.setItem(storageKey, encryptedKey);
      } else {
        // In development, store with a warning prefix
        localStorage.setItem(storageKey, `DEV_ONLY_${key}`);
      }

      logger.info(`API key for ${provider} stored securely`);
    } catch (error) {
      logger.error(`Failed to store API key for ${provider}`, error);
      throw new Error('Failed to store API key securely');
    }
  }

  /**
   * Retrieve API key (decrypt if needed)
   */
  async getApiKey(provider: string): Promise<string | null> {
    const storageKey = `${API_KEY_STORAGE_PREFIX}${provider}`;

    try {
      const storedValue = localStorage.getItem(storageKey);
      if (!storedValue) {
        return null;
      }

      // In production, decrypt the key
      if (process.env.NODE_ENV === 'production') {
        return await this.decryptKey(storedValue);
      } else {
        // In development, remove the warning prefix
        return storedValue.replace('DEV_ONLY_', '');
      }
    } catch (error) {
      logger.error(`Failed to retrieve API key for ${provider}`, error);
      return null;
    }
  }

  /**
   * Check if API key is set (without retrieving it)
   */
  isApiKeySet(provider: string): boolean {
    const storageKey = `${API_KEY_STORAGE_PREFIX}${provider}`;
    return localStorage.getItem(storageKey) !== null;
  }

  /**
   * Remove stored API key
   */
  removeApiKey(provider: string): void {
    const storageKey = `${API_KEY_STORAGE_PREFIX}${provider}`;
    localStorage.removeItem(storageKey);
    logger.info(`API key for ${provider} removed`);
  }

  /**
   * Get masked preview of API key for display
   */
  getMaskedKeyPreview(key: string): string {
    if (!key || key.length < 8) {
      return MASKED_KEY_PREVIEW;
    }

    // Show first 3 and last 3 characters
    const firstPart = key.substring(0, 3);
    const lastPart = key.substring(key.length - 3);
    return `${firstPart}...${lastPart}`;
  }

  /**
   * Encrypt API key using Web Crypto API
   */
  private async encryptKey(key: string): Promise<string> {
    // Generate encryption key from a stable source
    const encoder = new TextEncoder();
    const data = encoder.encode(key);

    // Use a deterministic key based on browser fingerprint or user ID
    const cryptoKey = await this.getEncryptionKey();

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      cryptoKey,
      data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt API key
   */
  private async decryptKey(encryptedKey: string): Promise<string> {
    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedKey), (c) => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    // Get encryption key
    const cryptoKey = await this.getEncryptionKey();

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      cryptoKey,
      encryptedData
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  }

  /**
   * Get or generate encryption key
   */
  private async getEncryptionKey(): Promise<CryptoKey> {
    // In production, this should use a more secure key derivation
    // For now, we'll use a key based on the origin
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(`${window.location.origin}_eliza_key`),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('eliza_salt_v1'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}

// Export singleton instance
export const apiKeyManager = ApiKeyManager.getInstance();
