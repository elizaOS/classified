/**
 * Storage Service Manager
 * Automatically chooses between R2 (production) and Local Storage (development)
 */

import path from 'path';
import {
  IStorageService,
  StorageConfig,
  StorageConnectionError,
} from './interface';
import { LocalStorageService } from './local-storage';
import { R2StorageService } from './r2-storage';

class StorageManager {
  private static instance: IStorageService | null = null;
  private static config: StorageConfig | null = null;

  static async getInstance(config?: StorageConfig): Promise<IStorageService> {
    if (this.instance && this.config) {
      return this.instance;
    }

    // Auto-detect configuration if not provided
    const finalConfig = config || this.autoDetectConfig();
    this.config = finalConfig;

    try {
      if (finalConfig.type === 'r2') {
        const r2Config = finalConfig.r2!;
        const r2Service = new R2StorageService(
          r2Config.accountId,
          r2Config.accessKeyId,
          r2Config.secretAccessKey,
          r2Config.bucketName,
          {
            endpoint: r2Config.endpoint,
            region: r2Config.region,
          },
        );

        // Test connection
        const isConnected = await r2Service.ping();

        if (!isConnected) {
          throw new Error('R2 storage connection failed');
        }

        this.instance = r2Service;
        console.log('[StorageManager] Using R2 storage service');
      } else {
        const storagePath =
          finalConfig.local?.rootPath ||
          path.join(process.cwd(), 'data', 'storage');

        // Ensure storage directory exists
        const { mkdirSync } = require('fs');
        mkdirSync(storagePath, { recursive: true });

        this.instance = new LocalStorageService(storagePath, {
          baseUrl: finalConfig.local?.baseUrl,
          maxFileSize: finalConfig.local?.maxFileSize,
        });

        // Test connection
        const isConnected = await this.instance.ping();
        if (!isConnected) {
          throw new Error('Local storage initialization failed');
        }

        console.log('[StorageManager] Using local storage service');
      }

      return this.instance;
    } catch (error) {
      console.error(
        '[StorageManager] Failed to initialize storage service:',
        error,
      );

      // Fallback to local storage if R2 fails
      if (finalConfig.type === 'r2') {
        console.log('[StorageManager] Falling back to local storage');
        return this.initializeFallbackStorage();
      }

      throw new StorageConnectionError(
        'Failed to initialize storage service',
        error as Error,
      );
    }
  }

  private static autoDetectConfig(): StorageConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const hasR2Config = !!(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
    );

    if (isProduction && hasR2Config) {
      return {
        type: 'r2',
        r2: {
          accountId: process.env.R2_ACCOUNT_ID!,
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
          bucketName: process.env.R2_BUCKET_NAME!,
          endpoint: process.env.R2_ENDPOINT,
          region: process.env.R2_REGION || 'auto',
        },
      };
    }

    return {
      type: 'local',
      local: {
        rootPath:
          process.env.STORAGE_PATH ||
          path.join(process.cwd(), 'data', 'storage'),
        baseUrl: process.env.STORAGE_BASE_URL || '/storage',
        maxFileSize: process.env.STORAGE_MAX_FILE_SIZE
          ? parseInt(process.env.STORAGE_MAX_FILE_SIZE, 10)
          : 100 * 1024 * 1024,
      },
    };
  }

  private static async initializeFallbackStorage(): Promise<IStorageService> {
    const fallbackConfig: StorageConfig = {
      type: 'local',
      local: {
        rootPath: path.join(process.cwd(), 'data', 'storage-fallback'),
        baseUrl: '/storage',
        maxFileSize: 100 * 1024 * 1024,
      },
    };

    const storagePath = fallbackConfig.local!.rootPath;

    // Ensure storage directory exists
    const { mkdirSync } = require('fs');
    mkdirSync(storagePath, { recursive: true });

    this.instance = new LocalStorageService(storagePath, {
      baseUrl: fallbackConfig.local!.baseUrl,
      maxFileSize: fallbackConfig.local!.maxFileSize,
    });
    this.config = fallbackConfig;

    return this.instance;
  }

  static async reset(): Promise<void> {
    if (this.instance) {
      try {
        if (
          'cleanup' in this.instance &&
          typeof this.instance.cleanup === 'function'
        ) {
          await this.instance.cleanup();
        }
      } catch (error) {
        console.error(
          '[StorageManager] Error cleaning up storage service:',
          error,
        );
      }
    }

    this.instance = null;
    this.config = null;
  }

  static getConfig(): StorageConfig | null {
    return this.config;
  }

  static isR2(): boolean {
    return this.config?.type === 'r2';
  }

  static isLocal(): boolean {
    return this.config?.type === 'local';
  }
}

// Convenience functions for direct access
export async function getStorage(
  config?: StorageConfig,
): Promise<IStorageService> {
  return StorageManager.getInstance(config);
}

export async function resetStorage(): Promise<void> {
  return StorageManager.reset();
}

export function getStorageConfig(): StorageConfig | null {
  return StorageManager.getConfig();
}

export function isR2Storage(): boolean {
  return StorageManager.isR2();
}

export function isLocalStorage(): boolean {
  return StorageManager.isLocal();
}

// Export the manager for advanced usage
export { StorageManager };

// Default export for simple usage
export default StorageManager;
