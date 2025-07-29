/**
 * Platform WebSocket Autocoder Tests
 *
 * Dedicated tests for WebSocket functionality in the autocoder platform API,
 * focusing on real-time communication, message broadcasting, and connection management.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// Mock the platform's WebSocket server behavior
class MockAutocoderWebSocketServer extends EventEmitter {
  private wss: WebSocket.Server | null = null;
  private clients: Map<string, any> = new Map();
  private port: number;

  constructor(port: number = 8081) {
    super();
    this.port = port;
  }

  async start(): Promise<void> {
    this.wss = new WebSocket.Server({
      port: this.port,
      path: '/api/autocoder/ws',
    });

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const url = new URL(req.url, `http://localhost:${this.port}`);
      const userId = url.searchParams.get('userId');

      if (!userId) {
        ws.close(1002, 'Missing userId parameter');
        return;
      }

      const clientId = randomUUID();
      const client = {
        id: clientId,
        userId,
        ws,
        subscribedProjects: new Set(),
        isAlive: true,
      };

      this.clients.set(clientId, client);

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: 'CONNECTION_ESTABLISHED',
          data: {
            clientId,
            timestamp: new Date().toISOString(),
          },
        }),
      );

      ws.on('message', (data: Buffer) => {
        this.handleMessage(clientId, data);
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
      });

      ws.on('pong', () => {
        client.isAlive = true;
      });
    });
  }

  private handleMessage(clientId: string, data: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'SUBSCRIBE_PROJECT':
          this.handleSubscribeProject(client, message);
          break;

        case 'UNSUBSCRIBE_PROJECT':
          this.handleUnsubscribeProject(client, message);
          break;

        case 'AGENT_MESSAGE':
          this.handleAgentMessage(client, message);
          break;

        case 'PING':
          this.sendMessage(clientId, { type: 'PONG' });
          break;

        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
      this.sendMessage(clientId, {
        type: 'ERROR',
        data: { message: 'Invalid message format' },
      });
    }
  }

  private handleSubscribeProject(client: any, message: any): void {
    if (!message.projectId) {
      return;
    }

    client.subscribedProjects.add(message.projectId);

    this.sendMessage(client.id, {
      type: 'SUBSCRIBED',
      projectId: message.projectId,
      data: { message: 'Successfully subscribed to project updates' },
    });
  }

  private handleUnsubscribeProject(client: any, message: any): void {
    if (!message.projectId) {
      return;
    }

    client.subscribedProjects.delete(message.projectId);

    this.sendMessage(client.id, {
      type: 'UNSUBSCRIBED',
      projectId: message.projectId,
      data: { message: 'Successfully unsubscribed from project updates' },
    });
  }

  private handleAgentMessage(client: any, message: any): void {
    if (!message.projectId || !message.message) {
      return;
    }

    // Broadcast user message to all subscribers
    this.broadcastToProject(message.projectId, {
      type: 'USER_MESSAGE',
      projectId: message.projectId,
      message: message.message,
      timestamp: new Date().toISOString(),
    });

    // Simulate agent processing and response
    setTimeout(() => {
      this.broadcastToProject(message.projectId, {
        type: 'AGENT_MESSAGE',
        projectId: message.projectId,
        message: `I understand you want: "${message.message}". I'm processing this request and will generate the appropriate code.`,
        timestamp: new Date().toISOString(),
        data: {
          metadata: {
            processing: true,
            estimatedTime: '2-3 minutes',
          },
        },
      });
    }, 500);
  }

  private sendMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private broadcastToProject(projectId: string, message: any): void {
    for (const client of this.clients.values()) {
      if (
        client.subscribedProjects.has(projectId) &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }

  // Simulate project events from the build queue
  public simulateProjectEvent(
    projectId: string,
    eventType: string,
    data: any,
  ): void {
    this.broadcastToProject(projectId, {
      type: 'PROJECT_UPDATE',
      projectId,
      data: {
        updates: data,
      },
      timestamp: new Date().toISOString(),
    });
  }

  async stop(): Promise<void> {
    if (this.wss) {
      for (const client of this.clients.values()) {
        client.ws.close(1001, 'Server shutting down');
      }
      this.clients.clear();
      this.wss.close();
    }
  }
}

describe('Platform WebSocket Autocoder Tests', () => {
  let mockServer: MockAutocoderWebSocketServer;
  let testUserId: string;
  let testProjectId: string;

  beforeAll(async () => {
    testUserId = randomUUID();
    testProjectId = randomUUID();

    mockServer = new MockAutocoderWebSocketServer(8081);
    await mockServer.start();

    console.log('🚀 Mock WebSocket server started on port 8081');
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
      console.log('🛑 Mock WebSocket server stopped');
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WebSocket Connection Management', () => {
    it('should establish WebSocket connection with valid userId', (done) => {
      console.log('🧪 Testing WebSocket connection with valid userId...');

      const ws = new WebSocket(
        `ws://localhost:8081/api/autocoder/ws?userId=${testUserId}`,
      );

      ws.on('open', () => {
        console.log('✅ WebSocket connection opened');
      });

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'CONNECTION_ESTABLISHED') {
          expect(message.data.clientId).toBeDefined();
          expect(message.data.timestamp).toBeDefined();

          console.log('✅ CONNECTION_ESTABLISHED received');
          console.log(`Client ID: ${message.data.clientId}`);

          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('should reject connection without userId parameter', (done) => {
      console.log(
        '🧪 Testing WebSocket connection rejection without userId...',
      );

      const ws = new WebSocket('ws://localhost:8081/api/autocoder/ws');

      ws.on('close', (code: number, reason: Buffer) => {
        expect(code).toBe(1002);
        expect(reason.toString()).toBe('Missing userId parameter');

        console.log('✅ Connection properly rejected without userId');
        done();
      });

      ws.on('error', () => {
        // Expected behavior - connection should be rejected
      });
    });

    it('should handle multiple concurrent connections', async () => {
      console.log('🧪 Testing multiple concurrent WebSocket connections...');

      const connections: WebSocket[] = [];
      const connectionPromises: Promise<string>[] = [];

      // Create 5 concurrent connections
      for (let i = 0; i < 5; i++) {
        const userId = `user-${i}`;
        const ws = new WebSocket(
          `ws://localhost:8081/api/autocoder/ws?userId=${userId}`,
        );
        connections.push(ws);

        const promise = new Promise<string>((resolve, reject) => {
          ws.on('message', (data: Buffer) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'CONNECTION_ESTABLISHED') {
              resolve(message.data.clientId);
            }
          });

          ws.on('error', reject);

          setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 5000);
        });

        connectionPromises.push(promise);
      }

      const clientIds = await Promise.all(connectionPromises);

      expect(clientIds).toHaveLength(5);
      expect(new Set(clientIds).size).toBe(5); // All IDs should be unique

      console.log('✅ All concurrent connections established successfully');
      console.log(`Client IDs: ${clientIds.join(', ')}`);

      // Clean up connections
      connections.forEach((ws) => ws.close());
    });
  });

  describe('Project Subscription Management', () => {
    it('should handle project subscription and unsubscription', (done) => {
      console.log('🧪 Testing project subscription/unsubscription cycle...');

      const ws = new WebSocket(
        `ws://localhost:8081/api/autocoder/ws?userId=${testUserId}`,
      );
      let step = 0;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        switch (step) {
          case 0: // Connection established
            if (message.type === 'CONNECTION_ESTABLISHED') {
              console.log('  ✅ Connection established');

              // Subscribe to project
              ws.send(
                JSON.stringify({
                  type: 'SUBSCRIBE_PROJECT',
                  projectId: testProjectId,
                }),
              );
              step = 1;
            }
            break;

          case 1: // Subscription confirmed
            if (message.type === 'SUBSCRIBED') {
              expect(message.projectId).toBe(testProjectId);
              expect(message.data.message).toContain('Successfully subscribed');

              console.log('  ✅ Project subscription confirmed');

              // Unsubscribe
              ws.send(
                JSON.stringify({
                  type: 'UNSUBSCRIBE_PROJECT',
                  projectId: testProjectId,
                }),
              );
              step = 2;
            }
            break;

          case 2: // Unsubscription confirmed
            if (message.type === 'UNSUBSCRIBED') {
              expect(message.projectId).toBe(testProjectId);
              expect(message.data.message).toContain(
                'Successfully unsubscribed',
              );

              console.log('  ✅ Project unsubscription confirmed');

              ws.close();
              done();
            }
            break;
        }
      });

      ws.on('error', done);
    });

    it('should handle multiple project subscriptions', (done) => {
      console.log('🧪 Testing multiple project subscriptions...');

      const projectIds = [randomUUID(), randomUUID(), randomUUID()];
      const ws = new WebSocket(
        `ws://localhost:8081/api/autocoder/ws?userId=${testUserId}`,
      );
      let subscriptions = 0;
      let connectionEstablished = false;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (
          message.type === 'CONNECTION_ESTABLISHED' &&
          !connectionEstablished
        ) {
          connectionEstablished = true;

          // Subscribe to all projects
          projectIds.forEach((projectId) => {
            ws.send(
              JSON.stringify({
                type: 'SUBSCRIBE_PROJECT',
                projectId,
              }),
            );
          });
        } else if (message.type === 'SUBSCRIBED') {
          subscriptions++;
          expect(projectIds).toContain(message.projectId);

          console.log(
            `  ✅ Subscribed to project ${subscriptions}/${projectIds.length}`,
          );

          if (subscriptions === projectIds.length) {
            console.log('  ✅ All project subscriptions confirmed');
            ws.close();
            done();
          }
        }
      });

      ws.on('error', done);
    });
  });

  describe('Real-time Message Broadcasting', () => {
    it('should broadcast user messages to project subscribers', (done) => {
      console.log('🧪 Testing user message broadcasting...');

      const ws = new WebSocket(
        `ws://localhost:8081/api/autocoder/ws?userId=${testUserId}`,
      );
      let subscribed = false;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'CONNECTION_ESTABLISHED') {
          // Subscribe to project
          ws.send(
            JSON.stringify({
              type: 'SUBSCRIBE_PROJECT',
              projectId: testProjectId,
            }),
          );
        } else if (message.type === 'SUBSCRIBED' && !subscribed) {
          subscribed = true;

          // Send agent message
          ws.send(
            JSON.stringify({
              type: 'AGENT_MESSAGE',
              projectId: testProjectId,
              message: 'Create a smart contract for token staking',
            }),
          );
        } else if (message.type === 'USER_MESSAGE') {
          expect(message.projectId).toBe(testProjectId);
          expect(message.message).toBe(
            'Create a smart contract for token staking',
          );
          expect(message.timestamp).toBeDefined();

          console.log('  ✅ User message broadcast received');
          console.log(`  Message: ${message.message}`);

          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('should broadcast agent responses to project subscribers', (done) => {
      console.log('🧪 Testing agent response broadcasting...');

      const ws = new WebSocket(
        `ws://localhost:8081/api/autocoder/ws?userId=${testUserId}`,
      );
      let userMessageReceived = false;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'CONNECTION_ESTABLISHED') {
          // Subscribe and send message
          ws.send(
            JSON.stringify({
              type: 'SUBSCRIBE_PROJECT',
              projectId: testProjectId,
            }),
          );
        } else if (message.type === 'SUBSCRIBED') {
          // Send agent message
          ws.send(
            JSON.stringify({
              type: 'AGENT_MESSAGE',
              projectId: testProjectId,
              message: 'Generate a yield farming smart contract',
            }),
          );
        } else if (message.type === 'USER_MESSAGE' && !userMessageReceived) {
          userMessageReceived = true;
          console.log('  ✅ User message processed');
        } else if (message.type === 'AGENT_MESSAGE' && userMessageReceived) {
          expect(message.projectId).toBe(testProjectId);
          expect(message.message).toContain('I understand you want');
          expect(message.data.metadata.processing).toBe(true);
          expect(message.data.metadata.estimatedTime).toBeDefined();

          console.log('  ✅ Agent response broadcast received');
          console.log(`  Response: ${message.message.substring(0, 50)}...`);
          console.log(
            `  Estimated time: ${message.data.metadata.estimatedTime}`,
          );

          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('should handle project updates from build queue events', (done) => {
      console.log('🧪 Testing project update broadcasting...');

      const ws = new WebSocket(
        `ws://localhost:8081/api/autocoder/ws?userId=${testUserId}`,
      );

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'CONNECTION_ESTABLISHED') {
          // Subscribe to project
          ws.send(
            JSON.stringify({
              type: 'SUBSCRIBE_PROJECT',
              projectId: testProjectId,
            }),
          );
        } else if (message.type === 'SUBSCRIBED') {
          // Simulate a project event from the build queue
          setTimeout(() => {
            mockServer.simulateProjectEvent(testProjectId, 'PROJECT_UPDATE', {
              status: 'active',
              phase: 'code_generation',
              progress: 45,
            });
          }, 500);
        } else if (message.type === 'PROJECT_UPDATE') {
          expect(message.projectId).toBe(testProjectId);
          expect(message.data.updates.status).toBe('active');
          expect(message.data.updates.phase).toBe('code_generation');
          expect(message.data.updates.progress).toBe(45);

          console.log('  ✅ Project update received');
          console.log(`  Status: ${message.data.updates.status}`);
          console.log(`  Phase: ${message.data.updates.phase}`);
          console.log(`  Progress: ${message.data.updates.progress}%`);

          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });
  });

  describe('WebSocket Heartbeat and Connection Health', () => {
    it('should respond to PING with PONG', (done) => {
      console.log('🧪 Testing WebSocket heartbeat mechanism...');

      const ws = new WebSocket(
        `ws://localhost:8081/api/autocoder/ws?userId=${testUserId}`,
      );
      let connectionEstablished = false;

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'CONNECTION_ESTABLISHED') {
          connectionEstablished = true;

          // Send PING
          ws.send(JSON.stringify({ type: 'PING' }));
        } else if (message.type === 'PONG' && connectionEstablished) {
          console.log('  ✅ PONG received for heartbeat');

          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('should handle connection errors gracefully', (done) => {
      console.log('🧪 Testing WebSocket error handling...');

      const ws = new WebSocket(
        `ws://localhost:8081/api/autocoder/ws?userId=${testUserId}`,
      );

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'CONNECTION_ESTABLISHED') {
          // Send invalid JSON to trigger error handling
          ws.send('invalid json message');
        } else if (message.type === 'ERROR') {
          expect(message.data.message).toBe('Invalid message format');

          console.log('  ✅ Error handled gracefully');
          console.log(`  Error message: ${message.data.message}`);

          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });
  });

  describe('Multi-Client Scenarios', () => {
    it('should handle multiple clients subscribing to same project', async () => {
      console.log('🧪 Testing multiple clients subscribing to same project...');

      const clients: WebSocket[] = [];
      const clientPromises: Promise<void>[] = [];

      // Create 3 clients
      for (let i = 0; i < 3; i++) {
        const userId = `multi-user-${i}`;
        const ws = new WebSocket(
          `ws://localhost:8081/api/autocoder/ws?userId=${userId}`,
        );
        clients.push(ws);

        const promise = new Promise<void>((resolve, reject) => {
          let subscribed = false;
          let messageReceived = false;

          ws.on('message', (data: Buffer) => {
            const message = JSON.parse(data.toString());

            if (message.type === 'CONNECTION_ESTABLISHED') {
              // Subscribe to the same project
              ws.send(
                JSON.stringify({
                  type: 'SUBSCRIBE_PROJECT',
                  projectId: testProjectId,
                }),
              );
            } else if (message.type === 'SUBSCRIBED' && !subscribed) {
              subscribed = true;

              // First client sends a message
              if (i === 0) {
                ws.send(
                  JSON.stringify({
                    type: 'AGENT_MESSAGE',
                    projectId: testProjectId,
                    message: 'Multi-client test message',
                  }),
                );
              }
            } else if (message.type === 'USER_MESSAGE' && !messageReceived) {
              messageReceived = true;
              expect(message.message).toBe('Multi-client test message');

              console.log(`  ✅ Client ${i} received broadcast message`);
              resolve();
            }
          });

          ws.on('error', reject);

          setTimeout(() => {
            reject(new Error(`Client ${i} timeout`));
          }, 10000);
        });

        clientPromises.push(promise);
      }

      await Promise.all(clientPromises);

      console.log('✅ All clients received the broadcast message');

      // Clean up
      clients.forEach((ws) => ws.close());
    });
  });
});
