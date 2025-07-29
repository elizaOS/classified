/**
 * Cloudflare R2 Storage Implementation
 * Production-ready object storage using Cloudflare R2 (S3-compatible)
 */

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  DownloadResult,
  FileInfo,
  FileMetadata,
  IStorageService,
  ListOptions,
  StorageConnectionError,
  StorageError,
  StorageInfo,
  UploadOptions,
  UploadResult,
} from './interface';

export class R2StorageService implements IStorageService {
  private client: S3Client;
  private bucketName: string;
  private endpoint: string;

  constructor(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucketName: string,
    options: {
      endpoint?: string;
      region?: string;
    } = {},
  ) {
    this.bucketName = bucketName;
    this.endpoint =
      options.endpoint || `https://${accountId}.r2.cloudflarestorage.com`;

    try {
      this.client = new S3Client({
        region: options.region || 'auto',
        endpoint: this.endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: true,
      });
    } catch (error) {
      throw new StorageConnectionError(
        'Failed to initialize R2 storage client',
        error as Error,
      );
    }
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

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
        CacheControl: options?.cacheControl,
        Expires: options?.expires,
        ACL: options?.acl === 'public-read' ? 'public-read' : 'private',
      });

      const response = await this.client.send(command);

      return {
        key,
        url: `${this.endpoint}/${this.bucketName}/${key}`,
        etag: response.ETag?.replace(/"/g, ''),
        size: buffer.length,
        contentType: options?.contentType,
      };
    } catch (error) {
      throw new StorageError(`Failed to upload file ${key}`, error as Error);
    }
  }

  async download(key: string): Promise<DownloadResult | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        return null;
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const data = Buffer.concat(chunks);

      const metadata: FileMetadata = {
        size: response.ContentLength || data.length,
        contentType: response.ContentType,
        lastModified: response.LastModified || new Date(),
        etag: response.ETag?.replace(/"/g, ''),
        metadata: response.Metadata,
      };

      return { data, metadata };
    } catch (error: any) {
      if (
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw new StorageError(`Failed to download file ${key}`, error as Error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
    } catch (error: any) {
      if (
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        // File doesn't exist, which is fine for delete
        return;
      }
      throw new StorageError(`Failed to delete file ${key}`, error as Error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw new StorageError(
        `Failed to check existence of ${key}`,
        error as Error,
      );
    }
  }

  async getMetadata(key: string): Promise<FileMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType,
        lastModified: response.LastModified || new Date(),
        etag: response.ETag?.replace(/"/g, ''),
        metadata: response.Metadata,
      };
    } catch (error: any) {
      if (
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw new StorageError(
        `Failed to get metadata for ${key}`,
        error as Error,
      );
    }
  }

  async setMetadata(
    key: string,
    metadata: Record<string, string>,
  ): Promise<void> {
    try {
      // R2/S3 doesn't support modifying metadata without copying the object
      // This is a limitation of the S3 API
      throw new StorageError(
        'Setting metadata on existing objects is not supported by R2/S3',
      );
    } catch (error) {
      throw new StorageError(
        `Failed to set metadata for ${key}`,
        error as Error,
      );
    }
  }

  async list(prefix?: string, options?: ListOptions): Promise<FileInfo[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: options?.maxKeys,
        StartAfter: options?.startAfter,
        Delimiter: options?.recursive === false ? '/' : undefined,
      });

      const response = await this.client.send(command);

      if (!response.Contents) {
        return [];
      }

      return response.Contents.map((obj) => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        etag: obj.ETag?.replace(/"/g, ''),
      }));
    } catch (error) {
      throw new StorageError(
        `Failed to list objects with prefix ${prefix}`,
        error as Error,
      );
    }
  }

  async deleteDirectory(prefix: string): Promise<void> {
    try {
      // List all objects with the prefix
      const objects = await this.list(prefix, { recursive: true });

      if (objects.length === 0) {
        return;
      }

      // R2/S3 supports batch delete of up to 1000 objects
      const batchSize = 1000;

      for (let i = 0; i < objects.length; i += batchSize) {
        const batch = objects.slice(i, i + batchSize);

        const command = new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: {
            Objects: batch.map((obj) => ({ Key: obj.key })),
          },
        });

        await this.client.send(command);
      }
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
    // R2/S3 doesn't have native batch upload, so we'll do them in parallel
    const uploadPromises = files.map((file) =>
      this.upload(file.key, file.data, file.options),
    );

    return Promise.all(uploadPromises);
  }

  async downloadMultiple(keys: string[]): Promise<(DownloadResult | null)[]> {
    // Download files in parallel
    const downloadPromises = keys.map((key) => this.download(key));
    return Promise.all(downloadPromises);
  }

  async getSignedUrl(
    key: string,
    operation: 'read' | 'write',
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      let command;

      if (operation === 'read') {
        command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        });
      } else {
        command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        });
      }

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      throw new StorageError(
        `Failed to generate signed URL for ${key}`,
        error as Error,
      );
    }
  }

  getPublicUrl(key: string): string {
    return `${this.endpoint}/${this.bucketName}/${key}`;
  }

  async ping(): Promise<boolean> {
    try {
      // Try to list objects to test connection
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      });

      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async info(): Promise<StorageInfo> {
    try {
      const isConnected = await this.ping();

      return {
        type: 'r2',
        connected: isConnected,
        endpoint: this.endpoint,
        bucket: this.bucketName,
      };
    } catch {
      return {
        type: 'r2',
        connected: false,
        endpoint: this.endpoint,
        bucket: this.bucketName,
      };
    }
  }

  async cleanup(): Promise<void> {
    // R2 handles cleanup automatically, no manual cleanup needed
    console.log(
      '[R2Storage] Cleanup not needed - R2 handles lifecycle automatically',
    );
  }
}
