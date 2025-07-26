/// <reference types="cypress" />

/**
 * Setup and Configuration Tests
 * Tests API key setup wizard, configuration persistence, and database storage
 */

describe('Setup and Configuration', () => {
  const TEST_OPENAI_KEY = `sk-test-openai-${Date.now()}`;
  const TEST_ANTHROPIC_KEY = `sk-ant-test-anthropic-${Date.now()}`;
  const BACKEND_URL = Cypress.env('BACKEND_URL') || 'http://localhost:7777';
  const FRONTEND_URL = Cypress.env('FRONTEND_URL') || 'http://localhost:5173';

  beforeEach(() => {
    // Clear any existing configuration
    cy.task('clearEnvironmentKeys');
    
    // Skip boot sequence for faster testing
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });

    // Visit the application
    cy.visit('/');
  });

  afterEach(() => {
    // Clean up test keys
    cy.task('clearEnvironmentKeys');
  });

  describe('API Key Setup Wizard', () => {
    it('should detect missing API keys and show setup wizard', () => {
      // Wait for the setup wizard to appear
      cy.contains('ELIZA OS Configuration', { timeout: 40000 }).should('be.visible');
      cy.contains('Configure your AI model settings to begin').should('be.visible');
      
      // Verify form elements
      cy.get('select#modelProvider').should('be.visible').should('have.value', 'openai');
      cy.get('input#openaiKey').should('be.visible').should('have.attr', 'type', 'password');
      cy.get('button').contains('Continue').should('be.visible').should('be.disabled');
      cy.get('button').contains('Skip (Use Existing)').should('be.visible').should('not.be.disabled');
      
      cy.screenshot('setup-wizard-initial');
    });

    it('should allow switching between OpenAI and Anthropic providers', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      
      // Verify OpenAI is selected by default
      cy.get('select#modelProvider').should('have.value', 'openai');
      cy.get('input#openaiKey').should('be.visible');
      cy.get('input#anthropicKey').should('not.exist');
      
      // Switch to Anthropic
      cy.get('select#modelProvider').select('anthropic');
      cy.get('input#anthropicKey').should('be.visible');
      cy.get('input#openaiKey').should('not.exist');
      
      // Switch back to OpenAI
      cy.get('select#modelProvider').select('openai');
      cy.get('input#openaiKey').should('be.visible');
      cy.get('input#anthropicKey').should('not.exist');
      
      cy.screenshot('provider-switching');
    });

    it('should validate API key input and enable continue button', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      
      // Continue button should be disabled with empty input
      cy.get('button').contains('Continue').should('be.disabled');
      
      // Type API key
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      
      // Continue button should now be enabled
      cy.get('button').contains('Continue').should('not.be.disabled');
      
      // Clear the input
      cy.get('input#openaiKey').clear();
      
      // Continue button should be disabled again
      cy.get('button').contains('Continue').should('be.disabled');
    });
  });

  describe('Configuration Storage', () => {
    it('should save OpenAI configuration to database', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      
      // Enter OpenAI key and submit
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      
      // Wait for configuration to be saved
      cy.wait(3000);
      
      // Verify configuration via API
      cy.request('GET', `${BACKEND_URL}/api/plugin-config`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
        expect(response.body.data.configurations.environment.MODEL_PROVIDER).to.eq('openai');
      });
      
      cy.screenshot('openai-config-saved');
    });

    it('should save Anthropic configuration to database', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      
      // Switch to Anthropic and enter key
      cy.get('select#modelProvider').select('anthropic');
      cy.get('input#anthropicKey').type(TEST_ANTHROPIC_KEY);
      cy.get('button').contains('Continue').click();
      
      // Wait for configuration to be saved
      cy.wait(3000);
      
      // Verify configuration via API
      cy.request('GET', `${BACKEND_URL}/api/plugin-config`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.data.configurations.environment.ANTHROPIC_API_KEY).to.eq('***SET***');
        expect(response.body.data.configurations.environment.MODEL_PROVIDER).to.eq('anthropic');
      });
      
      cy.screenshot('anthropic-config-saved');
    });

    it('should persist configuration across page reloads', () => {
      // First, set up configuration
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(3000);
      
      // Verify initial configuration
      cy.request('GET', `${BACKEND_URL}/api/plugin-config`).then((response) => {
        expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
      });
      
      // Reload the page
      cy.reload();
      cy.wait(2000);
      
      // Configuration should still be present
      cy.request('GET', `${BACKEND_URL}/api/plugin-config`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
        expect(response.body.data.configurations.environment.MODEL_PROVIDER).to.eq('openai');
      });
    });
  });

  describe('Agent Runtime Integration', () => {
    it('should enable agent runtime with configured API keys', () => {
      // Complete setup
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(5000);
      
      // Check server health - agent should be connected
      cy.request('GET', `${BACKEND_URL}/api/server/health`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.status).to.eq('healthy');
        expect(response.body.data.agent).to.eq('connected');
        expect(response.body.data.agentId).to.match(/^[0-9a-f-]{36}$/);
      });
      
      // Check runtime state
      cy.request('GET', `${BACKEND_URL}/api/debug/runtime-state`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.character.name).to.eq('ELIZA');
        expect(response.body.data.database.isConnected).to.be.true;
        expect(response.body.data.services).to.be.an('array').with.length.greaterThan(0);
      });
      
      cy.screenshot('agent-runtime-connected');
    });

    it('should load available plugins with configuration', () => {
      // Complete setup
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(3000);
      
      // Check available plugins
      cy.request('GET', `${BACKEND_URL}/api/plugin-config`).then((response) => {
        const plugins = response.body.data.availablePlugins;
        expect(plugins).to.be.an('array');
        expect(plugins).to.include.members(['AUTONOMY', 'SHELL', 'goals', 'todo']);
        
        cy.log(`✅ ${plugins.length} plugins loaded`);
        cy.log(`Plugins: ${plugins.join(', ')}`);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle skip functionality', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      
      // Click skip button
      cy.get('button').contains('Skip (Use Existing)').click();
      
      // Should proceed without configuration
      cy.wait(2000);
      
      // Setup wizard should be gone
      cy.get('body').should('not.contain', 'ELIZA OS Configuration');
      
      cy.screenshot('skip-setup');
    });

    it('should reject empty API keys', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      
      // Try to submit with empty key
      cy.get('button').contains('Continue').should('be.disabled');
      
      // Type and clear
      cy.get('input#openaiKey').type('test').clear();
      cy.get('button').contains('Continue').should('be.disabled');
    });

    it('should handle concurrent configuration requests', () => {
      // Set up configuration first
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(3000);
      
      // Make multiple concurrent requests
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          cy.request('GET', `${BACKEND_URL}/api/plugin-config`)
        );
      }
      
      // All requests should succeed with consistent data
      cy.wrap(Promise.all(requests)).then((responses: any[]) => {
        responses.forEach(response => {
          expect(response.status).to.eq(200);
          expect(response.body.success).to.be.true;
          expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
        });
      });
    });
  });

  describe('Database Verification', () => {
    it('should verify database connection and persistence', () => {
      // Complete setup
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(5000);
      
      // Test database connection
      cy.task('testDatabaseConnection').then((result: any) => {
        expect(result.success).to.be.true;
        expect(result.database.hasConnection).to.be.true;
        expect(result.database.isConnected).to.be.true;
      });
      
      // Test memory system (requires database)
      const testRoomId = `test-room-${Date.now()}`;
      cy.task('testAgentMemory', { roomId: testRoomId }).then((result: any) => {
        expect(result.success).to.be.true;
        expect(result.memories).to.be.an('array');
      });
    });
  });
});

