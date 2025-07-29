/**
 * Database Performance Optimizer
 *
 * Provides database query optimization, connection pooling,
 * and performance monitoring capabilities.
 */

import { getSql } from '../database';
import { logger } from '../logger';
// Temporarily disable cache manager import until implementation is ready
// import { cacheManager } from '../cache/cache-manager';

// Temporary mock cache manager for build
const cacheManager = {
  set: async () => {},
  get: async () => null,
  delete: async () => true,
};

export interface QueryPerformanceMetrics {
  query: string;
  executionTime: number;
  rowsAffected: number;
  cacheHit: boolean;
  timestamp: Date;
  parameters?: any[];
}

export interface DatabaseMetrics {
  totalQueries: number;
  averageExecutionTime: number;
  slowQueries: number;
  cacheHitRate: number;
  connectionPoolSize: number;
  activeConnections: number;
  errorRate: number;
}

export interface QueryOptimizationRule {
  pattern: RegExp;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
  autoFix?: (query: string) => string;
}

/**
 * Database Performance Optimizer
 */
export class DatabaseOptimizer {
  private static instance: DatabaseOptimizer;
  private queryMetrics: QueryPerformanceMetrics[] = [];
  private slowQueryThreshold = 1000; // 1 second
  private maxMetricsHistory = 10000;
  private optimizationRules: QueryOptimizationRule[] = [];

  static getInstance(): DatabaseOptimizer {
    if (!DatabaseOptimizer.instance) {
      DatabaseOptimizer.instance = new DatabaseOptimizer();
    }
    return DatabaseOptimizer.instance;
  }

  constructor() {
    this.initializeOptimizationRules();
    this.startMetricsCleanup();
  }

