/**
 * System Integration Test - Comprehensive E2E
 *
 * Tests the complete ELIZA game system including:
 * - Container startup and health
 * - Database connectivity
 * - Agent lifecycle
 * - API endpoints
 * - WebSocket communication
 * - Frontend integration
 */

describe('ELIZA Game System Integration', () => {
  const API_BASE = 'http://localhost:7777';
  const TEST_TIMEOUT = 60000;

  before(() => {
    // Ensure we have API keys for real LLM testing
    const hasApiKeys = Cypress.env('OPENAI_API_KEY') || Cypress.env('ANTHROPIC_API_KEY');
    if (!hasApiKeys) {
      throw new Error('No API keys found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in environment.');
    }
  });

  beforeEach(() => {
    cy.visit('/', { timeout: 30000 });
  });

  describe('Infrastructure', () => {
    it('should have healthy server status', () => {
      cy.request('GET', `${API_BASE}/api/server/health`).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('status', 'OK');
        expect(response.body).to.have.property('server', 'game-backend-infrastructure');
        expect(response.body.dependencies).to.deep.include({
          database: 'healthy',
          containers: 'healthy',
        });
      });
    });

    it('should have PostgreSQL container running', () => {
      cy.request('GET', `${API_BASE}/api/containers/status`).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;

        const postgres = response.body.data['eliza-postgres'];
        expect(postgres).to.exist;
        expect(postgres.state).to.equal('running');
        expect(postgres.health).to.equal('healthy');
      });
    });

    it('should detect Ollama availability', () => {
      cy.request('GET', `${API_BASE}/api/server/health`).then((response) => {
        const ollama = response.body.ollama;
        expect(ollama).to.exist;

        // Ollama might not be available in all test environments
        if (ollama.available) {
          expect(ollama).to.have.property('models');
          expect(ollama.models).to.be.an('array');
        }
      });
    });
  });

  describe('Agent Management', () => {
    let testAgentId: string;

    it('should start a new agent', () => {
      testAgentId = `test-agent-${Date.now()}`;

      cy.request('POST', `${API_BASE}/api/agents/start`, {
        agentId: testAgentId,
      }).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.have.property('agentId', testAgentId);
      });
    });

    it('should list running agents', () => {
      cy.request('GET', `${API_BASE}/api/agents/status`).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;

        const agents = response.body.data.agents;
        expect(agents).to.be.an('array');
        expect(agents.length).to.be.at.least(1);

        // Default agent should be running
        const defaultAgent = agents.find(
          (a: any) => a.id === '15aec527-fb92-0792-91b6-becd4fac5050'
        );
        expect(defaultAgent).to.exist;
        expect(defaultAgent.status).to.equal('running');
      });
    });

    it('should send message to agent', () => {
      const message = {
        text: 'Hello, can you help me understand what ELIZA is?',
        userId: 'test-user',
        roomId: 'test-room',
      };

      cy.request('POST', `${API_BASE}/api/agents/${testAgentId}/message`, message).then(
        (response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
        }
      );
    });

    after(() => {
      // Cleanup test agent
      if (testAgentId) {
        cy.request('POST', `${API_BASE}/api/agents/${testAgentId}/stop`);
      }
    });
  });

  describe('Authentication', () => {
    it('should handle login flow', () => {
      cy.request({
        method: 'POST',
        url: `${API_BASE}/api/auth/login`,
        body: {
          username: 'admin',
          password: 'admin123',
        },
        failOnStatusCode: false,
      }).then((response) => {
        // Auth might not be configured in test environment
        if (response.status === 200) {
          expect(response.body.success).to.be.true;
          expect(response.body.data).to.have.property('token');
          expect(response.body.data.user).to.have.property('username', 'admin');
        } else {
          expect(response.status).to.equal(401);
        }
      });
    });

    it('should handle logout', () => {
      cy.request('POST', `${API_BASE}/api/auth/logout`).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
      });
    });
  });

  describe('Plugin Configuration', () => {
    it('should accept environment configuration', () => {
      cy.request('POST', `${API_BASE}/api/plugin-config`, {
        plugin: 'environment',
        config: {
          TEST_ENV_VAR: `test-value-${Date.now()}`,
        },
      }).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.plugin).to.equal('environment');
      });
    });
  });

  describe('Frontend Integration', () => {
    it('should connect to WebSocket', () => {
      cy.window().should('have.property', 'elizaClient');
      cy.get('[data-testid="connection-status"]', { timeout: 30000 })
        .should('contain', 'Connected')
        .should('have.class', 'text-green-500');
    });

    it('should display boot sequence', () => {
      // Boot sequence should complete
      cy.get('[data-testid="boot-status"]', { timeout: 30000 }).should('contain', 'READY');
    });

    it('should show agent monologue', () => {
      cy.get('[data-testid="monologue-tab"]').click();
      cy.get('[data-testid="monologue-content"]', { timeout: 10000 })
        .should('be.visible')
        .should('not.be.empty');
    });

    it('should enable chat interaction', () => {
      cy.get('[data-testid="chat-tab"]').click();
      cy.get('[data-testid="chat-input"]').should('be.visible');

      // Send a test message
      cy.get('[data-testid="chat-input"]').type('Hello ELIZA, what are you?{enter}');

      // Wait for response
      cy.get('[data-testid="chat-messages"]', { timeout: TEST_TIMEOUT })
        .find('.message-bubble')
        .should('have.length.at.least', 2);
    });
  });

  describe('Data Persistence', () => {
    it('should persist messages across page reload', () => {
      // Send a unique message
      const uniqueMessage = `Test persistence ${Date.now()}`;

      cy.get('[data-testid="chat-tab"]').click();
      cy.get('[data-testid="chat-input"]').type(`${uniqueMessage}{enter}`);

      // Wait for message to appear
      cy.get('[data-testid="chat-messages"]').should('contain', uniqueMessage);

      // Reload page
      cy.reload();

      // Message should still be there
      cy.get('[data-testid="chat-tab"]').click();
      cy.get('[data-testid="chat-messages"]', { timeout: 10000 }).should('contain', uniqueMessage);
    });
  });

  describe('Error Handling', () => {
    it('should handle network disconnection gracefully', () => {
      // Intercept WebSocket to simulate disconnect
      cy.window().then((win) => {
        const client = (win as any).elizaClient;
        if (client && client.socket) {
          client.socket.disconnect();
        }
      });

      // Should show disconnected status
      cy.get('[data-testid="connection-status"]', { timeout: 5000 })
        .should('contain', 'Disconnected')
        .should('have.class', 'text-red-500');

      // Should attempt to reconnect
      cy.get('[data-testid="connection-status"]', { timeout: 30000 })
        .should('contain', 'Connected')
        .should('have.class', 'text-green-500');
    });

    it('should show error when agent is unavailable', () => {
      // Try to message a non-existent agent
      cy.request({
        method: 'POST',
        url: `${API_BASE}/api/agents/non-existent-agent/message`,
        body: { text: 'Hello' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.equal(500);
        expect(response.body.success).to.be.false;
        expect(response.body.error).to.have.property('message');
      });
    });
  });

  describe('Performance', () => {
    it('should load frontend quickly', () => {
      cy.visit('/', {
        onBeforeLoad: (win) => {
          win.performance.mark('start');
        },
        onLoad: (win) => {
          win.performance.mark('end');
          win.performance.measure('pageLoad', 'start', 'end');

          const measure = win.performance.getEntriesByName('pageLoad')[0];
          expect(measure.duration).to.be.lessThan(3000); // 3 seconds
        },
      });
    });

    it('should handle concurrent agent messages', () => {
      const promises = [];

      // Send 5 concurrent messages
      for (let i = 0; i < 5; i++) {
        promises.push(
          cy.request(
            'POST',
            `${API_BASE}/api/agents/15aec527-fb92-0792-91b6-becd4fac5050/message`,
            {
              text: `Concurrent message ${i}`,
              userId: `user-${i}`,
              roomId: 'concurrent-test',
            }
          )
        );
      }

      // All should succeed
      Promise.all(promises).then((responses) => {
        responses.forEach((response) => {
          expect(response.status).to.equal(200);
          expect(response.body.success).to.be.true;
        });
      });
    });
  });

  after(() => {
    // Final health check
    cy.request('GET', `${API_BASE}/api/server/health`).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body.status).to.equal('OK');
    });
  });
});
