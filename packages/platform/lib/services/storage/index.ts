/**
 * Storage Services
 * Unified file storage abstraction layer
 */

import { getStorage } from './storage-manager';

// Core interfaces and types - direct exports to avoid module resolution issues
export interface IStorageService {
  upload(
    key: string,
    data: Buffer | Uint8Array | string,
    options?: UploadOptions,
  ): Promise<UploadResult>;
  download(key: string): Promise<DownloadResult | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<FileMetadata | null>;
  setMetadata(key: string, metadata: Record<string, string>): Promise<void>;
  list(prefix?: string, options?: ListOptions): Promise<FileInfo[]>;
  deleteDirectory(prefix: string): Promise<void>;
  uploadMultiple(
    files: Array<{
      key: string;
      data: Buffer | Uint8Array | string;
      options?: UploadOptions;
    }>,
  ): Promise<UploadResult[]>;
  downloadMultiple(keys: string[]): Promise<(DownloadResult | null)[]>;
  getSignedUrl(
    key: string,
    operation: 'read' | 'write',
    expiresIn?: number,
  ): Promise<string>;
  getPublicUrl(key: string): string;
  ping(): Promise<boolean>;
  info(): Promise<StorageInfo>;
  cleanup?(): Promise<void>;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
  expires?: Date;
  acl?: 'private' | 'public-read';
}

export interface UploadResult {
  key: string;
  url?: string;
  etag?: string;
  size: number;
  contentType?: string;
}

export interface DownloadResult {
  data: Buffer;
  metadata?: FileMetadata;
}

export interface FileMetadata {
  size: number;
  contentType?: string;
  lastModified: Date;
  etag?: string;
  metadata?: Record<string, string>;
}

export interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  etag?: string;
}

export interface ListOptions {
  maxKeys?: number;
  startAfter?: string;
  recursive?: boolean;
}

export interface StorageInfo {
  type: 'r2' | 'local';
  connected: boolean;
  endpoint?: string;
  bucket?: string;
  rootPath?: string;
}

export interface StorageConfig {
  type: 'r2' | 'local';
  r2?: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    endpoint?: string;
    region?: string;
  };
  local?: {
    rootPath: string;
    baseUrl?: string;
    maxFileSize?: number;
  };
}

// Error classes
export {
  StorageError,
  StorageConnectionError,
  StorageNotFoundError,
  StorageQuotaError,
} from './interface';

// Storage implementations
export { LocalStorageService } from './local-storage';
export { R2StorageService } from './r2-storage';

// Storage manager and convenience functions
export {
  getStorage,
  getStorageConfig,
  isLocalStorage,
  isR2Storage,
  resetStorage,
  StorageManager,
} from './storage-manager';

// Storage manager factory function
export function getStorageManager() {
  return getStorage();
}

// Default export
export { default } from './storage-manager';
