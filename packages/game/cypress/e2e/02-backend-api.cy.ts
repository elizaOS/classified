/// <reference types="cypress" />

/**
 * Backend API Tests
 * Tests all backend API endpoints, health checks, and error handling
 */

describe('Backend API', () => {
  const BACKEND_URL = Cypress.env('BACKEND_URL') || 'http://localhost:7777';
  const DEFAULT_AGENT_ID = '15aec527-fb92-0792-91b6-becd4fac5050';

  before(() => {
    // Ensure backend is ready
    cy.waitForBackend();
  });

  describe('Health Check Endpoints', () => {
    it('should verify server health endpoint', () => {
      cy.request({
        method: 'GET',
        url: `${BACKEND_URL}/api/server/health`,
        timeout: 10000,
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.have.property('status', 'healthy');
        expect(response.body.data).to.have.property('agent', 'connected');
        expect(response.body.data).to.have.property('agentId');
        expect(response.body.data).to.have.property('version');
        expect(response.body.data).to.have.property('timestamp');

        // Validate agent ID format
        expect(response.body.data.agentId).to.match(/^[0-9a-f-]{36}$/);

        cy.log('✅ Server health check passed');
        cy.log(`Agent ID: ${response.body.data.agentId}`);
        cy.log(`Version: ${response.body.data.version}`);
      });
    });

    it('should check agent status endpoint', () => {
      cy.request('GET', `${BACKEND_URL}/api/agents/status`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.have.property('agents');
        expect(response.body.data.agents).to.be.an('array');

        // Should have at least one agent (default)
        expect(response.body.data.agents.length).to.be.at.least(1);

        const defaultAgent = response.body.data.agents.find((a) => a.id === DEFAULT_AGENT_ID);
        if (defaultAgent) {
          expect(defaultAgent.status).to.eq('running');
          expect(defaultAgent.name).to.exist;
        }
      });
    });
  });

  describe('Plugin Configuration API', () => {
    it('should get plugin configuration', () => {
      cy.request('GET', `${BACKEND_URL}/api/plugin-config`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data).to.have.property('configurations');
        expect(response.body.data).to.have.property('availablePlugins');

        // Check environment configuration
        const env = response.body.data.configurations.environment;
        expect(env).to.have.property('MODEL_PROVIDER');
        expect(env).to.have.property('LANGUAGE_MODEL');
        expect(env).to.have.property('TEXT_EMBEDDING_MODEL');

        // Check available plugins
        expect(response.body.data.availablePlugins).to.be.an('array');
        expect(response.body.data.availablePlugins.length).to.be.greaterThan(0);

        cy.log(`✅ ${response.body.data.availablePlugins.length} plugins available`);
      });
    });

    it('should update plugin configuration', () => {
      const testConfig = {
        plugin: 'environment',
        config: {
          TEST_SETTING: `test_value_${Date.now()}`,
          TEXT_EMBEDDING_MODEL: 'text-embedding-3-small',
        },
      };

      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/plugin-config`,
        body: testConfig,
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;

        // Verify the update persisted
        cy.request('GET', `${BACKEND_URL}/api/plugin-config`).then((getResponse) => {
          const env = getResponse.body.data.configurations.environment;
          expect(env.TEST_SETTING).to.eq(testConfig.config.TEST_SETTING);
          expect(env.TEXT_EMBEDDING_MODEL).to.eq(testConfig.config.TEXT_EMBEDDING_MODEL);
        });
      });
    });
  });

  describe('Agent Runtime State API', () => {
    it('should get runtime state', () => {
      cy.request('GET', `${BACKEND_URL}/api/debug/runtime-state`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;

        const data = response.body.data;

        // Verify agent information
        expect(data).to.have.property('agentId');
        expect(data).to.have.property('character');
        expect(data.character).to.have.property('name', 'ELIZA');

        // Verify plugins loaded
        expect(data).to.have.property('plugins');
        expect(data.plugins).to.be.an('array').with.length.greaterThan(0);

        // Verify actions and providers
        expect(data).to.have.property('actions');
        expect(data.actions).to.be.an('array').with.length.greaterThan(0);
        expect(data).to.have.property('providers');
        expect(data.providers).to.be.an('array').with.length.greaterThan(0);

        // Verify services
        expect(data).to.have.property('services');
        expect(data.services).to.be.an('array').with.length.greaterThan(0);

        // Verify database connection
        expect(data).to.have.property('database');
        expect(data.database).to.have.property('isConnected', true);
        expect(data.database).to.have.property('hasConnection', true);

        // Verify memory stats
        expect(data).to.have.property('memory');
        expect(data.memory).to.have.property('totalCount');
        expect(data.memory.totalCount).to.be.a('number');

        // Verify status
        expect(data).to.have.property('status');
        expect(data.status).to.have.property('timestamp');
        expect(data.status).to.have.property('uptime');

        cy.log('✅ Runtime state verified');
        cy.log(`Plugins: ${data.plugins.length}`);
        cy.log(`Actions: ${data.actions.length}`);
        cy.log(`Services: ${data.services.length}`);
      });
    });
  });

  describe('Memory System API', () => {
    const testRoomId = `test-room-${Date.now()}`;
    let memoryId: string;

    it('should create and retrieve memories', () => {
      // First send a message to create memory
      const message = {
        text: `Test message for memory API ${Date.now()}`,
        userId: 'test-user',
        roomId: testRoomId,
        messageId: `msg-${Date.now()}`,
      };

      cy.request('POST', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`, message)
        .then(() => {
          cy.wait(2000); // Allow processing

          // Retrieve memories
          return cy.request('GET', `${BACKEND_URL}/api/memories?roomId=${testRoomId}&count=10`);
        })
        .then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
          expect(response.body.data).to.be.an('array');
          expect(response.body.data.length).to.be.at.least(1);

          // Verify memory structure
          const memory = response.body.data[0];
          expect(memory).to.have.property('id');
          expect(memory).to.have.property('content');
          expect(memory).to.have.property('roomId', testRoomId);
          expect(memory).to.have.property('entityId');
          expect(memory).to.have.property('createdAt');

          memoryId = memory.id;
          cy.log(`✅ Created memory: ${memoryId}`);
        });
    });

    it('should retrieve agent-specific memories', () => {
      cy.request('GET', `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/memories?count=5`).then(
        (response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
          expect(response.body.data).to.be.an('array');

          if (response.body.data.length > 0) {
            const memory = response.body.data[0];
            expect(memory).to.have.property('id');
            expect(memory).to.have.property('content');
            expect(memory).to.have.property('entityId');
          }

          cy.log(`✅ Retrieved ${response.body.data.length} agent memories`);
        }
      );
    });

    it('should handle memory pagination', () => {
      cy.request('GET', `${BACKEND_URL}/api/memories?roomId=${testRoomId}&count=5&page=1`).then(
        (response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
          expect(response.body.data).to.be.an('array');
          expect(response.body.data.length).to.be.lte(5);
        }
      );
    });
  });

  describe('Goals and Todos API', () => {
    it('should retrieve goals', () => {
      cy.request('GET', `${BACKEND_URL}/api/goals`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body).to.have.property('goals');
        expect(response.body.goals).to.be.an('array');

        cy.log(`✅ Retrieved ${response.body.goals.length} goals`);

        if (response.body.goals.length > 0) {
          const goal = response.body.goals[0];
          expect(goal).to.have.property('id');
          expect(goal).to.have.property('name');
          expect(goal).to.have.property('status');
        }
      });
    });

    it('should retrieve todos', () => {
      cy.request('GET', `${BACKEND_URL}/api/todos`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body).to.have.property('todos');
        expect(response.body.todos).to.be.an('array');

        cy.log(`✅ Retrieved ${response.body.todos.length} todos`);

        if (response.body.todos.length > 0) {
          const todo = response.body.todos[0];
          expect(todo).to.have.property('id');
          expect(todo).to.have.property('content');
          expect(todo).to.have.property('status');
        }
      });
    });

    it('should retrieve monologue thoughts', () => {
      cy.request('GET', `${BACKEND_URL}/api/monologue`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body).to.have.property('thoughts');
        expect(response.body.thoughts).to.be.an('array');

        cy.log(`✅ Retrieved ${response.body.thoughts.length} thoughts`);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', () => {
      cy.request({
        method: 'GET',
        url: `${BACKEND_URL}/api/non-existent-endpoint`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });

    it('should handle invalid agent ID', () => {
      cy.request({
        method: 'GET',
        url: `${BACKEND_URL}/api/agents/invalid-agent-id/memories`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 404, 500]);
        expect(response.body.success).to.be.false;
      });
    });

    it('should handle malformed JSON', () => {
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/plugin-config`,
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 500]);
      });
    });

    it('should handle missing required fields', () => {
      cy.request({
        method: 'POST',
        url: `${BACKEND_URL}/api/agents/${DEFAULT_AGENT_ID}/message`,
        body: {
          // Missing required fields
          userId: 'test-user',
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect([200, 400, 500]).to.include(response.status);
      });
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent health checks', () => {
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(cy.request('GET', `${BACKEND_URL}/api/server/health`));
      }

      cy.wrap(Promise.all(requests)).then((responses: any[]) => {
        responses.forEach((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
          expect(response.body.data.status).to.eq('healthy');
        });

        cy.log(`✅ Handled ${requests.length} concurrent requests successfully`);
      });
    });

    it('should handle concurrent configuration reads', () => {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(cy.request('GET', `${BACKEND_URL}/api/plugin-config`));
      }

      cy.wrap(Promise.all(requests)).then((responses: any[]) => {
        // All responses should be consistent
        const firstResponse = responses[0];
        responses.forEach((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
          // Configuration should be the same across all requests
          expect(response.body.data.configurations.environment.MODEL_PROVIDER).to.eq(
            firstResponse.body.data.configurations.environment.MODEL_PROVIDER
          );
        });
      });
    });
  });

  describe('API Performance', () => {
    it('should respond to health checks quickly', () => {
      const startTime = Date.now();

      cy.request('GET', `${BACKEND_URL}/api/server/health`).then((response) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        expect(response.status).to.eq(200);
        expect(responseTime).to.be.lessThan(1000); // Should respond in less than 1 second

        cy.log(`✅ Health check response time: ${responseTime}ms`);
      });
    });

    it('should handle rapid sequential requests', () => {
      const promises = [];
      const startTime = Date.now();

      // Send 20 rapid requests
      for (let i = 0; i < 20; i++) {
        promises.push(cy.request('GET', `${BACKEND_URL}/api/server/health`));
      }

      cy.wrap(Promise.all(promises)).then((responses: any[]) => {
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // All should succeed
        responses.forEach((response) => {
          expect(response.status).to.eq(200);
        });

        cy.log(`✅ Handled 20 requests in ${totalTime}ms`);
        cy.log(`Average: ${Math.round(totalTime / 20)}ms per request`);
      });
    });
  });
});

// API Summary Test
describe('Backend API Summary', () => {
  it('should verify all critical endpoints are functional', () => {
    const BACKEND_URL = Cypress.env('BACKEND_URL') || 'http://localhost:7777';
    const criticalEndpoints = [
      { name: 'Health', url: '/api/server/health' },
      { name: 'Plugin Config', url: '/api/plugin-config' },
      { name: 'Runtime State', url: '/api/debug/runtime-state' },
      { name: 'Goals', url: '/api/goals' },
      { name: 'Todos', url: '/api/todos' },
      { name: 'Monologue', url: '/api/monologue' },
      { name: 'Agent Status', url: '/api/agents/status' },
    ];

    const results = [];

    // Test all endpoints
    criticalEndpoints.forEach((endpoint) => {
      cy.request({
        method: 'GET',
        url: `${BACKEND_URL}${endpoint.url}`,
        failOnStatusCode: false,
      }).then((response) => {
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          status: response.status,
          success: response.status === 200,
        });
      });
    });

    cy.then(() => {
      cy.log('🎯 BACKEND API VERIFICATION SUMMARY:');

      const successCount = results.filter((r) => r.success).length;
      const totalCount = results.length;

      results.forEach((result) => {
        const icon = result.success ? '✅' : '❌';
        cy.log(`${icon} ${result.name}: ${result.status}`);
      });

      cy.log(`\n✅ ${successCount}/${totalCount} endpoints functional`);

      // All critical endpoints should be working
      expect(successCount).to.eq(totalCount);

      cy.screenshot('backend-api-summary');
    });
  });
});
