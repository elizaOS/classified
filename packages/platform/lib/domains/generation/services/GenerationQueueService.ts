/**
 * Production Generation Queue Management System
 * Replaces setImmediate with proper queue implementation using database-backed queues
 */

import { getDatabaseClient } from '@/lib/database';
import {
  generations,
  generationQueue,
  providerMetrics,
  NewGenerationQueueItem,
  Generation,
} from '@/lib/database/schema';
import { eq, and, desc, asc, sql, lt } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { AuthContext } from '@/lib/auth/context';
import { EventEmitter } from 'events';

type DatabaseClient = ReturnType<typeof getDatabaseClient>;

interface QueueConfig {
  maxConcurrentJobs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  processingTimeoutMs?: number;
  pollIntervalMs?: number;
  deadLetterQueueEnabled?: boolean;
  priorityLevels?: number;
}

interface QueueWorker {
  id: string;
  queueNames: string[];
  concurrency: number;
  isActive: boolean;
  lastHeartbeat: Date;
  currentJobs: Set<string>;
  processor: (job: QueueJob) => Promise<QueueJobResult>;
}

interface QueueJob {
  id: string;
  queueName: string;
  generationId: string;
  priority: number;
  data: Record<string, any>;
  attempts: number;
  maxAttempts: number;
  scheduledFor: Date;
  createdAt: Date;
}

interface QueueJobResult {
  success: boolean;
  data?: any;
  error?: string;
  retry?: boolean;
  retryAfter?: number; // milliseconds
}

export enum QueueEvents {
  JOB_COMPLETED = 'job:completed',
  JOB_FAILED = 'job:failed',
  JOB_RETRYING = 'job:retrying',
  WORKER_STARTED = 'worker:started',
  WORKER_STOPPED = 'worker:stopped',
  QUEUE_DRAINED = 'queue:drained',
}

export class GenerationQueueService extends EventEmitter {
  private config: Required<QueueConfig>;
  private workers = new Map<string, QueueWorker>();
  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;

  // Queue statistics
  private stats = {
    jobsProcessed: 0,
    jobsFailed: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
  };

  constructor(config: QueueConfig) {
    super();
    this.config = {
      ...config,
      maxConcurrentJobs: config.maxConcurrentJobs || 10,
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 5000,
      processingTimeoutMs: config.processingTimeoutMs || 300000, // 5 minutes
      pollIntervalMs: config.pollIntervalMs || 5000,
      deadLetterQueueEnabled: config.deadLetterQueueEnabled !== false,
      priorityLevels: config.priorityLevels || 10,
    };
  }

