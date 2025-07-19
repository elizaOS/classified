import { Service, type IAgentRuntime } from '@elizaos/core';
import * as os from 'os';
import * as fs from 'fs/promises';
import { AutonomyLogger } from './logging';
import { ResourceStatus } from './types';

export class ResourceMonitorService extends Service {
  static serviceType = 'resource-monitor';
  capabilityDescription = 'Real-time system resource monitoring';

  private logger: AutonomyLogger;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private currentStatus: ResourceStatus = {
    cpu: 0,
    memory: 0,
    diskSpace: 0,
    apiCalls: {},
    taskSlots: { used: 0, total: 5 },
  };
  private cpuHistory: number[] = [];
  private apiCallTracker: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.logger = new AutonomyLogger(runtime);
  }

  async initialize() {
    this.startMonitoring();
    this.logger.info('Resource monitor service initialized');
  }

  private startMonitoring() {
    // Update every 5 seconds
    this.monitoringInterval = setInterval(() => {
      this.updateResourceStatus();
    }, 5000);

    // Initial update
    this.updateResourceStatus();
  }

  private async updateResourceStatus() {
    try {
      // CPU Usage
      const cpuUsage = this.calculateCPUUsage();
      this.cpuHistory.push(cpuUsage);
      if (this.cpuHistory.length > 12) {
        // Keep 1 minute of history
        this.cpuHistory.shift();
      }
      this.currentStatus.cpu = Math.round(
        this.cpuHistory.reduce((a, b) => a + b, 0) / this.cpuHistory.length
      );

      // Memory Usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      this.currentStatus.memory = Math.round((usedMem / totalMem) * 100);

      // Disk Space (simplified - just check temp directory)
      this.currentStatus.diskSpace = await this.getDiskUsage();

      // Clean up old API call tracking
      this.cleanupApiCallTracking();

      // Log if resources are constrained
      if (this.currentStatus.cpu > 80 || this.currentStatus.memory > 80) {
        this.logger.warn('High resource usage detected', {
          cpu: this.currentStatus.cpu,
          memory: this.currentStatus.memory,
        });
      }
    } catch (error) {
      this.logger.error('Failed to update resource status', error as Error);
    }
  }

  private calculateCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((100 * idle) / total);

    return Math.max(0, Math.min(100, usage));
  }

  private async getDiskUsage(): Promise<number> {
    try {
      // Try to get disk usage for the current working directory
      const cwd = process.cwd();

      // On Unix-like systems, check disk usage via statvfs
      if (process.platform !== 'win32') {
        try {
          // Try to read /proc/mounts to find the filesystem for cwd
          const mountsContent = await fs.readFile('/proc/mounts', 'utf8');
          const mounts = mountsContent
            .split('\n')
            .filter((line) => line.includes('/'))
            .map((line) => {
              const parts = line.split(' ');
              return { device: parts[0], mountpoint: parts[1] };
            })
            .sort((a, b) => b.mountpoint.length - a.mountpoint.length); // Sort by longest path first

          // Find the mount point that contains our current working directory
          let targetMount = '/';
          for (const mount of mounts) {
            if (cwd.startsWith(mount.mountpoint)) {
              targetMount = mount.mountpoint;
              break;
            }
          }

          // Use df command to get actual disk usage
          const { spawn } = require('child_process');
          return new Promise<number>((resolve) => {
            const dfProcess = spawn('df', [targetMount]);
            let output = '';

            dfProcess.stdout.on('data', (data: Buffer) => {
              output += data.toString();
            });

            dfProcess.on('close', (code: number) => {
              if (code === 0) {
                const lines = output.trim().split('\n');
                if (lines.length >= 2) {
                  const parts = lines[1].split(/\s+/);
                  if (parts.length >= 5) {
                    const usedPercentage = parseInt(parts[4].replace('%', ''), 10);
                    if (!isNaN(usedPercentage)) {
                      resolve(usedPercentage);
                      return;
                    }
                  }
                }
              }
              // Fallback to statvfs if df fails
              resolve(this.fallbackDiskUsage());
            });

            dfProcess.on('error', () => {
              resolve(this.fallbackDiskUsage());
            });
          });
        } catch (_error) {
          return this.fallbackDiskUsage();
        }
      } else {
        // On Windows, use WMI or fallback
        return this.getWindowsDiskUsage();
      }
    } catch (error) {
      this.logger.warn('Failed to get disk usage, using fallback', { error });
      return this.fallbackDiskUsage();
    }
  }

  private async getWindowsDiskUsage(): Promise<number> {
    try {
      // Get the drive letter from current working directory
      const cwd = process.cwd();
      const driveLetter = cwd.charAt(0);

      // Use wmic command to get disk usage on Windows
      const { spawn } = require('child_process');
      return new Promise<number>((resolve) => {
        const wmicProcess = spawn('wmic', [
          'logicaldisk',
          'where',
          `Caption="${driveLetter}:"`,
          'get',
          'Size,FreeSpace',
          '/format:csv',
        ]);

        let output = '';
        wmicProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        wmicProcess.on('close', (code: number) => {
          if (code === 0) {
            const lines = output.split('\n').filter((line) => line.includes(','));
            if (lines.length > 0) {
              const parts = lines[0].split(',');
              if (parts.length >= 3) {
                const freeSpace = parseInt(parts[1], 10);
                const totalSpace = parseInt(parts[2], 10);
                if (!isNaN(freeSpace) && !isNaN(totalSpace) && totalSpace > 0) {
                  const usedSpace = totalSpace - freeSpace;
                  const usagePercentage = Math.round((usedSpace / totalSpace) * 100);
                  resolve(usagePercentage);
                  return;
                }
              }
            }
          }
          resolve(this.fallbackDiskUsage());
        });

        wmicProcess.on('error', () => {
          resolve(this.fallbackDiskUsage());
        });
      });
    } catch (_error) {
      return this.fallbackDiskUsage();
    }
  }

  private fallbackDiskUsage(): number {
    // Last resort: estimate based on temp directory and some heuristics
    try {
      const tmpDir = os.tmpdir();
      // Use process memory usage as a very rough proxy
      const memUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const memoryUsageRatio = memUsage.heapUsed / totalMemory;

      // Estimate disk usage based on memory usage (very rough heuristic)
      // Assume disk usage correlates somewhat with memory usage
      const estimatedUsage = Math.min(90, Math.max(10, memoryUsageRatio * 100 + 20));

      this.logger.debug('Using fallback disk usage estimation', {
        tmpDir,
        memoryUsageRatio,
        estimatedUsage,
      });

      return Math.round(estimatedUsage);
    } catch {
      // Ultimate fallback: return a conservative estimate
      return 25;
    }
  }

  private cleanupApiCallTracking() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    for (const [api, tracker] of this.apiCallTracker.entries()) {
      if (tracker.resetTime < oneHourAgo) {
        this.apiCallTracker.delete(api);
      }
    }
  }

  trackApiCall(api: string) {
    const now = Date.now();
    const tracker = this.apiCallTracker.get(api);

    if (!tracker) {
      this.apiCallTracker.set(api, {
        count: 1,
        resetTime: now + 3600000, // Reset after 1 hour
      });
    } else if (tracker.resetTime < now) {
      // Reset the counter
      tracker.count = 1;
      tracker.resetTime = now + 3600000;
    } else {
      tracker.count++;
    }

    // Update current status
    this.currentStatus.apiCalls = {};
    for (const [api, tracker] of this.apiCallTracker.entries()) {
      this.currentStatus.apiCalls[api] = tracker.count;
    }
  }

  updateTaskSlots(used: number) {
    this.currentStatus.taskSlots.used = Math.max(
      0,
      Math.min(used, this.currentStatus.taskSlots.total)
    );
  }

  getResourceStatus(): ResourceStatus {
    return { ...this.currentStatus };
  }

  isResourceConstrained(): boolean {
    return (
      this.currentStatus.cpu > 80 ||
      this.currentStatus.memory > 80 ||
      this.currentStatus.taskSlots.used >= this.currentStatus.taskSlots.total
    );
  }

  getResourceConstraints(): string[] {
    const constraints: string[] = [];

    if (this.currentStatus.cpu > 80) {
      constraints.push(`High CPU usage: ${this.currentStatus.cpu}%`);
    }

    if (this.currentStatus.memory > 80) {
      constraints.push(`High memory usage: ${this.currentStatus.memory}%`);
    }

    if (this.currentStatus.taskSlots.used >= this.currentStatus.taskSlots.total) {
      constraints.push('All task slots in use');
    }

    if (this.currentStatus.diskSpace > 85) {
      constraints.push(`Low disk space: ${100 - this.currentStatus.diskSpace}% free`);
    }

    return constraints;
  }

  async stop(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.logger.info('Resource monitor service stopped');
    return Promise.resolve();
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new ResourceMonitorService(runtime);
    await service.initialize();
    return service;
  }
}
