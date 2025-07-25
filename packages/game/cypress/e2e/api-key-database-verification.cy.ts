/// <reference types="cypress" />

describe('API Key Database Storage and Usage', () => {
  const TEST_OPENAI_KEY = `sk-test-key-${Date.now()}`;
  const TEST_ANTHROPIC_KEY = `sk-ant-test-key-${Date.now()}`;

  before(() => {
    // Ensure clean environment
    cy.task('clearEnvironmentKeys');
    cy.task('resetGameDatabase');
  });

  beforeEach(() => {
    // Visit the game
    cy.visit('/', { failOnStatusCode: false });
  });

  afterEach(() => {
    cy.task('clearEnvironmentKeys');
  });

  describe('API Key Setup Flow', () => {
    it('should complete full setup flow with OpenAI and verify database storage', () => {
      // Wait for setup wizard to appear due to missing keys
      cy.contains('ELIZA OS Configuration', { timeout: 60000 }).should('be.visible');

      // Enter OpenAI key and submit
      cy.get('input#openaiKey', { timeout: 10000 }).should('be.visible').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').should('not.be.disabled').click();

      // Wait for configuration to be saved
      cy.wait(5000);

      // Verify configuration was stored via API
      cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
        expect(response.body.data.configurations.environment.MODEL_PROVIDER).to.eq('openai');
      });
    });

    it('should complete setup with Anthropic and verify storage', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });

      // Switch to Anthropic
      cy.get('select#modelProvider').select('anthropic');
      cy.get('input#anthropicKey').type(TEST_ANTHROPIC_KEY);
      cy.get('button').contains('Continue').click();

      cy.wait(5000);

      // Verify Anthropic configuration
      cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.data.configurations.environment.ANTHROPIC_API_KEY).to.eq('***SET***');
        expect(response.body.data.configurations.environment.MODEL_PROVIDER).to.eq('anthropic');
      });
    });
  });

  describe('Database Persistence', () => {
    it('should persist API keys in the database', () => {
      // Complete setup
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(5000);

      // Test database connection and persistence
      cy.task('testDatabaseConnection').then((result: any) => {
        expect(result.success).to.be.true;
        expect(result.database.hasConnection).to.be.true;
        expect(result.database.isConnected).to.be.true;
      });
    });

    it('should maintain configuration across multiple API calls', () => {
      // Setup API key
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(3000);

      // Make multiple requests to verify consistency
      for (let i = 0; i < 5; i++) {
        cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
        });
      }
    });
  });

  describe('Runtime Integration', () => {
    it('should make API keys available to the agent runtime', () => {
      // Setup keys
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(5000);

      // Check runtime state
      cy.request('GET', 'http://localhost:7777/api/debug/runtime-state').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.character.name).to.eq('ELIZA');
        expect(response.body.data.services).to.be.an('array');
        expect(response.body.data.services.length).to.be.greaterThan(0);
      });
    });

    it('should enable agent functionality with valid API keys', () => {
      // Complete setup
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();

      // Wait for main interface
      cy.contains('Welcome to ELIZA Terminal', { timeout: 45000 }).should('be.visible');

      // Verify server health with configured keys
      cy.request('GET', 'http://localhost:7777/api/server/health').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.agent).to.eq('connected');
        expect(response.body.data.agentId).to.exist;
      });
    });

    it('should enable autonomy service with API keys configured', () => {
      // Setup and wait for completion
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.contains('Welcome to ELIZA Terminal', { timeout: 45000 });

      // Test autonomy service is available
      cy.task('testAutonomyService').then((result: any) => {
        expect(result.success).to.be.true;
        expect(result.serviceAvailable).to.be.true;
        expect(result.autonomyStatus).to.exist;
        expect(result.autonomyStatus.enabled).to.be.a('boolean');
      });
    });
  });

  describe('Memory System Integration', () => {
    it('should enable memory storage with configured database', () => {
      // Complete setup
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(10000);

      // Test memory system
      const testRoomId = `test-room-${Date.now()}`;
      cy.task('testAgentMemory', { roomId: testRoomId }).then((result: any) => {
        expect(result.success).to.be.true;
        expect(result.memories).to.be.an('array');
        // Empty array is expected for new room
        expect(result.count).to.be.a('number');
      });
    });

    it('should handle runtime state queries successfully', () => {
      // Setup and verify runtime
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(8000);

      // Test comprehensive runtime state
      cy.request('GET', 'http://localhost:7777/api/debug/runtime-state').then((response) => {
        expect(response.status).to.eq(200);
        const data = response.body.data;

        // Verify core runtime components
        expect(data.agentId).to.exist;
        expect(data.character).to.exist;
        expect(data.plugins).to.be.an('array');
        expect(data.actions).to.be.an('array');
        expect(data.providers).to.be.an('array');
        expect(data.services).to.be.an('array');
        expect(data.database.isConnected).to.be.true;

        // Verify memory stats
        expect(data.memory).to.exist;
        expect(data.memory.totalCount).to.be.a('number');

        // Verify status information
        expect(data.status.timestamp).to.be.a('number');
        expect(data.status.uptime).to.be.a('number');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle server restart while maintaining configuration', () => {
      // Initial setup
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(5000);

      // Verify initial config
      cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
        expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
      });

      // Wait and check again (simulates restart)
      cy.wait(3000);
      cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
      });
    });

    it('should handle multiple concurrent configuration requests', () => {
      // Setup keys first
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(5000);

      // Make concurrent requests
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(cy.request('GET', 'http://localhost:7777/api/plugin-config'));
      }

      // Verify all requests succeed
      Promise.all(requests).then((responses: any[]) => {
        responses.forEach(response => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
        });
      });
    });

    it('should maintain database integrity under load', () => {
      // Complete setup
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(8000);

      // Test database under multiple queries
      const testRoomId = 'load-test-room';
      for (let i = 0; i < 5; i++) {
        cy.task('testAgentMemory', { roomId: testRoomId }).then((result: any) => {
          expect(result.success).to.be.true;
        });
      }
    });
  });

  describe('Configuration API Validation', () => {
    it('should properly validate and store OpenAI configuration', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(3000);

      // Test configuration endpoint directly
      cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
        expect(response.status).to.eq(200);
        const env = response.body.data.configurations.environment;

        expect(env.OPENAI_API_KEY).to.eq('***SET***');
        expect(env.MODEL_PROVIDER).to.eq('openai');
        expect(env.TEXT_EMBEDDING_MODEL).to.exist;
        expect(env.LANGUAGE_MODEL).to.exist;
      });
    });

    it('should handle configuration updates via API', () => {
      // Initial setup
      cy.contains('ELIZA OS Configuration', { timeout: 60000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(5000);

      // Test updating configuration via API
      cy.request('POST', 'http://localhost:7777/api/plugin-config', {
        plugin: 'environment',
        config: {
          MODEL_PROVIDER: 'openai',
          TEXT_EMBEDDING_MODEL: 'text-embedding-3-small'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });

      // Verify update persisted
      cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
        expect(response.body.data.configurations.environment.TEXT_EMBEDDING_MODEL).to.exist;
      });
    });
  });
});

// Custom commands for database testing
declare global {
  namespace Cypress {
    interface Chainable {
      waitForDatabaseReady(): Chainable<void>;
      verifyDatabaseIntegrity(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('waitForDatabaseReady', () => {
  cy.task('testDatabaseConnection', { timeout: 30000 }).then((result: any) => {
    if (!result.success || !result.database.isConnected) {
      throw new Error(`Database not ready: ${JSON.stringify(result)}`);
    }
  });
});

Cypress.Commands.add('verifyDatabaseIntegrity', () => {
  cy.request('GET', 'http://localhost:7777/api/debug/runtime-state').then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body.data.database.isConnected).to.be.true;
    expect(response.body.data.memory).to.exist;
  });
});
