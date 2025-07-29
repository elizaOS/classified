/**
 * WebSocket Server Tests
 * 
 * Tests for the WebSocket server infrastructure integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import http from 'node:http';
import { WebSocketServer } from '../../lib/websocket/server';

describe('WebSocketServer', () => {
  let server: WebSocketServer;
  let httpServer: http.Server;

  beforeEach(() => {
    server = new WebSocketServer();
    httpServer = http.createServer();
  });

  afterEach(() => {
    server.shutdown();
    httpServer.close();
  });

  describe('initialization', () => {
    it('should initialize WebSocket server with HTTP server', () => {
      server.initialize(httpServer);
      
      const status = server.getStatus();
      expect(status.initialized).toBe(true);
    });

    it('should handle initialization gracefully', () => {
      expect(() => {
        server.initialize(httpServer);
      }).not.toThrow();
    });
  });

  describe('message broadcasting', () => {
    beforeEach(() => {
      server.initialize(httpServer);
    });

    it('should handle project update messages without errors', () => {
      const projectId = 'test-project-id';
      const status = 'building';
      const message = 'Build started';
      const data = { buildId: '123' };

      expect(() => {
        server.sendProjectUpdate(projectId, status, message, data);
      }).not.toThrow();
    });

    it('should handle build status messages without errors', () => {
      const projectId = 'test-project-id';
      const status = 'completed';
      const progress = 100;
      const logs = ['Build successful'];

      expect(() => {
        server.sendBuildStatus(projectId, status, progress, logs);
      }).not.toThrow();
    });

    it('should handle agent response messages without errors', () => {
      const projectId = 'test-project-id';
      const message = 'Analysis complete';
      const agentId = 'agent-123';
      const messageType = 'analysis';

      expect(() => {
        server.sendAgentResponse(projectId, message, agentId, messageType);
      }).not.toThrow();
    });

    it('should not broadcast when server is not initialized', () => {
      const uninitializedServer = new WebSocketServer();
      const projectId = 'test-project-id';

      expect(() => {
        uninitializedServer.sendProjectUpdate(projectId, 'test', 'test message');
      }).not.toThrow();
    });
  });

  describe('client management', () => {
    beforeEach(() => {
      server.initialize(httpServer);
    });

    it('should return correct client count', () => {
      const count = server.getConnectedClientCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should return project client count for any project', () => {
      const projectId = 'test-project-id';
      const count = server.getProjectClientCount(projectId);
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for non-existent project', () => {
      const count = server.getProjectClientCount('non-existent-project');
      expect(count).toBe(0);
    });
  });

  describe('server status', () => {
    it('should return correct status when initialized', () => {
      server.initialize(httpServer);
      
      const status = server.getStatus();
      expect(status).toEqual({
        initialized: true,
        clientCount: expect.any(Number),
      });
    });

    it('should return correct status when not initialized', () => {
      const status = server.getStatus();
      expect(status).toEqual({
        initialized: false,
        clientCount: 0,
      });
    });
  });

  describe('shutdown', () => {
    it('should shutdown cleanly', () => {
      server.initialize(httpServer);
      
      server.shutdown();
      
      const status = server.getStatus();
      expect(status.initialized).toBe(false);
    });

    it('should handle shutdown when not initialized', () => {
      // Should not throw
      expect(() => server.shutdown()).not.toThrow();
    });
  });
});