/**
 * Storage Service Interface
 * Unified interface for file storage operations (R2 cloud / local development)
 */

export interface IStorageService {
  // Basic file operations
  upload(
    key: string,
    data: Buffer | Uint8Array | string,
    options?: UploadOptions,
  ): Promise<UploadResult>;
  download(key: string): Promise<DownloadResult | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  // File metadata
  getMetadata(key: string): Promise<FileMetadata | null>;
  setMetadata(key: string, metadata: Record<string, string>): Promise<void>;

  // Directory operations
  list(prefix?: string, options?: ListOptions): Promise<FileInfo[]>;
  deleteDirectory(prefix: string): Promise<void>;

  // Batch operations
  uploadMultiple(
    files: Array<{
      key: string;
      data: Buffer | Uint8Array | string;
      options?: UploadOptions;
    }>,
  ): Promise<UploadResult[]>;
  downloadMultiple(keys: string[]): Promise<(DownloadResult | null)[]>;

  // URL generation
  getSignedUrl(
    key: string,
    operation: 'read' | 'write',
    expiresIn?: number,
  ): Promise<string>;
  getPublicUrl(key: string): string;

  // Service management
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

// Custom error classes
export class StorageError extends Error {
  public cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

export class StorageConnectionError extends StorageError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'StorageConnectionError';
  }
}

export class StorageNotFoundError extends StorageError {
  constructor(key: string) {
    super(`File not found: ${key}`);
    this.name = 'StorageNotFoundError';
  }
}

export class StorageQuotaError extends StorageError {
  constructor(message: string) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}
