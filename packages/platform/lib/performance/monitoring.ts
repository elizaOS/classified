/**
 * Application Performance Monitoring (APM)
 *
 * Provides comprehensive performance monitoring, profiling,
 * and optimization recommendations for the platform.
 */

import { logger } from '../logger';
// Temporarily disable cache manager import until implementation is ready
// import { cacheManager } from '../cache/cache-manager';

// Temporary mock cache manager for build
const cacheManager = {
  isHealthy: async () => true,
  size: async () => 0,
  set: async () => {},
  get: async () => null,
};
import { dbOptimizer } from './database-optimizer';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface EndpointMetrics {
  path: string;
  method: string;
  requestCount: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // requests per second
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  heapUsed: number;
  heapTotal: number;
  uptime: number;
  loadAverage: number[];
  gcMetrics: {
    collections: number;
    duration: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: '>' | '<' | '=' | '!=' | '>=' | '<=';
  threshold: number;
  duration: number; // Duration in seconds before alert
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  channels: string[]; // Alert channels (email, slack, etc.)
}

/**
 * Application Performance Monitor
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private endpointMetrics = new Map<
    string,
    {
      responseTimes: number[];
      errors: number;
      lastAccess: Date;
    }
  >();
  private alertRules: AlertRule[] = [];
  private activeAlerts = new Set<string>();
  private metricsRetentionHours = 24;
  private maxMetricsInMemory = 100000;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    this.initializeDefaultAlerts();
    this.startMetricsCollection();
    this.startMetricsCleanup();
    this.startAlertEvaluation();
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Trim metrics if too many in memory
    if (this.metrics.length > this.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-this.maxMetricsInMemory);
    }

    // Evaluate alerts
    this.evaluateAlerts(metric);
  }

  /**
   * Create middleware for request monitoring
   */
  createRequestMonitor() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const path = req.route?.path || req.path;
      const method = req.method;
      const endpointKey = `${method}:${path}`;

      // Track request start
      this.recordMetric({
        name: 'http_request_start',
        value: 1,
        unit: 'count',
        timestamp: new Date(),
        tags: {
          method,
          path,
          userAgent: req.headers['user-agent'] || 'unknown',
          ip: req.ip || 'unknown',
        },
      });

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      res.end = function (chunk: any, encoding: any) {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;
        const isError = statusCode >= 400;

        // Record endpoint metrics
        const metrics = getInstance().endpointMetrics.get(endpointKey) || {
          responseTimes: [],
          errors: 0,
          lastAccess: new Date(),
        };

        metrics.responseTimes.push(responseTime);
        metrics.lastAccess = new Date();
        if (isError) {
          metrics.errors++;
        }

        // Keep only last 1000 response times per endpoint
        if (metrics.responseTimes.length > 1000) {
          metrics.responseTimes = metrics.responseTimes.slice(-1000);
        }

        getInstance().endpointMetrics.set(endpointKey, metrics);

        // Record performance metrics
        getInstance().recordMetric({
          name: 'http_request_duration',
          value: responseTime,
          unit: 'ms',
          timestamp: new Date(),
          tags: {
            method,
            path,
            status: statusCode.toString(),
            error: isError.toString(),
          },
        });

        getInstance().recordMetric({
          name: 'http_response_size',
          value: parseInt(res.get('content-length', 10) || '0'),
          unit: 'bytes',
          timestamp: new Date(),
          tags: { method, path },
        });

        // Call original end
        originalEnd.call(this, chunk, encoding);
      };

      next();
    };

    function getInstance() {
      return PerformanceMonitor.instance;
    }
  }

  /**
   * Profile function execution
   */
  profile<T extends (...args: any[]) => any>(fn: T, name?: string): T {
    const functionName = name || fn.name || 'anonymous';

    return ((...args: Parameters<T>) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      try {
        const result = fn(...args);

        // Handle async functions
        if (result instanceof Promise) {
          return result.finally(() => {
            this.recordProfileMetrics(functionName, startTime, startMemory);
          });
        }

        this.recordProfileMetrics(functionName, startTime, startMemory);
        return result;
      } catch (error) {
        this.recordProfileMetrics(functionName, startTime, startMemory, true);
        throw error;
      }
    }) as T;
  }

  /**
   * Create performance timer
   */
  timer(name: string, tags?: Record<string, string>) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    return {
      stop: () => {
        const duration = Date.now() - startTime;
        const memoryDelta = process.memoryUsage().heapUsed - startMemory;

        this.recordMetric({
          name: `timer_${name}`,
          value: duration,
          unit: 'ms',
          timestamp: new Date(),
          tags,
        });

        this.recordMetric({
          name: `memory_delta_${name}`,
          value: memoryDelta,
          unit: 'bytes',
          timestamp: new Date(),
          tags,
        });

        return { duration, memoryDelta };
      },
    };
  }

  /**
   * Get endpoint performance metrics
   */
  getEndpointMetrics(): EndpointMetrics[] {
    const results: EndpointMetrics[] = [];

    for (const [endpoint, data] of this.endpointMetrics.entries()) {
      const [method, path] = endpoint.split(':');
      const responseTimes = data.responseTimes;

      if (responseTimes.length === 0) {
        continue;
      }

      responseTimes.sort((a, b) => a - b);
      const avg =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p99Index = Math.floor(responseTimes.length * 0.99);

      const timeWindowMs = 60000; // 1 minute
      const recentRequests = responseTimes.filter(
        () => Date.now() - data.lastAccess.getTime() < timeWindowMs,
      );

      results.push({
        path,
        method,
        requestCount: responseTimes.length,
        averageResponseTime: avg,
        minResponseTime: Math.min(...responseTimes),
        maxResponseTime: Math.max(...responseTimes),
        errorRate: (data.errors / responseTimes.length) * 100,
        p95ResponseTime: responseTimes[p95Index] || 0,
        p99ResponseTime: responseTimes[p99Index] || 0,
        throughput: recentRequests.length / (timeWindowMs / 1000),
      });
    }

    return results.sort((a, b) => b.requestCount - a.requestCount);
  }

  /**
   * Get system performance metrics
   */
  getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      memoryUsage: (memUsage.rss / memUsage.heapTotal) * 100,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      uptime: process.uptime(),
      loadAverage: require('os').loadavg(),
      gcMetrics: this.getGCMetrics(),
    };
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport() {
    const cacheStats = cacheManager.getStats();
    const dbStats = dbOptimizer.getMetrics();
    const systemStats = this.getSystemMetrics();
    const endpointStats = this.getEndpointMetrics();
    const recentMetrics = this.getRecentMetrics();

    return {
      timestamp: new Date(),
      system: systemStats,
      database: dbStats,
      cache: cacheStats,
      endpoints: endpointStats,
      metrics: recentMetrics,
      alerts: Array.from(this.activeAlerts),
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    logger.info('Alert rule added', {
      id: rule.id,
      name: rule.name,
      severity: rule.severity,
    });
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const index = this.alertRules.findIndex((rule) => rule.id === ruleId);
    if (index >= 0) {
      this.alertRules.splice(index, 1);
      logger.info('Alert rule removed', { id: ruleId });
      return true;
    }
    return false;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): string[] {
    return Array.from(this.activeAlerts);
  }

  /**
   * Create performance dashboard data
   */
  getDashboardData() {
    const now = Date.now();
    const timeRanges = {
      '5m': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };

    const dashboardData: any = {};

    for (const [label, duration] of Object.entries(timeRanges)) {
      const cutoff = now - duration;
      const rangeMetrics = this.metrics.filter(
        (m) => m.timestamp.getTime() > cutoff,
      );

      dashboardData[label] = {
        requests: rangeMetrics.filter((m) => m.name === 'http_request_start')
          .length,
        avgResponseTime: this.calculateAverage(
          rangeMetrics
            .filter((m) => m.name === 'http_request_duration')
            .map((m) => m.value),
        ),
        errorRate: this.calculateErrorRate(rangeMetrics),
        throughput:
          rangeMetrics.filter((m) => m.name === 'http_request_start').length /
          (duration / 1000),
      };
    }

    return {
      timeSeries: dashboardData,
      current: this.getSystemMetrics(),
      topEndpoints: this.getEndpointMetrics().slice(0, 10),
      recentAlerts: Array.from(this.activeAlerts).slice(0, 5),
    };
  }

  /**
   * Record profile metrics for function execution
   */
  private recordProfileMetrics(
    functionName: string,
    startTime: number,
    startMemory: number,
    hasError = false,
  ): void {
    const duration = Date.now() - startTime;
    const memoryDelta = process.memoryUsage().heapUsed - startMemory;

    this.recordMetric({
      name: 'function_duration',
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      tags: { function: functionName, error: hasError.toString() },
    });

    this.recordMetric({
      name: 'function_memory',
      value: memoryDelta,
      unit: 'bytes',
      timestamp: new Date(),
      tags: { function: functionName },
    });
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlerts(): void {
    this.alertRules = [
      {
        id: 'high-response-time',
        name: 'High Response Time',
        metric: 'http_request_duration',
        operator: '>',
        threshold: 5000, // 5 seconds
        duration: 60, // 1 minute
        severity: 'high',
        enabled: true,
        channels: ['log'],
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        metric: 'error_rate',
        operator: '>',
        threshold: 10, // 10%
        duration: 300, // 5 minutes
        severity: 'critical',
        enabled: true,
        channels: ['log'],
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        metric: 'memory_usage',
        operator: '>',
        threshold: 90, // 90%
        duration: 300, // 5 minutes
        severity: 'high',
        enabled: true,
        channels: ['log'],
      },
      {
        id: 'slow-database',
        name: 'Slow Database Queries',
        metric: 'db_query_duration',
        operator: '>',
        threshold: 2000, // 2 seconds
        duration: 120, // 2 minutes
        severity: 'medium',
        enabled: true,
        channels: ['log'],
      },
    ];
  }

  /**
   * Start collecting system metrics
   */
  private startMetricsCollection(): void {
    const collectMetrics = async () => {
      const systemMetrics = this.getSystemMetrics();

      // Record system metrics
      this.recordMetric({
        name: 'cpu_usage',
        value: systemMetrics.cpuUsage,
        unit: 'percentage',
        timestamp: new Date(),
      });

      this.recordMetric({
        name: 'memory_usage',
        value: systemMetrics.memoryUsage,
        unit: 'percentage',
        timestamp: new Date(),
      });

      this.recordMetric({
        name: 'heap_used',
        value: systemMetrics.heapUsed,
        unit: 'bytes',
        timestamp: new Date(),
      });

      // Record cache metrics
      const cacheStats = await cacheManager.getStats();
      this.recordMetric({
        name: 'cache_hit_rate',
        value: cacheStats.combined.hitRate,
        unit: 'percentage',
        timestamp: new Date(),
      });

      // Record database metrics
      const dbStats = dbOptimizer.getMetrics();
      this.recordMetric({
        name: 'db_avg_query_time',
        value: dbStats.averageExecutionTime,
        unit: 'ms',
        timestamp: new Date(),
      });

      this.recordMetric({
        name: 'db_slow_queries',
        value: dbStats.slowQueries,
        unit: 'count',
        timestamp: new Date(),
      });
    };

    // Collect metrics every 30 seconds
    setInterval(collectMetrics, 30000);
    collectMetrics(); // Initial collection
  }

  /**
   * Start metrics cleanup
   */
  private startMetricsCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.metricsRetentionHours * 60 * 60 * 1000;
      this.metrics = this.metrics.filter((m) => m.timestamp.getTime() > cutoff);

      // Clean up endpoint metrics
      for (const [endpoint, data] of this.endpointMetrics.entries()) {
        if (Date.now() - data.lastAccess.getTime() > cutoff) {
          this.endpointMetrics.delete(endpoint);
        }
      }

      logger.debug('Metrics cleanup completed', {
        totalMetrics: this.metrics.length,
        totalEndpoints: this.endpointMetrics.size,
      });
    }, 3600000); // Cleanup every hour
  }

  /**
   * Start alert evaluation
   */
  private startAlertEvaluation(): void {
    setInterval(() => {
      for (const rule of this.alertRules) {
        if (!rule.enabled) {
          continue;
        }
        this.evaluateAlertRule(rule);
      }
    }, 30000); // Evaluate every 30 seconds
  }

  /**
   * Evaluate individual alert rule
   */
  private evaluateAlertRule(rule: AlertRule): void {
    const now = Date.now();
    const cutoff = now - rule.duration * 1000;

    const relevantMetrics = this.metrics.filter(
      (m) => m.name === rule.metric && m.timestamp.getTime() > cutoff,
    );

    if (relevantMetrics.length === 0) {
      return;
    }

    const values = relevantMetrics.map((m) => m.value);
    const currentValue = this.getAggregatedValue(values, rule.metric);

    const isTriggered = this.evaluateCondition(
      currentValue,
      rule.operator,
      rule.threshold,
    );

    const alertKey = `${rule.id}:${rule.metric}`;

    if (isTriggered && !this.activeAlerts.has(alertKey)) {
      this.triggerAlert(rule, currentValue);
    } else if (!isTriggered && this.activeAlerts.has(alertKey)) {
      this.resolveAlert(rule, currentValue);
    }
  }

  /**
   * Evaluate alerts for specific metric
   */
  private evaluateAlerts(metric: PerformanceMetric): void {
    // Real-time alert evaluation for critical metrics
    for (const rule of this.alertRules) {
      if (rule.metric === metric.name && rule.enabled) {
        const isTriggered = this.evaluateCondition(
          metric.value,
          rule.operator,
          rule.threshold,
        );

        if (isTriggered && rule.severity === 'critical') {
          const alertKey = `${rule.id}:${rule.metric}`;
          if (!this.activeAlerts.has(alertKey)) {
            this.triggerAlert(rule, metric.value);
          }
        }
      }
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(rule: AlertRule, value: number): void {
    const alertKey = `${rule.id}:${rule.metric}`;
    this.activeAlerts.add(alertKey);

    logger.warn('Performance alert triggered', {
      rule: rule.name,
      metric: rule.metric,
      threshold: rule.threshold,
      currentValue: value,
      severity: rule.severity,
    });

    // In production, send alerts via configured channels
    this.sendAlert(rule, value, 'triggered');
  }

  /**
   * Resolve alert
   */
  private resolveAlert(rule: AlertRule, value: number): void {
    const alertKey = `${rule.id}:${rule.metric}`;
    this.activeAlerts.delete(alertKey);

    logger.info('Performance alert resolved', {
      rule: rule.name,
      metric: rule.metric,
      currentValue: value,
    });

    this.sendAlert(rule, value, 'resolved');
  }

  /**
   * Send alert via configured channels
   */
  private sendAlert(
    rule: AlertRule,
    value: number,
    status: 'triggered' | 'resolved',
  ): void {
    // This would integrate with actual alerting systems
    // For now, just log the alert
    const alertData = {
      rule: rule.name,
      metric: rule.metric,
      threshold: rule.threshold,
      currentValue: value,
      severity: rule.severity,
      status,
      timestamp: new Date(),
    };

    logger.info('Alert notification', alertData);
  }

  /**
   * Evaluate condition based on operator
   */
  private evaluateCondition(
    value: number,
    operator: string,
    threshold: number,
  ): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '=':
        return value === threshold;
      case '!=':
        return value !== threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      default:
        return false;
    }
  }

  /**
   * Get aggregated value for metric type
   */
  private getAggregatedValue(values: number[], metricName: string): number {
    if (values.length === 0) {
      return 0;
    }

    // Different aggregation strategies based on metric type
    if (metricName.includes('rate') || metricName.includes('percentage')) {
      return values.reduce((a, b) => a + b, 0) / values.length; // Average
    } else if (metricName.includes('duration') || metricName.includes('time')) {
      return Math.max(...values); // Max for response times
    } else {
      return values[values.length - 1]; // Latest value
    }
  }

  /**
   * Get recent metrics
   */
  private getRecentMetrics(minutes: number = 5): PerformanceMetric[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.metrics.filter((m) => m.timestamp.getTime() > cutoff);
  }

  /**
   * Calculate average from array of numbers
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate error rate from metrics
   */
  private calculateErrorRate(metrics: PerformanceMetric[]): number {
    const requests = metrics.filter((m) => m.name === 'http_request_duration');
    if (requests.length === 0) {
      return 0;
    }

    const errors = requests.filter((m) => m.tags?.error === 'true');
    return (errors.length / requests.length) * 100;
  }

  /**
   * Get garbage collection metrics
   */
  private getGCMetrics() {
    // This would be implemented with actual GC monitoring
    return {
      collections: 0,
      duration: 0,
    };
  }

  /**
   * Generate performance recommendations
   */
  private async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    const systemMetrics = this.getSystemMetrics();
    const endpointMetrics = this.getEndpointMetrics();
    const cacheStats = await cacheManager.getStats();

    // Memory recommendations
    if (systemMetrics.memoryUsage > 80) {
      recommendations.push(
        'High memory usage detected. Consider optimizing memory allocation or increasing available memory.',
      );
    }

    // Cache recommendations
    if (cacheStats.combined.hitRate < 70) {
      recommendations.push(
        'Low cache hit rate. Review caching strategy and increase cache TTL for frequently accessed data.',
      );
    }

    // Endpoint recommendations
    const slowEndpoints = endpointMetrics.filter(
      (e) => e.averageResponseTime > 1000,
    );
    if (slowEndpoints.length > 0) {
      recommendations.push(
        `${slowEndpoints.length} endpoints have slow response times. Consider optimization or caching.`,
      );
    }

    // Database recommendations
    const dbMetrics = dbOptimizer.getMetrics();
    if (dbMetrics.slowQueries > 10) {
      recommendations.push(
        'Multiple slow database queries detected. Review query performance and add indexes.',
      );
    }

    return recommendations;
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();
