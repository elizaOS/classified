/**
 * Logger utility for WebSocket operations
 * 
 * Provides consistent logging interface for WebSocket client and server operations.
 */

export interface Logger {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

/**
 * Simple console-based logger implementation
 */
export const logger: Logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[WebSocket] ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WebSocket] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[WebSocket] ${message}`, ...args);
  },
  
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[WebSocket] ${message}`, ...args);
    }
  },
};