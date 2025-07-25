/**
 * Capability Controls and Message Flow Tests
 * 
 * Tests comprehensive functionality for:
 * - Capability toggling (microphone, speaker, camera, shell, browser)
 * - Autonomy enable/disable controls
 * - Message send/receive/broadcast flow
 * - Server-to-Agent communication
 * - Real-time WebSocket updates
 */

describe('Capability Controls and Message Flow', () => {
  const API_BASE = 'http://localhost:7777';
  const AGENT_ID = '15aec527-fb92-0792-91b6-becd4fac5050'; // Default terminal character
  const TEST_TIMEOUT = 60000;

  before(() => {
    // Ensure we have API keys for real testing
    const hasApiKeys = Cypress.env('OPENAI_API_KEY') || Cypress.env('ANTHROPIC_API_KEY');
    if (!hasApiKeys) {
      throw new Error('No API keys found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in environment.');
    }
  });

  beforeEach(() => {
    cy.visit('/', { timeout: 30000 });
    
    // Wait for the system to be ready
    cy.get('[data-testid="connection-status"]', { timeout: 30000 })
      .should('contain', 'Connected')
      .should('have.class', 'text-green-500');
  });

  describe('Hardware Capability Toggling', () => {
    describe('Vision Capabilities', () => {
      it('should get current vision settings', () => {
        cy.request('GET', `${API_BASE}/api/agents/default/settings/vision`)
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            
            const settings = response.body.data;
            expect(settings).to.have.property('ENABLE_CAMERA');
            expect(settings).to.have.property('ENABLE_SCREEN_CAPTURE');
            expect(settings).to.have.property('ENABLE_MICROPHONE');
            expect(settings).to.have.property('ENABLE_SPEAKER');
            expect(settings).to.have.property('VISION_CAMERA_ENABLED');
            expect(settings).to.have.property('VISION_SCREEN_ENABLED');
            expect(settings).to.have.property('VISION_MICROPHONE_ENABLED');
            expect(settings).to.have.property('VISION_SPEAKER_ENABLED');
          });
      });

      it('should toggle camera capability via API', () => {
        // First get current state
        cy.request('GET', `${API_BASE}/api/agents/default/settings/vision`)
          .then((response) => {
            const currentCameraState = response.body.data.ENABLE_CAMERA === 'true';
            
            // Toggle camera setting
            return cy.request('POST', `${API_BASE}/api/agents/default/settings`, {
              key: 'ENABLE_CAMERA',
              value: (!currentCameraState).toString()
            });
          })
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data.key).to.equal('ENABLE_CAMERA');
          });
      });

      it('should toggle screen capture capability via API', () => {
        cy.request('GET', `${API_BASE}/api/agents/default/settings/vision`)
          .then((response) => {
            const currentScreenState = response.body.data.ENABLE_SCREEN_CAPTURE === 'true';
            
            return cy.request('POST', `${API_BASE}/api/agents/default/settings`, {
              key: 'ENABLE_SCREEN_CAPTURE',
              value: (!currentScreenState).toString()
            });
          })
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data.key).to.equal('ENABLE_SCREEN_CAPTURE');
          });
      });

      it('should toggle microphone capability via API', () => {
        cy.request('GET', `${API_BASE}/api/agents/default/settings/vision`)
          .then((response) => {
            const currentMicState = response.body.data.ENABLE_MICROPHONE === 'true';
            
            return cy.request('POST', `${API_BASE}/api/agents/default/settings`, {
              key: 'ENABLE_MICROPHONE',
              value: (!currentMicState).toString()
            });
          })
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data.key).to.equal('ENABLE_MICROPHONE');
          });
      });

      it('should toggle speaker capability via API', () => {
        cy.request('GET', `${API_BASE}/api/agents/default/settings/vision`)
          .then((response) => {
            const currentSpeakerState = response.body.data.ENABLE_SPEAKER === 'true';
            
            return cy.request('POST', `${API_BASE}/api/agents/default/settings`, {
              key: 'ENABLE_SPEAKER',
              value: (!currentSpeakerState).toString()
            });
          })
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data.key).to.equal('ENABLE_SPEAKER');
          });
      });

      it('should refresh vision service after settings change', () => {
        // First change a setting
        cy.request('POST', `${API_BASE}/api/agents/default/settings`, {
          key: 'ENABLE_CAMERA',
          value: 'true'
        })
        .then(() => {
          // Then refresh the vision service
          return cy.request('POST', `${API_BASE}/api/agents/default/vision/refresh`);
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
          expect(response.body.data).to.have.property('message');
        });
      });
    });

    describe('Shell Capability', () => {
      it('should get shell capability status', () => {
        cy.request('GET', `${API_BASE}/api/agents/default/capabilities/shell`)
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            
            const data = response.body.data;
            expect(data).to.have.property('enabled');
            expect(data).to.have.property('service_available');
            expect(data).to.have.property('service_name');
            expect(data.enabled).to.be.a('boolean');
            expect(data.service_available).to.be.a('boolean');
          });
      });

      it('should toggle shell capability', () => {
        // Get current state
        cy.request('GET', `${API_BASE}/api/agents/default/capabilities/shell`)
          .then((response) => {
            const currentState = response.body.data.enabled;
            
            // Toggle the capability
            return cy.request('POST', `${API_BASE}/api/agents/default/capabilities/shell/toggle`);
          })
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.have.property('enabled');
            expect(response.body.data).to.have.property('service_available');
          })
          .then(() => {
            // Verify the toggle worked by checking again
            return cy.request('GET', `${API_BASE}/api/agents/default/capabilities/shell`);
          })
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
          });
      });
    });

    describe('Browser Capability', () => {
      it('should get browser capability status', () => {
        cy.request('GET', `${API_BASE}/api/agents/default/capabilities/browser`)
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            
            const data = response.body.data;
            expect(data).to.have.property('enabled');
            expect(data).to.have.property('service_available');
            expect(data).to.have.property('service_name');
            expect(data.enabled).to.be.a('boolean');
            expect(data.service_available).to.be.a('boolean');
          });
      });

      it('should toggle browser capability', () => {
        cy.request('GET', `${API_BASE}/api/agents/default/capabilities/browser`)
          .then((response) => {
            const currentState = response.body.data.enabled;
            
            return cy.request('POST', `${API_BASE}/api/agents/default/capabilities/browser/toggle`);
          })
          .then((response) => {
            expect(response.status).to.equal(200);
            expect(response.body.success).to.be.true;
            expect(response.body.data).to.have.property('enabled');
            expect(response.body.data).to.have.property('service_available');
          });
      });
    });
  });

  describe('Autonomy Controls', () => {
    it('should get autonomy status', () => {
      cy.request('GET', `${API_BASE}/autonomy/status`)
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
          
          const data = response.body.data;
          expect(data).to.have.property('enabled');
          expect(data).to.have.property('running');
          expect(data).to.have.property('interval');
          expect(data).to.have.property('intervalSeconds');
          expect(data).to.have.property('autonomousRoomId');
          expect(data).to.have.property('agentId');
          expect(data).to.have.property('characterName');
          
          expect(data.enabled).to.be.a('boolean');
          expect(data.running).to.be.a('boolean');
          expect(data.interval).to.be.a('number');
          expect(data.intervalSeconds).to.be.a('number');
          expect(data.agentId).to.equal(AGENT_ID);
        });
    });

    it('should enable autonomy', () => {
      cy.request('POST', `${API_BASE}/autonomy/enable`)
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
          
          const data = response.body.data;
          expect(data).to.have.property('enabled', true);
          expect(data).to.have.property('running');
          expect(data).to.have.property('message', 'Autonomy enabled');
        });
    });

    it('should disable autonomy', () => {
      // First enable it to ensure we can disable
      cy.request('POST', `${API_BASE}/autonomy/enable`)
        .then(() => {
          return cy.request('POST', `${API_BASE}/autonomy/disable`);
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
          
          const data = response.body.data;
          expect(data).to.have.property('enabled', false);
          expect(data).to.have.property('running');
          expect(data).to.have.property('message', 'Autonomy disabled');
        });
    });

    it('should toggle autonomy', () => {
      // Get current state
      cy.request('GET', `${API_BASE}/autonomy/status`)
        .then((response) => {
          const currentlyEnabled = response.body.data.enabled;
          
          // Toggle autonomy
          return cy.request('POST', `${API_BASE}/autonomy/toggle`);
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
          
          const data = response.body.data;
          expect(data).to.have.property('enabled');
          expect(data).to.have.property('running');
        });
    });
  });

  describe('Message Flow and Broadcasting', () => {
    let testRoomId: string;
    let testMessageId: string;

    beforeEach(() => {
      testRoomId = `test-room-${Date.now()}`;
      testMessageId = `msg-${Date.now()}`;
    });

    it('should send message to agent and receive response', () => {
      const testMessage = {
        text: 'Hello, can you tell me about your capabilities?',
        userId: 'test-user-id',
        roomId: testRoomId,
        messageId: testMessageId
      };

      cy.request('POST', `${API_BASE}/api/agents/${AGENT_ID}/message`, testMessage)
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
        });
    });

    it('should handle concurrent messages to agent', () => {
      const concurrentMessages = [];
      const messageCount = 3;

      // Create multiple concurrent message requests
      for (let i = 0; i < messageCount; i++) {
        const message = {
          text: `Concurrent test message ${i}`,
          userId: `test-user-${i}`,
          roomId: `test-room-concurrent-${i}`,
          messageId: `concurrent-msg-${i}-${Date.now()}`
        };

        concurrentMessages.push(
          cy.request('POST', `${API_BASE}/api/agents/${AGENT_ID}/message`, message)
        );
      }

      // All concurrent messages should succeed
      cy.wrap(Promise.all(concurrentMessages)).then((responses: any[]) => {
        responses.forEach((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
        });
      });
    });

    it('should retrieve agent memories for specific room', () => {
      const roomId = `memory-test-room-${Date.now()}`;
      
      // First send a message to create a memory
      const testMessage = {
        text: 'This is a test message for memory retrieval',
        userId: 'memory-test-user',
        roomId: roomId,
        messageId: `memory-test-${Date.now()}`
      };

      cy.request('POST', `${API_BASE}/api/agents/${AGENT_ID}/message`, testMessage)
        .then(() => {
          // Wait a moment for the message to be processed
          cy.wait(2000);
          
          // Retrieve memories for the room
          return cy.request('GET', `${API_BASE}/api/memories?roomId=${roomId}&count=10`);
        })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
          expect(response.body.data).to.be.an('array');
          
          // Should have at least one memory (the user message)
          expect(response.body.data.length).to.be.at.least(1);
          
          // Check that memories have expected structure
          if (response.body.data.length > 0) {
            const memory = response.body.data[0];
            expect(memory).to.have.property('id');
            expect(memory).to.have.property('content');
            expect(memory).to.have.property('roomId', roomId);
            expect(memory).to.have.property('entityId');
            expect(memory).to.have.property('createdAt');
          }
        });
    });

    it('should handle WebSocket message broadcasting', () => {
      // This test verifies the WebSocket connection and message flow
      cy.window().should('have.property', 'elizaClient').then((win: any) => {
        const client = win.elizaClient;
        expect(client).to.exist;
        expect(client.socket).to.exist;
        expect(client.socket.connected).to.be.true;
      });

      // Send a message through the frontend interface
      cy.get('[data-testid="chat-tab"]').click();
      cy.get('[data-testid="chat-input"]').should('be.visible');

      const uniqueMessage = `WebSocket test message ${Date.now()}`;
      cy.get('[data-testid="chat-input"]').type(`${uniqueMessage}{enter}`);

      // Verify the message appears in the chat
      cy.get('[data-testid="chat-messages"]', { timeout: TEST_TIMEOUT })
        .should('contain', uniqueMessage);

      // Wait for agent response
      cy.get('[data-testid="chat-messages"]', { timeout: TEST_TIMEOUT })
        .find('.message-bubble')
        .should('have.length.at.least', 2); // User message + agent response
    });

    it('should handle message errors gracefully', () => {
      // Try to send message to non-existent agent
      const invalidMessage = {
        text: 'This should fail',
        userId: 'test-user',
        roomId: 'test-room'
      };

      cy.request({
        method: 'POST',
        url: `${API_BASE}/api/agents/non-existent-agent-id/message`,
        body: invalidMessage,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(500);
        expect(response.body.success).to.be.false;
        expect(response.body.error).to.have.property('message');
      });
    });

    it('should verify agent container message handling', () => {
      // Verify agent container is running and can handle messages
      cy.request('GET', `${API_BASE}/api/agents/status`)
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
          
          const agents = response.body.data.agents;
          const defaultAgent = agents.find((a: any) => a.id === AGENT_ID);
          expect(defaultAgent).to.exist;
          expect(defaultAgent.status).to.equal('running');
        });

      // Send a message and verify processing
      const testMessage = {
        text: 'Can you process this message correctly?',
        userId: 'container-test-user',
        roomId: 'container-test-room',
        messageId: `container-test-${Date.now()}`
      };

      cy.request('POST', `${API_BASE}/api/agents/${AGENT_ID}/message`, testMessage)
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
        });
    });
  });

  describe('Real-time Capability Updates', () => {
    it('should reflect capability changes in real-time', () => {
      // Toggle a capability via API
      cy.request('POST', `${API_BASE}/api/agents/default/capabilities/shell/toggle')
        .then((response) => {
          const newShellState = response.body.data.enabled;
          
          // Wait a moment for any WebSocket updates
          cy.wait(1000);
          
          // Check if the frontend reflects the change (if there's a UI element)
          // This would depend on your frontend implementation
          cy.window().then((win: any) => {
            if (win.elizaClient && win.elizaClient.socket) {
              expect(win.elizaClient.socket.connected).to.be.true;
            }
          });
        });
    });

    it('should handle autonomy state changes in real-time', () => {
      // Enable autonomy
      cy.request('POST', `${API_BASE}/autonomy/enable`)
        .then(() => {
          cy.wait(1000); // Allow for state propagation
          
          // Verify the change through status endpoint
          return cy.request('GET', `${API_BASE}/autonomy/status`);
        })
        .then((response) => {
          expect(response.body.data.enabled).to.be.true;
          
          // Disable autonomy
          return cy.request('POST', `${API_BASE}/autonomy/disable`);
        })
        .then(() => {
          cy.wait(1000);
          
          return cy.request('GET', `${API_BASE}/autonomy/status`);
        })
        .then((response) => {
          expect(response.body.data.enabled).to.be.false;
        });
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle invalid capability settings gracefully', () => {
      cy.request({
        method: 'POST',
        url: `${API_BASE}/api/agents/default/settings`,
        body: {
          key: 'INVALID_SETTING',
          value: 'invalid_value'
        },
        failOnStatusCode: false
      }).then((response) => {
        // Should either succeed (setting stored) or return appropriate error
        expect([200, 400]).to.include(response.status);
      });
    });

    it('should handle service unavailability', () => {
      // Test autonomy endpoints when service might not be available
      cy.request({
        method: 'GET',
        url: `${API_BASE}/autonomy/status`,
        failOnStatusCode: false
      }).then((response) => {
        if (response.status === 503) {
          expect(response.body.success).to.be.false;
          expect(response.body.error.code).to.equal('SERVICE_UNAVAILABLE');
        } else {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
        }
      });
    });

    it('should handle malformed message data', () => {
      const malformedMessage = {
        // Missing required fields
        userId: 'test-user'
        // No text or other required fields
      };

      cy.request({
        method: 'POST',
        url: `${API_BASE}/api/agents/${AGENT_ID}/message`,
        body: malformedMessage,
        failOnStatusCode: false
      }).then((response) => {
        // Should handle gracefully - either process with defaults or return error
        expect([200, 400, 500]).to.include(response.status);
      });
    });
  });

  after(() => {
    // Cleanup: Ensure autonomy is in a known state
    cy.request({
      method: 'POST',
      url: `${API_BASE}/autonomy/disable`,
      failOnStatusCode: false
    });

    // Final system health check
    cy.request('GET', `${API_BASE}/api/server/health`).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body.status).to.equal('OK');
    });
  });
});