// Summary test for verification
describe('Setup Verification Summary', () => {
  it('should validate all setup requirements are met', () => {
    const BACKEND_URL = Cypress.env('BACKEND_URL') || 'http://localhost:7777';
    
    // Clear and setup fresh configuration
    cy.task('clearEnvironmentKeys');
    cy.visit('/');
    
    // Complete setup
    cy.contains('ELIZA OS Configuration', { timeout: 40000 });
    cy.get('input#openaiKey').type(`sk-test-final-${Date.now()}`);
    cy.get('button').contains('Continue').click();
    cy.wait(5000);
    
    // Comprehensive verification
    cy.request(`${BACKEND_URL}/api/plugin-config`).then((configResponse) => {
      cy.request(`${BACKEND_URL}/api/server/health`).then((healthResponse) => {
        const env = configResponse.body.data.configurations.environment;
        const health = healthResponse.body.data;
        
        // All requirements must pass
        expect(env.OPENAI_API_KEY, 'API key stored').to.eq('***SET***');
        expect(health.agent, 'Agent connected').to.eq('connected');
        expect(health.status, 'System healthy').to.eq('healthy');
        expect(configResponse.body.data.availablePlugins.length, 'Plugins loaded').to.be.greaterThan(3);
        
        cy.log('🎉 ALL SETUP REQUIREMENTS VERIFIED:');
        cy.log('✅ API keys stored in database');
        cy.log('✅ Agent runtime connected and operational');
        cy.log('✅ Plugins loaded and available');
        cy.log('✅ Complete setup flow functional');
        
        cy.screenshot('setup-verification-complete');
      });
    });
    
    // Cleanup
    cy.task('clearEnvironmentKeys');
  });
}); 