  /**
   * Start the queue service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Queue service is already running');
      return;
    }

    this.isRunning = true;

    // Start polling for jobs
    this.startPolling();

    // Start heartbeat for worker health monitoring
    this.startHeartbeat();

    // Start metrics collection
    this.startMetricsCollection();

    logger.info('Generation queue service started', {
      maxConcurrentJobs: this.config.maxConcurrentJobs,
      pollIntervalMs: this.config.pollIntervalMs,
      workers: this.workers.size,
    });
  }

  /**
   * Stop the queue service gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping generation queue service...');
    this.isRunning = false;

    // Clear timers
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    // Wait for active jobs to complete (with timeout)
    await this.waitForJobsToComplete(30000); // 30 seconds timeout

    // Stop all workers
    for (const worker of this.workers.values()) {
      worker.isActive = false;
    }

    logger.info('Generation queue service stopped');
  }

  /**
   * Add a generation job to the queue
   */
  async addJob(
    generationId: string,
    queueName: string,
    priority: number = 0,
    scheduledFor?: Date,
    data: Record<string, any> = {},
  ): Promise<string> {
    try {
      const queueItem: NewGenerationQueueItem = {
        generationId,
        queueName,
        priority,
        scheduledFor: scheduledFor || new Date(),
        status: 'pending',
        attempts: 0,
        maxAttempts: this.config.maxRetries,
        metadata: data,
      };

      const db = await getDatabaseClient();
      const result = await db
        .insert(generationQueue)
        .values(queueItem)
        .returning();

      const jobId = result[0].id;

      logger.info('Job added to queue', {
        jobId,
        generationId,
        queueName,
        priority,
        scheduledFor: queueItem.scheduledFor,
      });

      return jobId;
    } catch (error) {
      logger.error(
        'Failed to add job to queue',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Register a worker for processing jobs
   */
  registerWorker(
    workerId: string,
    queueNames: string[],
    processor: (job: QueueJob) => Promise<QueueJobResult>,
    concurrency: number = 1,
  ): void {
    const worker: QueueWorker = {
      id: workerId,
      queueNames,
      concurrency,
      isActive: true,
      lastHeartbeat: new Date(),
      currentJobs: new Set(),
      processor,
    };

    this.workers.set(workerId, worker);

    logger.info('Worker registered', {
      workerId,
      queueNames,
      concurrency,
      totalWorkers: this.workers.size,
    });

    this.emit(QueueEvents.WORKER_STARTED, { workerId, queueNames });
  }

  /**
   * Unregister a worker
   */
  async unregisterWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return;
    }

    worker.isActive = false;

    // Wait for current jobs to complete
    if (worker.currentJobs.size > 0) {
      logger.info(
        `Waiting for ${worker.currentJobs.size} jobs to complete for worker ${workerId}`,
      );
      await this.waitForWorkerJobs(workerId, 30000);
    }

    this.workers.delete(workerId);

    logger.info('Worker unregistered', { workerId });
    this.emit(QueueEvents.WORKER_STOPPED, { workerId });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    workers: number;
    activeJobs: number;
  }> {
    try {
      const db = await getDatabaseClient();
      const [pendingResult, processingResult, completedResult, failedResult] =
        await Promise.all([
          db
            .select({ count: sql<number>`count(*)` })
            .from(generationQueue)
            .where(eq(generationQueue.status, 'pending')),
          db
            .select({ count: sql<number>`count(*)` })
            .from(generationQueue)
            .where(eq(generationQueue.status, 'processing')),
          db
            .select({ count: sql<number>`count(*)` })
            .from(generationQueue)
            .where(eq(generationQueue.status, 'completed')),
          db
            .select({ count: sql<number>`count(*)` })
            .from(generationQueue)
            .where(eq(generationQueue.status, 'failed')),
        ]);

      const activeJobs = Array.from(this.workers.values()).reduce(
        (total, worker) => total + worker.currentJobs.size,
        0,
      );

      return {
        pending: pendingResult[0]?.count || 0,
        processing: processingResult[0]?.count || 0,
        completed: completedResult[0]?.count || 0,
        failed: failedResult[0]?.count || 0,
        workers: this.workers.size,
        activeJobs,
      };
    } catch (error) {
      logger.error(
        'Failed to get queue stats',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get job details
   */
  async getJob(jobId: string): Promise<QueueJob | null> {
    try {
      const db = await getDatabaseClient();
      const result = await db
        .select()
        .from(generationQueue)
        .where(eq(generationQueue.id, jobId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const item = result[0];
      return {
        id: item.id,
        queueName: item.queueName,
        generationId: item.generationId,
        priority: item.priority,
        data: item.metadata as Record<string, any>,
        attempts: item.attempts,
        maxAttempts: item.maxAttempts,
        scheduledFor: item.scheduledFor,
        createdAt: item.createdAt,
      };
    } catch (error) {
      logger.error(
        'Failed to get job',
        error instanceof Error ? error : new Error(String(error)),
      );
      return null;
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const db = await getDatabaseClient();
      const result = await db
        .update(generationQueue)
        .set({ status: 'failed', lastError: 'Job cancelled by user' })
        .where(
          and(
            eq(generationQueue.id, jobId),
            eq(generationQueue.status, 'pending'),
          ),
        );

      if (result) {
        logger.info('Job cancelled', { jobId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error(
        'Failed to cancel job',
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const db = await getDatabaseClient();
      const result = await db
        .update(generationQueue)
        .set({
          status: 'pending',
          attempts: 0,
          lastError: null,
          scheduledFor: new Date(),
        })
        .where(eq(generationQueue.id, jobId));

      if (result) {
        logger.info('Job scheduled for retry', { jobId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error(
        'Failed to retry job',
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Start polling for jobs
   */
  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      try {
        await this.processAvailableJobs();
      } catch (error) {
        logger.error(
          'Error during job polling',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }, this.config.pollIntervalMs);
  }

  /**
   * Process available jobs
   */
  private async processAvailableJobs(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    for (const worker of this.workers.values()) {
      if (!worker.isActive || worker.currentJobs.size >= worker.concurrency) {
        continue;
      }

      const availableSlots = worker.concurrency - worker.currentJobs.size;
      const jobs = await this.getAvailableJobs(
        worker.queueNames,
        availableSlots,
      );

      for (const job of jobs) {
        if (worker.currentJobs.size >= worker.concurrency) {
          break;
        }

        await this.processJob(worker, job);
      }
    }
  }

  /**
   * Get available jobs for processing
   */
  private async getAvailableJobs(
    queueNames: string[],
    limit: number,
  ): Promise<QueueJob[]> {
    try {
      const db = await getDatabaseClient();
      const result = await db
        .select()
        .from(generationQueue)
        .where(
          and(
            sql`${generationQueue.queueName} = ANY(${queueNames})`,
            eq(generationQueue.status, 'pending'),
            lt(generationQueue.scheduledFor, new Date()),
          ),
        )
        .orderBy(
          desc(generationQueue.priority),
          asc(generationQueue.scheduledFor),
        )
        .limit(limit);

      return result.map((item: any) => ({
        id: item.id,
        queueName: item.queueName,
        generationId: item.generationId,
        priority: item.priority,
        data: item.metadata as Record<string, any>,
        attempts: item.attempts,
        maxAttempts: item.maxAttempts,
        scheduledFor: item.scheduledFor,
        createdAt: item.createdAt,
      }));
    } catch (error) {
      logger.error(
        'Failed to get available jobs',
        error instanceof Error ? error : new Error(String(error)),
      );
      return [];
    }
  }

  /**
   * Process a single job
   */
  private async processJob(worker: QueueWorker, job: QueueJob): Promise<void> {
    const startTime = Date.now();

    try {
      // Claim the job
      const claimed = await this.claimJob(job.id, worker.id);
      if (!claimed) {
        return; // Job was claimed by another worker
      }

      worker.currentJobs.add(job.id);

      logger.info('Processing job', {
        jobId: job.id,
        workerId: worker.id,
        generationId: job.generationId,
        queueName: job.queueName,
        attempt: job.attempts + 1,
      });

      // Set up timeout
      const timeoutId = setTimeout(async () => {
        logger.warn('Job timed out', { jobId: job.id, workerId: worker.id });
        await this.handleJobTimeout(job.id);
      }, this.config.processingTimeoutMs);

      try {
        // Process the job
        const result = await worker.processor(job);
        clearTimeout(timeoutId);

        if (result.success) {
          await this.completeJob(job.id, result.data);
          this.stats.jobsProcessed++;

          logger.info('Job completed successfully', {
            jobId: job.id,
            workerId: worker.id,
            processingTime: Date.now() - startTime,
          });

          this.emit(QueueEvents.JOB_COMPLETED, {
            job,
            result,
            processingTime: Date.now() - startTime,
          });
        } else {
          await this.handleJobFailure(
            job,
            result.error || 'Unknown error',
            result.retry,
            result.retryAfter,
          );
        }
      } catch (error) {
        clearTimeout(timeoutId);
        await this.handleJobFailure(
          job,
          error instanceof Error ? error.message : String(error),
          true,
        );
      }
    } catch (error) {
      logger.error(
        'Error processing job',
        error instanceof Error ? error : new Error(String(error)),
        { jobId: job.id },
      );
    } finally {
      worker.currentJobs.delete(job.id);

      // Update processing time statistics
      const processingTime = Date.now() - startTime;
      this.stats.totalProcessingTime += processingTime;
      this.stats.averageProcessingTime =
        this.stats.totalProcessingTime /
        (this.stats.jobsProcessed + this.stats.jobsFailed);
    }
  }

  /**
   * Claim a job for processing
   */
  private async claimJob(jobId: string, workerId: string): Promise<boolean> {
    try {
      const db = await getDatabaseClient();
      const result = await db
        .update(generationQueue)
        .set({
          status: 'processing',
          workerId,
          claimedAt: new Date(),
          attempts: sql`${generationQueue.attempts} + 1`,
          lastAttemptAt: new Date(),
        })
        .where(
          and(
            eq(generationQueue.id, jobId),
            eq(generationQueue.status, 'pending'),
          ),
        );

      return !!result;
    } catch (error) {
      logger.error(
        'Failed to claim job',
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Complete a job successfully
   */
  private async completeJob(jobId: string, data?: any): Promise<void> {
    try {
      const db = await getDatabaseClient();
      await db
        .update(generationQueue)
        .set({
          status: 'completed',
          metadata: data ? { result: data } : undefined,
        })
        .where(eq(generationQueue.id, jobId));
    } catch (error) {
      logger.error(
        'Failed to complete job',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Handle job failure
   */
  private async handleJobFailure(
    job: QueueJob,
    error: string,
    shouldRetry: boolean = true,
    retryAfter?: number,
  ): Promise<void> {
    try {
      this.stats.jobsFailed++;

      if (shouldRetry && job.attempts < job.maxAttempts) {
        // Schedule retry
        const retryDelay = retryAfter || this.calculateRetryDelay(job.attempts);
        const scheduledFor = new Date(Date.now() + retryDelay);

        const db = await getDatabaseClient();
        await db
          .update(generationQueue)
          .set({
            status: 'pending',
            lastError: error,
            scheduledFor,
            workerId: null,
            claimedAt: null,
          })
          .where(eq(generationQueue.id, job.id));

        logger.info('Job scheduled for retry', {
          jobId: job.id,
          attempt: job.attempts + 1,
          maxAttempts: job.maxAttempts,
          retryAfter: retryDelay,
          error,
        });

        this.emit(QueueEvents.JOB_RETRYING, {
          job,
          error,
          retryAfter: retryDelay,
        });
      } else {
        // Mark as permanently failed
        const db = await getDatabaseClient();
        await db
          .update(generationQueue)
          .set({
            status: 'failed',
            lastError: error,
          })
          .where(eq(generationQueue.id, job.id));

        logger.error('Job failed permanently', new Error(error), {
          jobId: job.id,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
        });

        this.emit(QueueEvents.JOB_FAILED, { job, error });

        // Move to dead letter queue if enabled
        if (this.config.deadLetterQueueEnabled) {
          await this.moveToDeadLetterQueue(job, error);
        }
      }
    } catch (dbError) {
      logger.error(
        'Failed to handle job failure',
        dbError instanceof Error ? dbError : new Error(String(dbError)),
      );
    }
  }

  /**
   * Handle job timeout
   */
  private async handleJobTimeout(jobId: string): Promise<void> {
    const db = await getDatabaseClient();
    await db
      .update(generationQueue)
      .set({
        status: 'pending',
        lastError: 'Job timed out',
        workerId: null,
        claimedAt: null,
      })
      .where(eq(generationQueue.id, jobId));
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelayMs;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), 300000); // Max 5 minutes
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    return exponentialDelay + jitter;
  }

  /**
   * Move failed job to dead letter queue
   */
  private async moveToDeadLetterQueue(
    job: QueueJob,
    error: string,
  ): Promise<void> {
    // Implementation would depend on your dead letter queue strategy
    logger.info('Moving job to dead letter queue', { jobId: job.id, error });
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const worker of this.workers.values()) {
        worker.lastHeartbeat = new Date();
      }
    }, 30000); // 30 seconds
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error(
          'Error collecting metrics',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }, 60000); // 1 minute
  }

  /**
   * Collect and store queue metrics
   */
  private async collectMetrics(): Promise<void> {
    const stats = await this.getQueueStats();

    logger.debug('Queue metrics', {
      ...stats,
      averageProcessingTime: this.stats.averageProcessingTime,
      jobsProcessed: this.stats.jobsProcessed,
      jobsFailed: this.stats.jobsFailed,
    });

    // Store metrics in database for analytics
    // This could be expanded to store detailed metrics per queue/provider
  }

  /**
   * Wait for all active jobs to complete
   */
  private async waitForJobsToComplete(timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const activeJobs = Array.from(this.workers.values()).reduce(
        (total, worker) => total + worker.currentJobs.size,
        0,
      );

      if (activeJobs === 0) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /**
   * Wait for specific worker jobs to complete
   */
  private async waitForWorkerJobs(
    workerId: string,
    timeoutMs: number,
  ): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return;
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs && worker.currentJobs.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /**
   * Cleanup completed and old jobs
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date(
        Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
      );

      const db = await getDatabaseClient();
      const result = await db
        .delete(generationQueue)
        .where(
          and(
            sql`${generationQueue.status} IN ('completed', 'failed')`,
            lt(generationQueue.createdAt, cutoffDate),
          ),
        );

      logger.info('Queue cleanup completed', {
        deletedJobs: result,
        olderThanDays,
      });
      return result as number;
    } catch (error) {
      logger.error(
        'Failed to cleanup queue',
        error instanceof Error ? error : new Error(String(error)),
      );
      return 0;
    }
  }
}
