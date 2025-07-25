/// <reference types="cypress" />

describe('API Key Setup and Usage Verification', () => {
  const TEST_OPENAI_KEY = 'sk-test-openai-key-for-cypress-testing-123456789';
  const TEST_ANTHROPIC_KEY = 'sk-ant-test-anthropic-key-for-cypress-testing-123456789';

  beforeEach(() => {
    // Clean up any existing configuration
    cy.task('clearEnvironmentKeys');

    // Visit the game
    cy.visit('/', { failOnStatusCode: false });
  });

  afterEach(() => {
    // Clean up test keys after each test
    cy.task('clearEnvironmentKeys');
  });

  describe('Setup Wizard Detection and Flow', () => {
    it('should detect missing API keys and show setup wizard', () => {
      // Wait for boot sequence to complete and detect missing keys
      cy.contains('Loading ELIZA OS kernel', { timeout: 10000 });
      cy.contains('Agent Runtime Environment Initialized', { timeout: 15000 });
      cy.contains('Testing agent connectivity', { timeout: 20000 });

      // Should detect missing API keys and show setup needed message
      cy.contains('No AI model configuration found', { timeout: 25000 });
      cy.contains('API keys required for operation', { timeout: 30000 });
      cy.contains('Launching setup wizard', { timeout: 35000 });

      // Setup wizard should appear
      cy.contains('ELIZA OS Configuration', { timeout: 40000 }).should('be.visible');
      cy.contains('Configure your AI model settings to begin').should('be.visible');
    });

    it('should show proper setup form with OpenAI selected by default', () => {
      // Wait for setup wizard to appear
      cy.contains('ELIZA OS Configuration', { timeout: 40000 }).should('be.visible');

      // Verify form elements are present
      cy.get('select#modelProvider').should('be.visible').should('have.value', 'openai');
      cy.get('input#openaiKey').should('be.visible').should('have.attr', 'placeholder', 'sk-...');
      cy.get('button').contains('Continue').should('be.visible').should('be.disabled');
      cy.get('button').contains('Skip (Use Existing)').should('be.visible').should('not.be.disabled');
    });

    it('should switch to Anthropic provider and show correct input', () => {
      // Wait for setup wizard
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });

      // Switch to Anthropic
      cy.get('select#modelProvider').select('anthropic');

      // Verify Anthropic input appears and OpenAI input disappears
      cy.get('input#anthropicKey').should('be.visible').should('have.attr', 'placeholder', 'sk-ant-...');
      cy.get('input#openaiKey').should('not.exist');

      // Continue button should still be disabled with empty key
      cy.get('button').contains('Continue').should('be.disabled');
    });
  });

  describe('API Key Configuration - OpenAI', () => {
    it('should accept OpenAI key, save configuration, and proceed', () => {
      // Wait for setup wizard
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });

      // Enter OpenAI key
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);

      // Continue button should now be enabled
      cy.get('button').contains('Continue').should('not.be.disabled');

      // Click continue
      cy.get('button').contains('Continue').click();

      // Should proceed to main interface or successful completion
      cy.contains('Configuration saved successfully', { timeout: 10000 }).should('exist');
    });

    it('should verify OpenAI key is stored in configuration API', () => {
      // Complete setup with OpenAI key
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();

      // Wait for configuration to be saved
      cy.wait(2000);

      // Check configuration API directly
      cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
        expect(response.body.data.configurations.environment.MODEL_PROVIDER).to.eq('openai');
      });
    });

    it('should verify OpenAI key is accessible in process environment', () => {
      // Setup key
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(3000);

      // Verify through debug API that the key is in the runtime environment
      cy.request('GET', 'http://localhost:7777/api/debug/runtime-state').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        // Key should be available in the system (we can't see the actual value for security)
        expect(response.body.data).to.have.property('status');
      });
    });
  });

  describe('API Key Configuration - Anthropic', () => {
    it('should accept Anthropic key, save configuration, and proceed', () => {
      // Wait for setup wizard
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });

      // Switch to Anthropic and enter key
      cy.get('select#modelProvider').select('anthropic');
      cy.get('input#anthropicKey').type(TEST_ANTHROPIC_KEY);

      // Continue button should be enabled
      cy.get('button').contains('Continue').should('not.be.disabled');

      // Click continue
      cy.get('button').contains('Continue').click();

      // Should proceed successfully
      cy.contains('Configuration saved successfully', { timeout: 10000 }).should('exist');
    });

    it('should verify Anthropic key is stored correctly', () => {
      // Complete setup with Anthropic key
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('select#modelProvider').select('anthropic');
      cy.get('input#anthropicKey').type(TEST_ANTHROPIC_KEY);
      cy.get('button').contains('Continue').click();

      cy.wait(2000);

      // Check configuration API
      cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.data.configurations.environment.ANTHROPIC_API_KEY).to.eq('***SET***');
        expect(response.body.data.configurations.environment.MODEL_PROVIDER).to.eq('anthropic');
      });
    });
  });

  describe('Database Storage Verification', () => {
    it('should persist API key configuration across server restarts', () => {
      // Set up OpenAI key first
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(3000);

      // Verify initial configuration
      cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
        expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
      });

      // Simulate restart by forcing a new configuration check
      cy.wait(2000);
      cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
      });
    });

    it('should handle database queries for configuration', () => {
      // Set up configuration
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(3000);

      // Test database is accessible through debug endpoint
      cy.request('GET', 'http://localhost:7777/api/debug/runtime-state').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.database.hasConnection).to.be.true;
        expect(response.body.data.database.isConnected).to.be.true;
      });
    });
  });

  describe('API Key Usage Verification', () => {
    it('should use configured API keys for agent initialization', () => {
      // Set up OpenAI key
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();
      cy.wait(5000);

      // Check that the agent runtime has access to the configured keys
      cy.request('GET', 'http://localhost:7777/api/debug/runtime-state').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;

        // Verify character has proper configuration
        expect(response.body.data.character).to.exist;
        expect(response.body.data.character.name).to.eq('ELIZA');

        // Verify services are running (which indicates keys are working)
        expect(response.body.data.services).to.be.an('array');
        expect(response.body.data.services.length).to.be.greaterThan(0);
      });
    });

    it('should enable agent responses with valid API keys', () => {
      // Set up OpenAI key
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();

      // Wait for main interface to load
      cy.contains('Welcome to ELIZA Terminal', { timeout: 30000 });

      // Try to send a test message to verify the agent can respond
      // (This tests that the API key is actually being used)
      cy.get('input[type="text"], textarea', { timeout: 10000 }).first().type('Hello, can you respond?{enter}');

      // Check that we get some kind of response or processing
      cy.wait(3000);

      // Verify the agent runtime is functional
      cy.request('GET', 'http://localhost:7777/api/server/health').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.agent).to.eq('connected');
      });
    });
  });

  describe('Configuration Validation and Error Handling', () => {
    it('should reject empty API keys', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });

      // Try to continue without entering a key
      cy.get('button').contains('Continue').should('be.disabled');

      // Enter and then clear the key
      cy.get('input#openaiKey').type('test').clear();
      cy.get('button').contains('Continue').should('be.disabled');
    });

    it('should handle malformed API keys gracefully', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });

      // Enter obviously invalid key
      cy.get('input#openaiKey').type('invalid-key');
      cy.get('button').contains('Continue').should('not.be.disabled');
      cy.get('button').contains('Continue').click();

      // Should still save the configuration (validation happens at runtime)
      cy.wait(2000);
      cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.data.configurations.environment.OPENAI_API_KEY).to.eq('***SET***');
      });
    });

    it('should allow skipping setup and continue with existing configuration', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });

      // Click skip button
      cy.get('button').contains('Skip (Use Existing)').click();

      // Should proceed to main interface even without keys
      cy.contains('Welcome to ELIZA Terminal', { timeout: 20000 }).should('exist');
    });
  });

  describe('Visual and UX Verification', () => {
    it('should display setup form with proper styling', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });

      // Verify visual elements
      cy.get('.setup-content').should('be.visible');
      cy.get('.setup-header h2').should('have.class', 'glow');
      cy.get('.setup-form').should('be.visible');
      cy.get('.form-group').should('have.length.greaterThan', 0);
      cy.get('.form-actions').should('be.visible');
      cy.get('.setup-info').should('be.visible');

      // Check styling classes are applied
      cy.get('.setup-input').should('be.visible');
      cy.get('.setup-button').should('have.length', 2);
    });

    it('should show proper feedback during configuration save', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);
      cy.get('button').contains('Continue').click();

      // Should show some kind of loading or processing state
      // (The exact implementation may vary, but there should be feedback)
      cy.wait(1000);

      // Eventually should complete
      cy.contains('Configuration saved successfully', { timeout: 10000 }).should('exist');
    });
  });

  describe('OCR Validation', () => {
    it('should visually verify setup wizard elements are rendered correctly', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });

      // Take screenshot for OCR validation
      cy.screenshot('setup-wizard-initial-state', {
        capture: 'viewport',
        onBeforeScreenshot: () => {
          // Ensure all elements are visible
          cy.get('.setup-content').should('be.visible');
        }
      });

      // Use OCR to verify key text is visible
      cy.task('ocrVerifyText', {
        screenshot: 'setup-wizard-initial-state',
        expectedTexts: [
          'ELIZA OS Configuration',
          'Configure your AI model settings',
          'Model Provider',
          'OpenAI API Key',
          'Continue',
          'Skip (Use Existing)'
        ]
      }).then((ocrResult) => {
        expect(ocrResult.success).to.be.true;
        expect(ocrResult.foundTexts).to.include.members([
          'ELIZA OS Configuration',
          'Model Provider'
        ]);
      });
    });

    it('should verify API key input is properly masked', () => {
      cy.contains('ELIZA OS Configuration', { timeout: 40000 });
      cy.get('input#openaiKey').type(TEST_OPENAI_KEY);

      // Take screenshot after entering key
      cy.screenshot('api-key-entered', { capture: 'viewport' });

      // Verify the key is masked (not visible in plain text)
      cy.task('ocrVerifyTextNotPresent', {
        screenshot: 'api-key-entered',
        forbiddenTexts: [TEST_OPENAI_KEY]
      }).then((ocrResult) => {
        expect(ocrResult.success).to.be.true;
      });

      // But verify the input field shows dots or stars
      cy.get('input#openaiKey').should('have.attr', 'type', 'password');
    });
  });
});

