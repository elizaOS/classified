/**
 * WebSocket Infrastructure for Platform Package
 * 
 * Provides real-time communication capabilities for the autocoder platform.
 * This module integrates the working WebSocket infrastructure from packages/server.
 */

export * from './server';
export * from './client';
export * from './logger';
export * from './integration';

// Re-export types for convenience
export type {
  WebSocketMessage,
  ProjectUpdateMessage,
  BuildStatusMessage,
  AgentResponseMessage,
} from './server';

export type {
  WebSocketClientOptions,
  WebSocketEventHandler,
} from './client';

export type {
  WebSocketIntegrationOptions,
} from './integration';