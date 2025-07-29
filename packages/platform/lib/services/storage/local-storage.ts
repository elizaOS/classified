/**
 * Local Storage Implementation
 * Simple file system storage for development that emulates R2
 */

import crypto from 'crypto';
import { promises as fs } from 'fs';
import mime from 'mime-types';
import path from 'path';
import {
  DownloadResult,
  FileInfo,
  FileMetadata,
  IStorageService,
  ListOptions,
  StorageConnectionError,
  StorageError,
  StorageInfo,
  StorageQuotaError,
  UploadOptions,
  UploadResult,
} from './interface';

interface LocalFileMetadata {
  originalMetadata?: Record<string, string>;
  contentType?: string;
  uploadedAt: string;
  size: number;
  etag: string;
}

export class LocalStorageService implements IStorageService {
  private rootPath: string;
  private baseUrl: string;
  private maxFileSize: number;

  constructor(
    rootPath: string,
    options: {
      baseUrl?: string;
      maxFileSize?: number;
    } = {},
  ) {
    this.rootPath = path.resolve(rootPath);
    this.baseUrl = options.baseUrl || '/storage';
    this.maxFileSize = options.maxFileSize || 100 * 1024 * 1024; // 100MB default

    this.ensureRootDirectory();
  }

  private async ensureRootDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.rootPath, { recursive: true });

      // Create metadata directory
      const metadataDir = path.join(this.rootPath, '.metadata');
      await fs.mkdir(metadataDir, { recursive: true });
    } catch (error) {
      throw new StorageConnectionError(
        'Failed to initialize local storage directory',
        error as Error,
      );
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key to prevent directory traversal
    const sanitizedKey = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.rootPath, sanitizedKey);
  }

  private getMetadataPath(key: string): string {
    const sanitizedKey = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.rootPath, '.metadata', `${sanitizedKey}.meta`);
  }

  private generateEtag(data: Buffer): string {
    return crypto.createHash('md5').update(data).digest('hex') as string;
  }

  async upload(
    key: string,
    data: Buffer | Uint8Array | string,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    try {
      const buffer = Buffer.isBuffer(data)
        ? data
        : data instanceof Uint8Array
          ? Buffer.from(data)
          : Buffer.from(data, 'utf8');

      if (buffer.length > this.maxFileSize) {
        throw new StorageQuotaError(
          `File size ${buffer.length} exceeds maximum ${this.maxFileSize}`,
        );
      }

      const filePath = this.getFilePath(key);
      const metadataPath = this.getMetadataPath(key);

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.mkdir(path.dirname(metadataPath), { recursive: true });

      // Generate etag
      const etag = this.generateEtag(buffer);

      // Determine content type
      const contentType =
        options?.contentType || mime.lookup(key) || 'application/octet-stream';

      // Save file
      await fs.writeFile(filePath, buffer);

      // Save metadata
      const metadata: LocalFileMetadata = {
        originalMetadata: options?.metadata,
        contentType,
        uploadedAt: new Date().toISOString(),
        size: buffer.length,
        etag,
      };

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      return {
        key,
        url: `${this.baseUrl}/${key}`,
        etag,
        size: buffer.length,
        contentType,
      };
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to upload file ${key}`, error as Error);
    }
  }

  async download(key: string): Promise<DownloadResult | null> {
    try {
      const filePath = this.getFilePath(key);
      const metadataPath = this.getMetadataPath(key);

      try {
        const data = await fs.readFile(filePath);
        let metadata: FileMetadata | undefined;

        try {
          const metaContent = await fs.readFile(metadataPath, 'utf8');
          const localMeta: LocalFileMetadata = JSON.parse(metaContent);

          metadata = {
            size: localMeta.size,
            contentType: localMeta.contentType,
            lastModified: new Date(localMeta.uploadedAt),
            etag: localMeta.etag,
            metadata: localMeta.originalMetadata,
          };
        } catch {
          // Fallback if metadata file doesn't exist
          const stats = await fs.stat(filePath);
          metadata = {
            size: stats.size,
            contentType: mime.lookup(key) || 'application/octet-stream',
            lastModified: stats.mtime,
          };
        }

        return { data, metadata };
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    } catch (error) {
      throw new StorageError(`Failed to download file ${key}`, error as Error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      const metadataPath = this.getMetadataPath(key);

      try {
        await fs.unlink(filePath);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      try {
        await fs.unlink(metadataPath);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      throw new StorageError(`Failed to delete file ${key}`, error as Error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<FileMetadata | null> {
    try {
      const result = await this.download(key);
      return result?.metadata || null;
    } catch {
      return null;
    }
  }

  async setMetadata(
    key: string,
    metadata: Record<string, string>,
  ): Promise<void> {
    try {
      const metadataPath = this.getMetadataPath(key);

      try {
        const existingContent = await fs.readFile(metadataPath, 'utf8');
        const existing: LocalFileMetadata = JSON.parse(existingContent);
        existing.originalMetadata = {
          ...existing.originalMetadata,
          ...metadata,
        };
        await fs.writeFile(metadataPath, JSON.stringify(existing, null, 2));
      } catch {
        // File doesn't exist, create basic metadata
        const filePath = this.getFilePath(key);
        const stats = await fs.stat(filePath);

        const newMetadata: LocalFileMetadata = {
          originalMetadata: metadata,
          contentType: mime.lookup(key) || 'application/octet-stream',
          uploadedAt: stats.mtime.toISOString(),
          size: stats.size,
          etag: this.generateEtag(await fs.readFile(filePath)),
        };

        await fs.mkdir(path.dirname(metadataPath), { recursive: true });
        await fs.writeFile(metadataPath, JSON.stringify(newMetadata, null, 2));
      }
    } catch (error) {
      throw new StorageError(
        `Failed to set metadata for ${key}`,
        error as Error,
      );
    }
  }

  async list(prefix?: string, options?: ListOptions): Promise<FileInfo[]> {
    try {
      const searchPath = prefix
        ? path.join(this.rootPath, prefix)
        : this.rootPath;
      const files: FileInfo[] = [];

      const traverse = async (
        dir: string,
        currentPrefix: string = '',
      ): Promise<void> => {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.name === '.metadata') {
              continue;
            }

            const fullPath = path.join(dir, entry.name);
            const relativePath = currentPrefix
              ? path.join(currentPrefix, entry.name)
              : entry.name;

            if (entry.isDirectory()) {
              if (options?.recursive !== false) {
                await traverse(fullPath, relativePath);
              }
            } else {
              const stats = await fs.stat(fullPath);

              files.push({
                key: relativePath.replace(/\\/g, '/'), // Normalize path separators
                size: stats.size,
                lastModified: stats.mtime,
                contentType:
                  mime.lookup(entry.name) || 'application/octet-stream',
              });
            }
          }
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      };

      await traverse(searchPath, prefix);

      // Apply options
      let result = files;

      if (options?.startAfter) {
        const startIndex = result.findIndex((f) => f.key > options.startAfter!);
        result = startIndex >= 0 ? result.slice(startIndex) : [];
      }

      if (options?.maxKeys) {
        result = result.slice(0, options.maxKeys);
      }

      return result.sort((a, b) => a.key.localeCompare(b.key));
    } catch (error) {
      throw new StorageError(
        `Failed to list files with prefix ${prefix}`,
        error as Error,
      );
    }
  }

  async deleteDirectory(prefix: string): Promise<void> {
    try {
      const dirPath = path.join(this.rootPath, prefix);
      await fs.rm(dirPath, { recursive: true, force: true });

      // Also clean up metadata
      const metadataDir = path.join(this.rootPath, '.metadata', prefix);
      await fs.rm(metadataDir, { recursive: true, force: true });
    } catch (error) {
      throw new StorageError(
        `Failed to delete directory ${prefix}`,
        error as Error,
      );
    }
  }

  async uploadMultiple(
    files: Array<{
      key: string;
      data: Buffer | Uint8Array | string;
      options?: UploadOptions;
    }>,
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const file of files) {
      const result = await this.upload(file.key, file.data, file.options);
      results.push(result);
    }

    return results;
  }

  async downloadMultiple(keys: string[]): Promise<(DownloadResult | null)[]> {
    const results: (DownloadResult | null)[] = [];

    for (const key of keys) {
      const result = await this.download(key);
      results.push(result);
    }

    return results;
  }

  async getSignedUrl(
    key: string,
    operation: 'read' | 'write',
    expiresIn?: number,
  ): Promise<string> {
    // For local storage, we can't really do signed URLs, so return the public URL
    // In a real implementation, you might generate a temporary token
    return this.getPublicUrl(key);
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  async ping(): Promise<boolean> {
    try {
      await fs.access(this.rootPath);
      return true;
    } catch {
      return false;
    }
  }

  async info(): Promise<StorageInfo> {
    try {
      const stats = await fs.stat(this.rootPath);
      return {
        type: 'local',
        connected: true,
        rootPath: this.rootPath,
      };
    } catch {
      return {
        type: 'local',
        connected: false,
        rootPath: this.rootPath,
      };
    }
  }

  async cleanup(): Promise<void> {
    // Optional: implement cleanup of old temp files or orphaned metadata
    console.log('[LocalStorage] Cleanup not implemented for local storage');
  }
}