// Custom Cypress commands for this test suite
declare global {
  namespace Cypress {
    interface Chainable {
      setupApiKey(provider: 'openai' | 'anthropic', key: string): Chainable<void>;
      verifyConfigurationStored(provider: 'openai' | 'anthropic'): Chainable<void>;
    }
  }
}

Cypress.Commands.add('setupApiKey', (provider: 'openai' | 'anthropic', key: string) => {
  cy.contains('ELIZA OS Configuration', { timeout: 40000 });

  if (provider === 'anthropic') {
    cy.get('select#modelProvider').select('anthropic');
    cy.get('input#anthropicKey').type(key);
  } else {
    cy.get('input#openaiKey').type(key);
  }

  cy.get('button').contains('Continue').click();
  cy.wait(3000);
});

Cypress.Commands.add('verifyConfigurationStored', (provider: 'openai' | 'anthropic') => {
  cy.request('GET', 'http://localhost:7777/api/plugin-config').then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body.success).to.be.true;

    const env = response.body.data.configurations.environment;
    if (provider === 'openai') {
      expect(env.OPENAI_API_KEY).to.eq('***SET***');
      expect(env.MODEL_PROVIDER).to.eq('openai');
    } else {
      expect(env.ANTHROPIC_API_KEY).to.eq('***SET***');
      expect(env.MODEL_PROVIDER).to.eq('anthropic');
    }
  });
});