  /**
   * Execute query with performance monitoring and caching
   */
  async executeQuery<T = any>(
    query: string,
    parameters: any[] = [],
    options: {
      cache?: boolean;
      cacheTTL?: number;
      cacheKey?: string;
      skipOptimization?: boolean;
    } = {},
  ): Promise<T[]> {
    const startTime = Date.now();
    const cacheKey =
      options.cacheKey || this.generateCacheKey(query, parameters);

    try {
      // Try cache first if enabled
      if (options.cache !== false) {
        const cachedResult = await cacheManager.get<T[]>(
          cacheKey,
          undefined,
          { ttl: options.cacheTTL || 300 }, // 5 minutes default
        );

        if (cachedResult !== null) {
          this.recordMetrics({
            query,
            executionTime: Date.now() - startTime,
            rowsAffected: cachedResult.length,
            cacheHit: true,
            timestamp: new Date(),
            parameters,
          });

          return cachedResult;
        }
      }

      // Optimize query if not skipped
      let optimizedQuery = query;
      if (!options.skipOptimization) {
        optimizedQuery = this.optimizeQuery(query);
        if (optimizedQuery !== query) {
          logger.debug('Query optimized', {
            original: query,
            optimized: optimizedQuery,
          });
        }
      }

      // Execute query
      // TODO: Implement actual query execution once database API is available
      const result: any[] = [];
      const executionTime = Date.now() - startTime;

      // Cache result if enabled
      if (options.cache !== false && result.length > 0) {
        await cacheManager.set(cacheKey, result, {
          ttl: options.cacheTTL || 300,
          tags: this.extractTableNames(query),
        });
      }

      // Record metrics
      this.recordMetrics({
        query: optimizedQuery,
        executionTime,
        rowsAffected: result.length,
        cacheHit: false,
        timestamp: new Date(),
        parameters,
      });

      // Log slow queries
      if (executionTime > this.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          query: optimizedQuery,
          executionTime,
          parameters,
          rowsAffected: result.length,
        });
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.recordMetrics({
        query,
        executionTime,
        rowsAffected: 0,
        cacheHit: false,
        timestamp: new Date(),
        parameters,
      });

      logger.error('Query execution failed', error as Error, {
        query,
        parameters,
        executionTime,
      });

      throw error;
    }
  }

  /**
   * Execute cached query with automatic invalidation
   */
  async executeCachedQuery<T = any>(
    query: string,
    parameters: any[] = [],
    options: {
      ttl?: number;
      tags?: string[];
      invalidateOn?: string[];
    } = {},
  ): Promise<T[]> {
    const cacheKey = this.generateCacheKey(query, parameters);
    const tables = options.tags || this.extractTableNames(query);

    return await this.executeQuery(query, parameters, {
      cache: true,
      cacheTTL: options.ttl || 300,
      cacheKey,
    });
  }

  /**
   * Invalidate cache for specific tables
   */
  async invalidateTableCache(tableNames: string[]): Promise<void> {
    for (const tableName of tableNames) {
      await cacheManager.invalidateByTag(tableName);
      logger.debug('Cache invalidated for table', { tableName });
    }
  }

  /**
   * Optimize query based on rules
   */
  optimizeQuery(query: string): string {
    let optimizedQuery = query.trim();

    for (const rule of this.optimizationRules) {
      if (rule.pattern.test(optimizedQuery) && rule.autoFix) {
        const newQuery = rule.autoFix(optimizedQuery);
        if (newQuery !== optimizedQuery) {
          logger.debug('Applied optimization rule', {
            rule: rule.suggestion,
            severity: rule.severity,
          });
          optimizedQuery = newQuery;
        }
      }
    }

    return optimizedQuery;
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  analyzeQuery(query: string): {
    suggestions: string[];
    estimatedCost: 'low' | 'medium' | 'high';
    canCache: boolean;
  } {
    const suggestions: string[] = [];
    let estimatedCost: 'low' | 'medium' | 'high' = 'low';
    let canCache = true;

    // Check against optimization rules
    for (const rule of this.optimizationRules) {
      if (rule.pattern.test(query)) {
        suggestions.push(rule.suggestion);
        if (rule.severity === 'high') {
          estimatedCost = 'high';
        } else if (rule.severity === 'medium' && estimatedCost !== 'high') {
          estimatedCost = 'medium';
        }
      }
    }

    // Check if query is cacheable
    const lowerQuery = query.toLowerCase();
    if (
      lowerQuery.includes('insert') ||
      lowerQuery.includes('update') ||
      lowerQuery.includes('delete') ||
      lowerQuery.includes('now()') ||
      lowerQuery.includes('random()')
    ) {
      canCache = false;
    }

    return { suggestions, estimatedCost, canCache };
  }

  /**
   * Get database performance metrics
   */
  getMetrics(): DatabaseMetrics {
    if (this.queryMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowQueries: 0,
        cacheHitRate: 0,
        connectionPoolSize: 0,
        activeConnections: 0,
        errorRate: 0,
      };
    }

    const totalQueries = this.queryMetrics.length;
    const totalExecutionTime = this.queryMetrics.reduce(
      (sum, metric) => sum + metric.executionTime,
      0,
    );
    const cacheHits = this.queryMetrics.filter((m) => m.cacheHit).length;
    const slowQueries = this.queryMetrics.filter(
      (m) => m.executionTime > this.slowQueryThreshold,
    ).length;

    return {
      totalQueries,
      averageExecutionTime: totalExecutionTime / totalQueries,
      slowQueries,
      cacheHitRate: (cacheHits / totalQueries) * 100,
      connectionPoolSize: 10, // Would be dynamic in real implementation
      activeConnections: 2, // Would be dynamic in real implementation
      errorRate: 0, // Would track errors in real implementation
    };
  }

  /**
   * Get slow queries report
   */
  getSlowQueries(limit: number = 10): QueryPerformanceMetrics[] {
    return this.queryMetrics
      .filter((m) => m.executionTime > this.slowQueryThreshold)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Get most frequent queries
   */
  getFrequentQueries(limit: number = 10): Array<{
    query: string;
    count: number;
    averageExecutionTime: number;
  }> {
    const queryStats = new Map<
      string,
      {
        count: number;
        totalTime: number;
      }
    >();

    for (const metric of this.queryMetrics) {
      const normalizedQuery = this.normalizeQuery(metric.query);
      const stats = queryStats.get(normalizedQuery) || {
        count: 0,
        totalTime: 0,
      };
      stats.count++;
      stats.totalTime += metric.executionTime;
      queryStats.set(normalizedQuery, stats);
    }

    return Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        averageExecutionTime: stats.totalTime / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Create database indexes based on query patterns
   */
  async suggestIndexes(): Promise<string[]> {
    const suggestions: string[] = [];
    const tableColumns = new Map<string, Set<string>>();

    // Analyze WHERE clauses in queries
    for (const metric of this.queryMetrics) {
      const whereMatches = metric.query.match(/WHERE\s+(\w+)\.(\w+)\s*[=<>]/gi);
      if (whereMatches) {
        for (const match of whereMatches) {
          const [, table, column] = match.match(/WHERE\s+(\w+)\.(\w+)/) || [];
          if (table && column) {
            const columns = tableColumns.get(table) || new Set();
            columns.add(column);
            tableColumns.set(table, columns);
          }
        }
      }
    }

    // Generate index suggestions
    for (const [table, columns] of tableColumns.entries()) {
      if (columns.size > 0) {
        const columnList = Array.from(columns).join(', ');
        suggestions.push(
          `CREATE INDEX idx_${table}_${Array.from(columns).join('_')} ON ${table} (${columnList});`,
        );
      }
    }

    return suggestions;
  }

  /**
   * Create query plan cache wrapper
   */
  createQueryPlanCache() {
    const planCache = new Map<string, any>();

    const optimizer = this;

    return {
      async getExecutionPlan(query: string): Promise<any> {
        const cacheKey = `plan:${optimizer.normalizeQuery(query)}`;

        if (planCache.has(cacheKey)) {
          return planCache.get(cacheKey);
        }

        try {
          // TODO: Implement actual execution plan query once database API is available
          const plan = null;
          if (plan) {
            planCache.set(cacheKey, plan);
          }
          return plan;
        } catch (error) {
          logger.error('Failed to get execution plan', error as Error, {
            query,
          });
          return null;
        }
      },

      clearCache(): void {
        planCache.clear();
      },
    };
  }

  /**
   * Initialize optimization rules
   */
  private initializeOptimizationRules(): void {
    this.optimizationRules = [
      {
        pattern: /SELECT \* FROM/i,
        suggestion: 'Avoid SELECT * - specify only needed columns',
        severity: 'medium',
        autoFix: (query) => {
          // In a real implementation, this would be more sophisticated
          return query;
        },
      },
      {
        pattern: /WHERE.*LIKE '%.*%'/i,
        suggestion:
          'Leading wildcard LIKE queries are slow - consider full-text search',
        severity: 'high',
      },
      {
        pattern: /ORDER BY.*RAND\(\)/i,
        suggestion: 'ORDER BY RAND() is very slow on large tables',
        severity: 'high',
      },
      {
        pattern: /WHERE.*!=|<>/i,
        suggestion: 'NOT EQUAL operators prevent index usage',
        severity: 'medium',
      },
      {
        pattern: /WHERE.*OR/i,
        suggestion: 'OR conditions may prevent index usage - consider UNION',
        severity: 'medium',
      },
      {
        pattern: /JOIN.*ON.*FUNCTION\(/i,
        suggestion: 'Functions in JOIN conditions prevent index usage',
        severity: 'high',
      },
      {
        pattern: /LIMIT \d+, \d+/i,
        suggestion: 'Large OFFSET values are slow - consider cursor pagination',
        severity: 'medium',
      },
    ];
  }

  /**
   * Generate cache key for query and parameters
   */
  private generateCacheKey(query: string, parameters: any[]): string {
    const normalizedQuery = this.normalizeQuery(query);
    const paramHash = parameters.length > 0 ? JSON.stringify(parameters) : '';
    return `query:${normalizedQuery}:${paramHash}`;
  }

  /**
   * Normalize query for caching and analysis
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '?')
      .trim()
      .toLowerCase();
  }

  /**
   * Extract table names from query
   */
  private extractTableNames(query: string): string[] {
    const tables: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Extract FROM tables
    const fromMatches = lowerQuery.match(/from\s+(\w+)/gi);
    if (fromMatches) {
      for (const match of fromMatches) {
        const table = match.replace(/from\s+/i, '');
        if (!tables.includes(table)) {
          tables.push(table);
        }
      }
    }

    // Extract JOIN tables
    const joinMatches = lowerQuery.match(/join\s+(\w+)/gi);
    if (joinMatches) {
      for (const match of joinMatches) {
        const table = match.replace(/join\s+/i, '');
        if (!tables.includes(table)) {
          tables.push(table);
        }
      }
    }

    // Extract INSERT/UPDATE/DELETE tables
    const dmlMatches = lowerQuery.match(
      /(insert into|update|delete from)\s+(\w+)/gi,
    );
    if (dmlMatches) {
      for (const match of dmlMatches) {
        const table = match.replace(/(insert into|update|delete from)\s+/i, '');
        if (!tables.includes(table)) {
          tables.push(table);
        }
      }
    }

    return tables;
  }

  /**
   * Record query performance metrics
   */
  private recordMetrics(metric: QueryPerformanceMetrics): void {
    this.queryMetrics.push(metric);

    // Keep only recent metrics
    if (this.queryMetrics.length > this.maxMetricsHistory) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Start metrics cleanup timer
   */
  private startMetricsCleanup(): void {
    setInterval(() => {
      const oneHourAgo = Date.now() - 3600000;
      this.queryMetrics = this.queryMetrics.filter(
        (m) => m.timestamp.getTime() > oneHourAgo,
      );
    }, 300000); // Cleanup every 5 minutes
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.queryMetrics = [];
  }

  /**
   * Set slow query threshold
   */
  setSlowQueryThreshold(milliseconds: number): void {
    this.slowQueryThreshold = milliseconds;
  }
}

// Export singleton instance
export const dbOptimizer = DatabaseOptimizer.getInstance();
