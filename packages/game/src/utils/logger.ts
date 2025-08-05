/**
 * Production-ready logging service
 * Provides structured logging with different log levels
 * In production, can be configured to send logs to external services
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface LogContext {
  [key: string]: any;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private isDevelopment: boolean;
  private componentName?: string;

  private constructor() {
    this.isDevelopment = import.meta.env.MODE === 'development';
    this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  static withComponent(componentName: string): Logger {
    const logger = new Logger();
    logger.componentName = componentName;
    logger.logLevel = Logger.getInstance().logLevel;
    logger.isDevelopment = Logger.getInstance().isDevelopment;
    return logger;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const component = this.componentName ? `[${this.componentName}] ` : '';
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `${timestamp} [${level}] ${component}${message}${contextStr}`;
  }

  private log(level: LogLevel, levelStr: string, message: string, context?: LogContext): void {
    if (level < this.logLevel) return;

    const formattedMessage = this.formatMessage(levelStr, message, context);

    // In development, use console methods for better browser dev tools integration
    if (this.isDevelopment) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
      }
    } else {
      // In production, could send to external logging service
      // For now, we'll use console but in a structured way
      if (level >= LogLevel.ERROR) {
        console.error(formattedMessage);
        // Could also send to error reporting service like Sentry
        this.reportError(message, context);
      }
    }
  }

  private reportError(message: string, context?: LogContext): void {
    // In production, this would send to an error reporting service
    // For now, we'll store in localStorage for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      errors.push({
        timestamp: new Date().toISOString(),
        message,
        context,
        component: this.componentName,
      });
      // Keep only last 100 errors
      if (errors.length > 100) {
        errors.splice(0, errors.length - 100);
      }
      localStorage.setItem('app_errors', JSON.stringify(errors));
    } catch (_e) {
      // Ignore localStorage errors
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = { ...context };

    if (error instanceof Error) {
      errorContext.errorMessage = error.message;
      errorContext.errorStack = error.stack;
    } else if (error) {
      errorContext.error = error;
    }

    this.log(LogLevel.ERROR, 'ERROR', message, errorContext);
  }

  // Special method for performance logging
  time(label: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.timeEnd(label);
    }
  }
}

// Export a default logger instance
export const logger = Logger.getInstance();

// Export factory function for component-specific loggers
export const createLogger = (componentName: string) => Logger.withComponent(componentName);

// Export Logger class for testing
export { Logger };
