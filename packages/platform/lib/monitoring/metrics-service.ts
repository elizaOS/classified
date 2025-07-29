/**
 * Metrics collection and monitoring service
 */

import { logger } from '../logger';

export interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

export interface MetricsSummary {
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  requestsPerMinute: number;
  activeUsers: number;
  cpuUsage: number;
  memoryUsage: number;
}

export class MetricsService {
  private static instance: MetricsService;
  private metrics: Metric[] = [];
  private maxMetricsHistory = 10000;

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  constructor() {
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Record a metric
   */
  recordMetric(metric: Metric): void {
    this.metrics.push({
      ...metric,
      timestamp: metric.timestamp || new Date(),
    });

    // Keep metrics history bounded
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Record HTTP request metric
   */
  recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
  ): void {
    this.recordMetric({
      name: 'http_request',
      value: responseTime,
      tags: {
        method,
        path,
        status: statusCode.toString(),
        success: (statusCode < 400).toString(),
      },
    });
  }

  /**
   * Record API key usage
   */
  recordApiKeyUsage(
    apiKeyId: string,
    endpoint: string,
    success: boolean,
  ): void {
    this.recordMetric({
      name: 'api_key_usage',
      value: 1,
      tags: {
        apiKeyId,
        endpoint,
        success: success.toString(),
      },
    });
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(windowMinutes: number = 60): MetricsSummary {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(
      (m) => m.timestamp && m.timestamp >= windowStart,
    );

    const httpRequests = recentMetrics.filter((m) => m.name === 'http_request');
    const errors = httpRequests.filter((m) => m.tags?.success === 'false');
    const totalResponseTime = httpRequests.reduce((sum, m) => sum + m.value, 0);

    return {
      totalRequests: httpRequests.length,
      errorRate:
        httpRequests.length > 0
          ? (errors.length / httpRequests.length) * 100
          : 0,
      averageResponseTime:
        httpRequests.length > 0 ? totalResponseTime / httpRequests.length : 0,
      requestsPerMinute: httpRequests.length / windowMinutes,
      activeUsers: this.getActiveUsers(windowMinutes),
      cpuUsage: this.getCpuUsage(),
      memoryUsage: this.getMemoryUsage(),
    };
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(name: string, windowMinutes: number = 60): Metric[] {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    return this.metrics.filter(
      (m) => m.name === name && m.timestamp && m.timestamp >= windowStart,
    );
  }

  /**
   * Get active users count
   */
  private getActiveUsers(windowMinutes: number): number {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    const userSet = new Set<string>();

    this.metrics
      .filter(
        (m) => m.timestamp && m.timestamp >= windowStart && m.tags?.userId,
      )
      .forEach((m) => {
        if (m.tags?.userId) {
          userSet.add(m.tags.userId);
        }
      });

    return userSet.size;
  }

  /**
   * Get CPU usage (mock implementation)
   */
  private getCpuUsage(): number {
    // In a real implementation, this would use process.cpuUsage()
    return Math.random() * 30 + 10; // Mock 10-40% usage
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    const total = used.rss || used.heapTotal;
    return (used.heapUsed / total) * 100;
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 3600000);
      this.metrics = this.metrics.filter(
        (m) => m.timestamp && m.timestamp > oneHourAgo,
      );
    }, 300000); // Cleanup every 5 minutes
  }
}

// Export singleton instance
export const metricsService = MetricsService.getInstance();
