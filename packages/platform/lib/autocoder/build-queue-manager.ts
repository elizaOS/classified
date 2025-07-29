import { EventEmitter } from 'events';

interface BuildJob {
  id: string;
  projectId: string;
  userId: string;
  specification: any;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  progress?: number;
  currentStep?: string;
}

interface BuildWorker {
  id: string;
  status: 'idle' | 'busy';
  currentJob?: string;
  lastHeartbeat: Date;
}

interface QueueStats {
  totalJobs: number;
  queuedJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  queueWaitTime: number;
}

type BuildJobEvent =
  | 'job-queued'
  | 'job-started'
  | 'job-progress'
  | 'job-completed'
  | 'job-failed'
  | 'job-cancelled';

export class BuildQueueManager extends EventEmitter {
  private static instance: BuildQueueManager;
  private jobs: Map<string, BuildJob> = new Map();
  private workers: Map<string, BuildWorker> = new Map();
  private queue: string[] = [];
  private processing: Set<string> = new Set();
  private maxConcurrentJobs = 3;
  private processingInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.startProcessing();
    this.startHeartbeat();
  }

  static getInstance(): BuildQueueManager {
    if (!BuildQueueManager.instance) {
      BuildQueueManager.instance = new BuildQueueManager();
    }
    return BuildQueueManager.instance;
  }

  async addBuild(job: Omit<BuildJob, 'queuedAt' | 'status'>): Promise<void> {
    const buildJob: BuildJob = {
      ...job,
      status: 'queued',
      queuedAt: new Date(),
    };

    this.jobs.set(job.id, buildJob);

    // Insert into queue based on priority
    this.insertIntoQueue(job.id, job.priority);

    this.emit('job-queued', buildJob);

    console.log(
      `Build job ${job.id} added to queue with priority ${job.priority}`,
    );
  }

  async cancelBuild(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'queued') {
      // Remove from queue
      const queueIndex = this.queue.indexOf(jobId);
      if (queueIndex !== -1) {
        this.queue.splice(queueIndex, 1);
      }

      job.status = 'cancelled';
      job.completedAt = new Date();

      this.emit('job-cancelled', job);
      return true;
    }

    if (job.status === 'processing') {
      // Mark for cancellation (worker should check this)
      job.status = 'cancelled';
      job.completedAt = new Date();

      this.processing.delete(jobId);

      this.emit('job-cancelled', job);
      return true;
    }

    return false;
  }

  async getJob(jobId: string): Promise<BuildJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async getJobsByUser(userId: string): Promise<BuildJob[]> {
    return Array.from(this.jobs.values())
      .filter((job) => job.userId === userId)
      .sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime());
  }

  async getJobsByProject(projectId: string): Promise<BuildJob[]> {
    return Array.from(this.jobs.values())
      .filter((job) => job.projectId === projectId)
      .sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime());
  }

  async getQueueStatus(): Promise<QueueStats> {
    const allJobs = Array.from(this.jobs.values());
    const completedJobs = allJobs.filter((job) => job.status === 'completed');

    const totalProcessingTime = completedJobs.reduce((sum, job) => {
      if (job.startedAt && job.completedAt) {
        return sum + (job.completedAt.getTime() - job.startedAt.getTime());
      }
      return sum;
    }, 0);

    const queuedJobs = allJobs.filter((job) => job.status === 'queued');
    const avgQueueWaitTime =
      queuedJobs.length > 0
        ? queuedJobs.reduce(
            (sum, job) => sum + (Date.now() - job.queuedAt.getTime()),
            0,
          ) / queuedJobs.length
        : 0;

    return {
      totalJobs: allJobs.length,
      queuedJobs: queuedJobs.length,
      processingJobs: allJobs.filter((job) => job.status === 'processing')
        .length,
      completedJobs: completedJobs.length,
      failedJobs: allJobs.filter((job) => job.status === 'failed').length,
      averageProcessingTime:
        completedJobs.length > 0
          ? totalProcessingTime / completedJobs.length
          : 0,
      queueWaitTime: avgQueueWaitTime,
    };
  }

  updateJobProgress(
    jobId: string,
    progress: number,
    currentStep?: string,
  ): void {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'processing') {
      job.progress = Math.max(0, Math.min(100, progress));
      if (currentStep) {
        job.currentStep = currentStep;
      }

      this.emit('job-progress', job);
    }
  }

  markJobCompleted(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'processing') {
      job.status = 'completed';
      job.completedAt = new Date();
      job.progress = 100;

      this.processing.delete(jobId);

      this.emit('job-completed', job);

      console.log(`Build job ${jobId} completed successfully`);
    }
  }

  markJobFailed(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'processing') {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error;

      this.processing.delete(jobId);

      this.emit('job-failed', job);

      console.log(`Build job ${jobId} failed: ${error}`);
    }
  }

  // Worker management
  registerWorker(workerId: string): void {
    this.workers.set(workerId, {
      id: workerId,
      status: 'idle',
      lastHeartbeat: new Date(),
    });

    console.log(`Build worker ${workerId} registered`);
  }

  unregisterWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker?.currentJob) {
      // Return job to queue if worker was processing it
      this.returnJobToQueue(worker.currentJob);
    }

    this.workers.delete(workerId);
    console.log(`Build worker ${workerId} unregistered`);
  }

  workerHeartbeat(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.lastHeartbeat = new Date();
    }
  }

  private insertIntoQueue(jobId: string, priority: string): void {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const jobPriorityValue =
      priorityOrder[priority as keyof typeof priorityOrder] || 2;

    // Find insertion position based on priority
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const existingJob = this.jobs.get(this.queue[i]);
      if (existingJob) {
        const existingPriorityValue =
          priorityOrder[existingJob.priority as keyof typeof priorityOrder] ||
          2;
        if (jobPriorityValue < existingPriorityValue) {
          insertIndex = i;
          break;
        }
      }
    }

    this.queue.splice(insertIndex, 0, jobId);
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 1000); // Check every second
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkWorkerHealth();
    }, 30000); // Check every 30 seconds
  }

  private processQueue(): void {
    // Check if we can process more jobs
    if (this.processing.size >= this.maxConcurrentJobs) {
      return;
    }

    // Get next job from queue
    while (
      this.queue.length > 0 &&
      this.processing.size < this.maxConcurrentJobs
    ) {
      const jobId = this.queue.shift()!;
      const job = this.jobs.get(jobId);

      if (!job || job.status !== 'queued') {
        continue;
      }

      // Start processing the job
      job.status = 'processing';
      job.startedAt = new Date();
      job.progress = 0;

      this.processing.add(jobId);

      this.emit('job-started', job);

      console.log(`Started processing build job ${jobId}`);
    }
  }

  private returnJobToQueue(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'processing') {
      job.status = 'queued';
      job.startedAt = undefined;
      job.progress = undefined;
      job.currentStep = undefined;

      this.processing.delete(jobId);
      this.insertIntoQueue(jobId, job.priority);

      console.log(`Returned job ${jobId} to queue`);
    }
  }

  private checkWorkerHealth(): void {
    const now = new Date();
    const staleThreshold = 60000; // 1 minute

    for (const [workerId, worker] of this.workers.entries()) {
      if (now.getTime() - worker.lastHeartbeat.getTime() > staleThreshold) {
        console.log(`Worker ${workerId} appears to be stale, removing`);
        this.unregisterWorker(workerId);
      }
    }
  }

  // Cleanup method
  async shutdown(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Cancel all queued jobs
    for (const jobId of this.queue) {
      await this.cancelBuild(jobId);
    }

    this.removeAllListeners();

    console.log('Build queue manager shut down');
  }

  // Helper methods for monitoring
  getActiveJobs(): BuildJob[] {
    return Array.from(this.jobs.values()).filter(
      (job) => job.status === 'processing' || job.status === 'queued',
    );
  }

  getQueuePosition(jobId: string): number {
    return this.queue.indexOf(jobId) + 1; // 1-based position, 0 if not in queue
  }

  async getEstimatedWaitTime(jobId: string): Promise<number> {
    const position = this.getQueuePosition(jobId);
    if (position === 0) {
      return 0;
    }

    // Estimate based on average processing time and queue position
    const stats = await this.getQueueStatus();
    const avgProcessingTime = stats.averageProcessingTime || 300000; // 5 minutes default
    const availableWorkers = Math.max(
      1,
      this.maxConcurrentJobs - this.processing.size,
    );

    return Math.ceil((position - 1) / availableWorkers) * avgProcessingTime;
  }
}
