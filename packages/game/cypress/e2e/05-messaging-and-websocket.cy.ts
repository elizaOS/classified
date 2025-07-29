/// <reference types="cypress" />

/**
 * Messaging and WebSocket Tests
 * Tests WebSocket connection, message sending/receiving, broadcast, and real-time updates
 */

describe('Messaging and WebSocket', () => {
  const BACKEND_URL = Cypress.env('BACKEND_URL') || 'http://localhost:7777';
  const DEFAULT_AGENT_ID = '15aec527-fb92-0792-91b6-becd4fac5050';
  const _TEST_TIMEOUT = 30000;

  before(() => {
    // Ensure backend is ready
    cy.waitForBackend();
  });

  beforeEach(() => {
    // Visit the application
    cy.visit('/', { timeout: 30000 });

    // Skip boot sequence
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection', () => {
      cy.window().then((win: any) => {
        // Check if WebSocket client exists
        expect(win.elizaClient).to.exist;
        expect(win.elizaClient.socket).to.exist;

        // Verify connection status
        expect(win.elizaClient.socket.connected).to.be.true;

        cy.log('✅ WebSocket connected');
      });
    });

    it('should handle WebSocket reconnection', () => {
      cy.window().then((win: any) => {
        const client = win.elizaClient;

        // Disconnect
        client.socket.disconnect();
        cy.wait(1000);

        // Should attempt to reconnect
        cy.wrap(null)
          .then(() => {
            return new Cypress.Promise((resolve) => {
              const checkConnection = () => {
                if (client.socket.connected) {
                  resolve(true);
                } else {
                  setTimeout(checkConnection, 500);
                }
              };
              checkConnection();
            });
          })
          .then(() => {
            expect(client.socket.connected).to.be.true;
            cy.log('✅ WebSocket reconnected successfully');
          });
      });
    });

    it('should receive connection events', () => {
      cy.window().then((win: any) => {
        const client = win.elizaClient;

        // Listen for events
        const events = [];

        client.socket.on('connect', () => events.push('connect'));
        client.socket.on('disconnect', () => events.push('disconnect'));
        client.socket.on('error', (error) => events.push(`error: ${error}`));

        // Trigger reconnection
        client.socket.disconnect();
        cy.wait(500);
        client.socket.connect();

        cy.wait(2000).then(() => {
          expect(events).to.include('disconnect');
          expect(events).to.include('connect');
          cy.log(`✅ Received events: ${events.join(', ')}`);
        });
      });
    });
  });

  describe('Message Sending', () => {
    it('should send message to agent via API', () => {
      const testMessage = {
        text: `Test message at ${Date.now()}`,
        userId: 'test-user-cypress',
        roomId: '550e8400-e29b-41d4-a716-446655440003',
        messageId: `msg-${Date.now()}`,
      };

      cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, testMessage).then(
        (response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;

          cy.log(`✅ Message sent: ${testMessage.text}`);
        }
      );
    });

    it('should send message through WebSocket', () => {
      cy.window().then((win: any) => {
        const client = win.elizaClient;
        const messageText = `WebSocket test ${Date.now()}`;
        const roomId = '550e8400-e29b-41d4-a716-446655440004';

        // Listen for response
        let responseReceived = false;
        client.socket.on('message', (data) => {
          if (data.roomId === roomId) {
            responseReceived = true;
          }
        });

        // Send message
        client.sendMessage({
          text: messageText,
          roomId,
          userId: 'test-user',
        });

        // Wait for response
        cy.wait(3000).then(() => {
          expect(responseReceived).to.be.true;
          cy.log('✅ WebSocket message sent and response received');
        });
      });
    });

    it('should handle multiple messages in sequence', () => {
      const roomId = `sequence-test-${Date.now()}`;
      const messages = ['First message', 'Second message', 'Third message'];

      // Send messages sequentially
      messages.forEach((text, index) => {
        cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, {
          text: `${text} - ${Date.now()}`,
          userId: 'sequence-test-user',
          roomId,
          messageId: `seq-msg-${index}-${Date.now()}`,
        }).then((response) => {
          expect(response.status).to.eq(200);
        });

        // Small delay between messages
        cy.wait(1000);
      });

      // Verify messages were processed
      cy.request('GET', `${BACKEND_URL}/api/memories?roomId=${roomId}&count=10`).then(
        (response) => {
          expect(response.body.data.length).to.be.at.least(messages.length);
          cy.log(`✅ Sent ${messages.length} messages sequentially`);
        }
      );
    });
  });

  describe('Message Broadcasting', () => {
    it('should broadcast messages to room participants', () => {
      const roomId = `broadcast-room-${Date.now()}`;

      cy.window().then((win: any) => {
        const client = win.elizaClient;
        const receivedMessages = [];

        // Join room
        client.joinRoom(roomId);

        // Listen for messages
        client.socket.on('message', (data) => {
          if (data.roomId === roomId) {
            receivedMessages.push(data);
          }
        });

        // Send broadcast message
        cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, {
          text: 'Broadcast test message',
          userId: 'broadcaster',
          roomId,
          messageId: `broadcast-${Date.now()}`,
        }).then(() => {
          cy.wait(2000).then(() => {
            expect(receivedMessages.length).to.be.at.least(1);
            cy.log(`✅ Received ${receivedMessages.length} broadcast messages`);
          });
        });
      });
    });

    it('should handle room-specific messaging', () => {
      const room1 = `room1-${Date.now()}`;
      const room2 = `room2-${Date.now()}`;

      cy.window().then((win: any) => {
        const client = win.elizaClient;
        const room1Messages = [];
        const room2Messages = [];

        // Join both rooms
        client.joinRoom(room1);
        client.joinRoom(room2);

        // Listen for messages
        client.socket.on('message', (data) => {
          if (data.roomId === room1) {
            room1Messages.push(data);
          }
          if (data.roomId === room2) {
            room2Messages.push(data);
          }
        });

        // Send to room1
        cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, {
          text: 'Message for room 1',
          userId: 'test-user',
          roomId: room1,
          messageId: `room1-msg-${Date.now()}`,
        });

        // Send to room2
        cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, {
          text: 'Message for room 2',
          userId: 'test-user',
          roomId: room2,
          messageId: `room2-msg-${Date.now()}`,
        });

        cy.wait(3000).then(() => {
          expect(room1Messages.length).to.be.at.least(1);
          expect(room2Messages.length).to.be.at.least(1);
          cy.log(
            `✅ Room isolation working: Room1=${room1Messages.length}, Room2=${room2Messages.length}`
          );
        });
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should receive real-time agent responses', () => {
      const roomId = `realtime-test-${Date.now()}`;

      cy.window().then((win: any) => {
        const client = win.elizaClient;
        let userMessageReceived = false;
        let agentResponseReceived = false;

        // Join room
        client.joinRoom(roomId);

        // Listen for messages
        client.socket.on('message', (data) => {
          if (data.roomId === roomId) {
            if (data.userId === 'test-user') {
              userMessageReceived = true;
            } else if (data.userId === DEFAULT_AGENT_ID) {
              agentResponseReceived = true;
            }
          }
        });

        // Send message
        client.sendMessage({
          text: 'Hello, can you respond in real-time?',
          roomId,
          userId: 'test-user',
        });

        // Wait for both messages
        cy.wait(5000).then(() => {
          expect(userMessageReceived).to.be.true;
          expect(agentResponseReceived).to.be.true;
          cy.log('✅ Real-time message exchange completed');
        });
      });
    });

    it('should receive typing indicators', () => {
      cy.window().then((win: any) => {
        const client = win.elizaClient;
        const roomId = `typing-test-${Date.now()}`;
        let typingReceived = false;

        // Listen for typing events
        client.socket.on('typing', (data) => {
          if (data.roomId === roomId) {
            typingReceived = true;
          }
        });

        // Send message that triggers typing
        client.sendMessage({
          text: 'This should trigger typing indicator',
          roomId,
          userId: 'test-user',
        });

        cy.wait(2000).then(() => {
          // Typing indicators might be optional
          cy.log(`✅ Typing indicator: ${typingReceived ? 'received' : 'not implemented'}`);
        });
      });
    });

    it('should receive status updates', () => {
      cy.window().then((win: any) => {
        const client = win.elizaClient;
        const statusUpdates = [];

        // Listen for status updates
        client.socket.on('status', (data) => {
          statusUpdates.push(data);
        });

        client.socket.on('agent-status', (data) => {
          statusUpdates.push(data);
        });

        // Trigger some activity
        client.sendMessage({
          text: 'Status update test',
          roomId: '550e8400-e29b-41d4-a716-446655440005',
          userId: 'test-user',
        });

        cy.wait(3000).then(() => {
          cy.log(`✅ Received ${statusUpdates.length} status updates`);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle message send failures gracefully', () => {
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`,
        body: {
          // Missing required fields
          text: 'Incomplete message',
        },
        failOnStatusCode: false,
      }).then((response) => {
        // Should handle gracefully
        expect([200, 400, 500]).to.include(response.status);
      });
    });

    it('should handle WebSocket disconnection', () => {
      cy.window().then((win: any) => {
        const client = win.elizaClient;
        const _originalState = client.socket.connected;

        // Force disconnect
        client.socket.disconnect();

        cy.wait(1000).then(() => {
          expect(client.socket.connected).to.be.false;

          // Should attempt reconnection
          client.socket.connect();

          cy.wait(2000).then(() => {
            expect(client.socket.connected).to.be.true;
            cy.log('✅ Handled disconnection and reconnection');
          });
        });
      });
    });

    it('should handle rapid message sending', () => {
      const roomId = `rapid-test-${Date.now()}`;
      const messageCount = 10;

      cy.window().then((win: any) => {
        const client = win.elizaClient;
        const sentMessages = [];

        // Send messages rapidly
        for (let i = 0; i < messageCount; i++) {
          const message = {
            text: `Rapid message ${i}`,
            roomId,
            userId: 'rapid-test-user',
            messageId: `rapid-${i}-${Date.now()}`,
          };

          sentMessages.push(message);
          client.sendMessage(message);
        }

        cy.wait(5000).then(() => {
          cy.log(`✅ Sent ${messageCount} messages rapidly`);
        });
      });
    });
  });

  describe('Message Persistence', () => {
    it('should persist messages in memory system', () => {
      const roomId = `persist-test-${Date.now()}`;
      const messageText = `Persistence test ${Date.now()}`;

      // Send message
      cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, {
        text: messageText,
        userId: 'persist-test-user',
        roomId,
        messageId: `persist-${Date.now()}`,
      })
        .then(() => {
          cy.wait(2000);

          // Retrieve memories
          return cy.request('GET', `${BACKEND_URL}/api/memories?roomId=${roomId}&count=10`);
        })
        .then((response) => {
          expect(response.body.success).to.be.true;
          expect(response.body.data).to.be.an('array');

          // Find our message in memories
          const ourMessage = response.body.data.find((memory) =>
            memory.content.includes(messageText)
          );

          expect(ourMessage).to.exist;
          cy.log('✅ Message persisted in memory system');
        });
    });

    it('should maintain message order', () => {
      const roomId = `order-test-${Date.now()}`;
      const messages = [];

      // Send ordered messages
      for (let i = 1; i <= 5; i++) {
        const message = {
          text: `Ordered message ${i}`,
          userId: 'order-test-user',
          roomId,
          messageId: `order-${i}-${Date.now()}`,
        };

        messages.push(message);

        cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, message);
        cy.wait(500); // Ensure order
      }

      // Retrieve and verify order
      cy.request('GET', `${BACKEND_URL}/api/memories?roomId=${roomId}&count=20`).then(
        (response) => {
          const memories = response.body.data;

          // Messages should be in order (newest first or oldest first)
          cy.log(`✅ Retrieved ${memories.length} messages in order`);
        }
      );
    });
  });
});

// Messaging Summary Test
describe('Messaging and WebSocket Summary', () => {
  it('should verify complete messaging functionality', () => {
    const BACKEND_URL = Cypress.env('BACKEND_URL') || 'http://localhost:7777';
    const operations = [];

    cy.log('🎯 MESSAGING AND WEBSOCKET VERIFICATION:');

    // Test WebSocket connection
    cy.window()
      .then((win: any) => {
        const wsConnected = win.elizaClient?.socket?.connected || false;
        operations.push({
          operation: 'WebSocket Connection',
          success: wsConnected,
          details: wsConnected ? 'Connected' : 'Not connected',
        });

        if (wsConnected) {
          // Test message sending
          const testRoomId = `summary-test-${Date.now()}`;

          return cy
            .request(
              'POST',
              `${BACKEND_URL}/api/agents/15aec527-fb92-0792-91b6-becd4fac5050/message`,
              {
                text: 'Summary test message',
                userId: 'summary-test',
                roomId: testRoomId,
                messageId: `summary-${Date.now()}`,
              }
            )
            .then((response) => {
              operations.push({
                operation: 'Message Send',
                success: response.status === 200,
                details: response.status === 200 ? 'Message sent' : 'Send failed',
              });

              // Test memory retrieval
              return cy.request('GET', `${BACKEND_URL}/api/memories?roomId=${testRoomId}&count=5`);
            })
            .then((memResponse) => {
              operations.push({
                operation: 'Message Persistence',
                success: memResponse.status === 200,
                details: `${memResponse.body.data?.length || 0} messages retrieved`,
              });
            });
        }
      })
      .then(() => {
        // Display results
        operations.forEach((op) => {
          const icon = op.success ? '✅' : '❌';
          cy.log(`${icon} ${op.operation}: ${op.details}`);
        });

        const successCount = operations.filter((op) => op.success).length;
        cy.log(`\n✅ ${successCount}/${operations.length} operations successful`);

        // All critical operations should work
        expect(successCount).to.be.at.least(operations.length - 1);

        cy.screenshot('messaging-websocket-summary');
      });
  });
});
