import { PGlite, type PGliteOptions } from '@electric-sql/pglite';
import { fuzzystrmatch } from '@electric-sql/pglite/contrib/fuzzystrmatch';
import { vector } from '@electric-sql/pglite/vector';
import type { IDatabaseClientManager } from '../types';

/**
 * Class representing a database client manager for PGlite.
 * @implements { IDatabaseClientManager }
 */
export class PGliteClientManager implements IDatabaseClientManager<PGlite> {
  private client: PGlite | null = null;
  private clientPromise: Promise<PGlite> | null = null;
  private shuttingDown = false;
  private options: PGliteOptions;

  /**
   * Constructor for creating a new instance of PGlite with the provided options.
   * Initializes the PGlite client with additional extensions.
   * @param {PGliteOptions} options - The options to configure the PGlite client.
   */
  constructor(options: PGliteOptions) {
    this.options = {
      ...options,
      extensions: {
        vector,
        fuzzystrmatch,
      },
    };
    this.setupShutdownHandlers();
  }

  private async ensureClient(): Promise<PGlite> {
    if (this.client) {
      return this.client;
    }
    
    if (!this.clientPromise) {
      this.clientPromise = this.createClient();
    }
    
    this.client = await this.clientPromise;
    return this.client;
  }

  private async createClient(): Promise<PGlite> {
    const client = new PGlite(this.options);
    // Wait for PGLite to be ready
    await client.ready;
    return client;
  }

  public getConnection(): PGlite {
    if (!this.client) {
      throw new Error('PGLiteClientManager not initialized. Call initialize() first.');
    }
    return this.client;
  }

  public isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  public async initialize(): Promise<void> {
    // Ensure client is created and ready
    await this.ensureClient();
  }

  public async close(): Promise<void> {
    this.shuttingDown = true;
    if (this.client) {
      await this.client.close();
    }
  }

  private setupShutdownHandlers() {
    // Implementation of setupShutdownHandlers method
  }
}
