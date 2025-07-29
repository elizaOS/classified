/**
 * Platform Services
 * Service abstraction layer for cache, storage, and other infrastructure
 */

import type { IStorageService, StorageConfig } from './storage';
import { getStorage, resetStorage } from './storage';
// Simple in-memory cache for local development
interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

interface CacheConfig {
  type?: 'memory' | 'redis';
  redis?: {
    url?: string;
  };
  memory?: {
    maxSize?: number;
    ttl?: number;
  };
}

// Simple in-memory cache implementation
class MemoryCacheService implements ICacheService {
  private cache = new Map<string, { value: any; expires?: number }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expires = ttl ? Date.now() + ttl * 1000 : undefined;
    this.cache.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const item = await this.get(key);
    return item !== null;
  }
}

let cacheInstance: ICacheService | null = null;

async function getCache(config?: CacheConfig): Promise<ICacheService> {
  if (cacheInstance) return cacheInstance;
  
  // Always use memory cache for now (Redis optional)
  console.log('[Cache] Using in-memory cache for local development');
  cacheInstance = new MemoryCacheService();
  return cacheInstance;
}

async function resetCache(): Promise<void> {
  if (cacheInstance) {
    await cacheInstance.clear();
    cacheInstance = null;
  }
}

export async function initializeServices(config?: {
  cache?: CacheConfig;
  storage?: StorageConfig;
}): Promise<{
  cache: ICacheService;
  storage: IStorageService;
}> {
  const [cache, storage] = await Promise.all([
    getCache(config?.cache),
    getStorage(config?.storage),
  ]);

  return { cache, storage };
}

// Function to reset all services
export async function resetAllServices(): Promise<void> {
  await Promise.all([resetCache(), resetStorage()]);
}

// Export types and functions
export type { IStorageService, StorageConfig } from './storage';
export { getStorage } from './storage';
export type { ICacheService, CacheConfig };
export { getCache, resetCache };
