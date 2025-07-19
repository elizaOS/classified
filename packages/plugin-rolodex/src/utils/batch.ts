import { logger } from '@elizaos/core';

interface BatchItem {
  type: string;
  data: any;
  processAt?: number;
  retries?: number;
}

interface BatchQueueOptions {
  batchSize: number;
  interval: number; // milliseconds
  processor: (items: BatchItem[]) => Promise<void>;
  maxRetries?: number;
}

export class BatchQueue {
  private queue: BatchItem[] = [];
  private processing = false;
  private timer: NodeJS.Timeout | null = null;
  private options: BatchQueueOptions;
  private started = false;

  constructor(options: BatchQueueOptions) {
    this.options = {
      maxRetries: 3,
      ...options,
    };
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    this.scheduleProcessing();
    logger.info('[BatchQueue] Started with interval:', this.options.interval);
  }

  async stop(): Promise<void> {
    this.started = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Process remaining items
    if (this.queue.length > 0) {
      await this.processQueue();
    }

    logger.info('[BatchQueue] Stopped');
  }

  async add(item: BatchItem): Promise<void> {
    // Add to queue
    this.queue.push({
      ...item,
      retries: item.retries || 0,
    });

    // If queue is getting full, process immediately
    if (this.queue.length >= this.options.batchSize * 2) {
      await this.processQueue();
    }
  }

  async addBatch(items: BatchItem[]): Promise<void> {
    for (const item of items) {
      await this.add(item);
    }
  }

  private scheduleProcessing(): void {
    if (!this.started || this.timer) {
      return;
    }

    this.timer = setTimeout(async () => {
      this.timer = null;

      if (this.started) {
        await this.processQueue();
        this.scheduleProcessing();
      }
    }, this.options.interval);
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Separate items that should be processed now
      const now = Date.now();
      const readyItems: BatchItem[] = [];
      const deferredItems: BatchItem[] = [];

      for (const item of this.queue) {
        if (!item.processAt || item.processAt <= now) {
          readyItems.push(item);
        } else {
          deferredItems.push(item);
        }
      }

      // Keep deferred items in queue
      this.queue = deferredItems;

      // Process ready items in batches
      while (readyItems.length > 0) {
        const batch = readyItems.splice(0, this.options.batchSize);

        try {
          await this.options.processor(batch);
        } catch (error) {
          logger.error('[BatchQueue] Batch processing error:', error);

          // Retry failed items
          const retryItems = batch
            .filter((item) => (item.retries || 0) < this.options.maxRetries!)
            .map((item) => ({
              ...item,
              retries: (item.retries || 0) + 1,
              processAt: Date.now() + Math.pow(2, item.retries || 0) * 1000, // Exponential backoff
            }));

          if (retryItems.length > 0) {
            this.queue.push(...retryItems);
            logger.info(`[BatchQueue] Retrying ${retryItems.length} items`);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  // Get queue stats
  getStats(): {
    queueLength: number;
    processing: boolean;
    started: boolean;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      started: this.started,
    };
  }

  // Priority queue functionality
  async addPriority(item: BatchItem): Promise<void> {
    // Add to front of queue
    this.queue.unshift({
      ...item,
      retries: item.retries || 0,
    });

    // Process immediately if high priority
    if (!this.processing) {
      await this.processQueue();
    }
  }

  // Clear queue
  clear(): void {
    this.queue = [];
  }

  // Get items by type
  getItemsByType(type: string): BatchItem[] {
    return this.queue.filter((item) => item.type === type);
  }

  // Remove items by predicate
  removeItems(predicate: (item: BatchItem) => boolean): number {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter((item) => !predicate(item));
    return initialLength - this.queue.length;
  }
}
