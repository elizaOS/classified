/**
 * Background Jobs Service
 * Manages scheduled tasks, background processing, and job queues
 */

import { logger } from '@/lib/logger';

export interface JobDefinition {
  id: string;
  name: string;
  schedule?: string; // Cron expression
  handler: () => Promise<void>;
  retries?: number;
  timeout?: number;
}

export interface JobResult {
  jobId: string;
  status: 'success' | 'failed' | 'timeout';
  duration: number;
  error?: string;
  result?: any;
}

export interface JobStatus {
  id: string;
  name: string;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'failed';
  consecutiveFailures: number;
}

export class BackgroundJobsService {
  private jobs: Map<string, JobDefinition> = new Map();
  private jobStatus: Map<string, JobStatus> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private running: Set<string> = new Set();

  /**
   * Register a background job
   */
  registerJob(job: JobDefinition) {
    this.jobs.set(job.id, job);
    this.jobStatus.set(job.id, {
      id: job.id,
      name: job.name,
      status: 'idle',
      consecutiveFailures: 0,
    });

    // Schedule if it has a cron expression
    if (job.schedule) {
      this.scheduleJob(job);
    }

    logger.info('Registered background job', {
      jobId: job.id,
      name: job.name,
      scheduled: !!job.schedule,
    });
  }

  /**
   * Run a job immediately
   */
  async runJob(jobId: string): Promise<JobResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (this.running.has(jobId)) {
      throw new Error(`Job ${jobId} is already running`);
    }

    this.running.add(jobId);
    const status = this.jobStatus.get(jobId)!;
    status.status = 'running';
    status.lastRun = new Date();

    const startTime = Date.now();
    let result: JobResult;

    try {
      // Set timeout if specified
      const timeoutPromise = job.timeout
        ? new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Job timeout')), job.timeout),
          )
        : null;

      const jobPromise = job.handler();

      if (timeoutPromise) {
        await Promise.race([jobPromise, timeoutPromise]);
      } else {
        await jobPromise;
      }

      result = {
        jobId,
        status: 'success',
        duration: Date.now() - startTime,
      };

      status.status = 'idle';
      status.consecutiveFailures = 0;

      logger.info('Job completed successfully', {
        jobId,
        duration: result.duration,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      result = {
        jobId,
        status:
          error instanceof Error && error.message === 'Job timeout'
            ? 'timeout'
            : 'failed',
        duration: Date.now() - startTime,
        error: errorMessage,
      };

      status.status = 'failed';
      status.consecutiveFailures++;

      logger.error('Job failed', {
        jobId,
        error: errorMessage,
        consecutiveFailures: status.consecutiveFailures,
      });

      // Retry if configured
      if (job.retries && status.consecutiveFailures <= job.retries) {
        logger.info('Scheduling job retry', {
          jobId,
          attempt: status.consecutiveFailures,
          maxRetries: job.retries,
        });

        // Exponential backoff
        const delay = Math.min(
          1000 * Math.pow(2, status.consecutiveFailures - 1),
          60000,
        );
        setTimeout(() => this.runJob(jobId), delay);
      }
    } finally {
      this.running.delete(jobId);
    }

    return result;
  }

  /**
   * Get all job statuses
   */
  getJobStatuses(): JobStatus[] {
    return Array.from(this.jobStatus.values());
  }

  /**
   * Get specific job status
   */
  getJobStatus(jobId: string): JobStatus | null {
    return this.jobStatus.get(jobId) || null;
  }

  /**
   * Stop a scheduled job
   */
  stopJob(jobId: string) {
    const interval = this.intervals.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(jobId);

      const status = this.jobStatus.get(jobId);
      if (status) {
        status.nextRun = undefined;
      }

      logger.info('Stopped scheduled job', { jobId });
    }
  }

  /**
   * Stop all jobs
   */
  stopAllJobs() {
    for (const [jobId, interval] of this.intervals) {
      clearInterval(interval);

      const status = this.jobStatus.get(jobId);
      if (status) {
        status.nextRun = undefined;
      }
    }

    this.intervals.clear();
    logger.info('Stopped all scheduled jobs');
  }

  /**
   * Schedule a job based on cron expression
   */
  private scheduleJob(job: JobDefinition) {
    // Simple implementation - in production, use a proper cron library
    // For now, just run every minute for demonstration
    const interval = setInterval(() => {
      this.runJob(job.id).catch((error) => {
        logger.error('Failed to run scheduled job', {
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }, 60000); // Run every minute

    this.intervals.set(job.id, interval);

    const status = this.jobStatus.get(job.id)!;
    status.nextRun = new Date(Date.now() + 60000);
  }

  /**
   * Register default marketplace jobs
   */
  registerMarketplaceJobs() {
    // Clean up expired sessions
    this.registerJob({
      id: 'cleanup-expired-sessions',
      name: 'Clean up expired sessions',
      schedule: '0 * * * *', // Every hour
      handler: async () => {
        // Implementation would clean up expired sessions
        logger.info('Cleaning up expired sessions');
      },
    });

    // Update marketplace statistics
    this.registerJob({
      id: 'update-marketplace-stats',
      name: 'Update marketplace statistics',
      schedule: '*/15 * * * *', // Every 15 minutes
      handler: async () => {
        // Implementation would update cached statistics
        logger.info('Updating marketplace statistics');
      },
    });

    // Process pending payouts
    this.registerJob({
      id: 'process-payouts',
      name: 'Process pending payouts',
      schedule: '0 */6 * * *', // Every 6 hours
      handler: async () => {
        // Implementation would process pending payouts
        logger.info('Processing pending payouts');
      },
    });

    // Monitor container health
    this.registerJob({
      id: 'monitor-containers',
      name: 'Monitor container health',
      schedule: '*/5 * * * *', // Every 5 minutes
      handler: async () => {
        // Implementation would check container health
        logger.info('Monitoring container health');
      },
    });
  }
}

// Export singleton instance
export const backgroundJobs = new BackgroundJobsService();
