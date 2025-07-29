/**
 * Structured Logging System
 * Provides consistent logging across the platform
 */

import { env } from '../config/env-validation';

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: keyof typeof LogLevel;
  message: string;
  service?: string;
  userId?: string;
  organizationId?: string;
  requestId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  service: string;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
}

// Default configuration
const defaultConfig: LoggerConfig = {
  level: env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  service: 'elizaos-platform',
  enableConsole: true,
  enableFile: env.NODE_ENV === 'production',
  enableRemote: false,
};

/**
 * Structured Logger Class
 */
export class Logger {
  private config: LoggerConfig;
  private context: Record<string, any> = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Set persistent context for all logs
   */
  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel | keyof typeof LogLevel): void {
    if (typeof level === 'string') {
      this.config.level = LogLevel[level];
    } else {
      this.config.level = level;
    }
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: keyof typeof LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: Error,
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      ...this.context,
      ...(metadata && { metadata }),
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  /**
   * Write log entry
   */
  private writeLog(entry: LogEntry): void {
    // Check if log level is enabled
    if (LogLevel[entry.level] < this.config.level) {
      return;
    }

    // Console output
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }

    // File output (in production)
    if (this.config.enableFile) {
      this.writeToFile(entry);
    }

    // Remote logging (if enabled)
    if (this.config.enableRemote) {
      this.writeToRemote(entry);
    }
  }

  /**
   * Write to console with formatting
   */
  private writeToConsole(entry: LogEntry): void {
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m', // Green
      WARN: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m', // Red
      CRITICAL: '\x1b[35m', // Magenta
      RESET: '\x1b[0m',
    };

    const color = colors[entry.level];
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();

    const prefix = `${color}[${timestamp}] ${entry.level}${colors.RESET}`;
    const service = entry.service ? ` (${entry.service})` : '';
    const context = entry.userId ? ` user:${entry.userId}` : '';

    const logMessage = `${prefix}${service}${context}: ${entry.message}`;

    // Use appropriate console method
    switch (entry.level) {
      case 'DEBUG':
        console.debug(logMessage, entry.metadata || '');
        break;
      case 'INFO':
        console.info(logMessage, entry.metadata || '');
        break;
      case 'WARN':
        console.warn(logMessage, entry.metadata || '');
        break;
      case 'ERROR':
      case 'CRITICAL':
        console.error(logMessage, entry.error || entry.metadata || '');
        if (entry.error?.stack) {
          console.error(entry.error.stack);
        }
        break;
    }
  }

  /**
   * Write to file (placeholder for production)
   */
  private writeToFile(entry: LogEntry): void {
    // In a real implementation, this would write to a log file
    // For now, we'll use console for simplicity
    if (entry.level === 'ERROR' || entry.level === 'CRITICAL') {
      // Could write to error.log file
    }
  }

  /**
   * Write to remote logging service (placeholder)
   */
  private writeToRemote(entry: LogEntry): void {
    // In a real implementation, this would send to a service like:
    // - DataDog
    // - Sentry
    // - CloudWatch
    // - Custom logging endpoint
  }

  /**
   * Debug logging
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.writeLog(this.createLogEntry('DEBUG', message, metadata));
  }

  /**
   * Info logging
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.writeLog(this.createLogEntry('INFO', message, metadata));
  }

  /**
   * Warning logging
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.writeLog(this.createLogEntry('WARN', message, metadata));
  }

  /**
   * Error logging
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.writeLog(this.createLogEntry('ERROR', message, metadata, error));
  }

  /**
   * Critical error logging
   */
  critical(
    message: string,
    error?: Error,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog(this.createLogEntry('CRITICAL', message, metadata, error));
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }

  /**
   * Log HTTP request
   */
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>,
  ): void {
    const level =
      statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';

    this.writeLog(
      this.createLogEntry(
        level,
        `${method} ${url} ${statusCode} - ${duration}ms`,
        {
          httpRequest: {
            method,
            url,
            statusCode,
            duration,
          },
          ...metadata,
        },
      ),
    );
  }

  /**
   * Log authentication events
   */
  logAuth(event: string, metadata?: Record<string, any>): void {
    this.writeLog(
      this.createLogEntry('INFO', `Auth: ${event}`, {
        category: 'authentication',
        ...metadata,
      }),
    );
  }

  /**
   * Log security events
   */
  logSecurity(event: string, metadata?: Record<string, any>): void {
    this.writeLog(
      this.createLogEntry('WARN', `Security: ${event}`, {
        category: 'security',
        ...metadata,
      }),
    );
  }

  /**
   * Log database operations
   */
  logDatabase(
    operation: string,
    table?: string,
    metadata?: Record<string, any>,
  ): void {
    this.writeLog(
      this.createLogEntry(
        'DEBUG',
        `DB: ${operation}${table ? ` on ${table}` : ''}`,
        {
          category: 'database',
          operation,
          table,
          ...metadata,
        },
      ),
    );
  }
}

// Create default logger instance
export const logger = new Logger();

// Create specialized loggers
export const authLogger = new Logger({ service: 'auth' });
export const databaseLogger = new Logger({ service: 'database' });
export const apiLogger = new Logger({ service: 'api' });

// Export logger for use throughout the application
export default logger;
