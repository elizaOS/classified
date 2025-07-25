/// <reference types="cypress" />

/**
 * Complete Game Test - CLAUDE.md Compliant
 * Tests ALL features with REAL runtime, NO MOCKS
 * FAIL FAST on any error
 */

describe('Complete Game Test - 100% Feature Coverage', () => {
  const TEST_TIMEOUT = 60000; // 60s for LLM responses

  // Error tracking
  const testErrors: Array<{ test: string; error: string; screenshot?: string }> = [];

  // Fail fast on any error
  Cypress.on('fail', (error, runnable) => {
    const screenshot = `failed-${runnable.title?.replace(/\s+/g, '-')}-${Date.now()}`;
    cy.screenshot(screenshot);
    testErrors.push({
      test: runnable.title || 'Unknown test',
      error: error.message,
      screenshot,
    });
    throw error; // Re-throw to fail the test
  });

  before(() => {
    // Verify we have API keys
    const apiKeys = {
      openai: Cypress.env('OPENAI_API_KEY'),
      anthropic: Cypress.env('ANTHROPIC_API_KEY'),
    };

    if (!apiKeys.openai && !apiKeys.anthropic) {
      throw new Error('FATAL: No API keys found. Tests require REAL API keys.');
    }

    cy.log('✅ API Keys detected - using real LLM');
  });

  beforeEach(() => {
    // Verify no mocks before visiting
    cy.verifyNoMocks();

    // Visit app with real runtime
    cy.visit('/', { timeout: 30000 });

    // Handle setup screen if present - click continue button
    cy.get('body').then(($body) => {
      if ($body.find('.continue-btn').length > 0) {
        cy.log('Setup screen detected, clicking CONTINUE button');
        cy.get('.continue-btn').click();
        cy.wait(3000); // Wait for transition

        // Handle second step if we're in configure mode
        cy.get('body').then(($body2) => {
          if ($body2.find('.setup-btn').length > 0) {
            cy.log('Configuration screen detected, clicking SETUP button');
            cy.get('.setup-btn').click();
            cy.wait(5000); // Wait for setup to complete

            // Handle final continue if needed
            cy.get('body').then(($body3) => {
              if ($body3.find('.continue-btn').length > 0) {
                cy.log('Setup complete screen, clicking final CONTINUE');
                cy.get('.continue-btn').click();
                cy.wait(3000);
              }
            });
          }
        });
      } else {
        cy.log('No setup screen detected, proceeding directly');
      }
    });

    // Wait for agent to be ready
    cy.waitForAgentReady();

    // Double-check no mocks after load
    cy.verifyNoMocks();

    // Verify we're using real LLM
    cy.verifyRealLLM();
  });

  describe('Backend & Container Health', () => {
    it('validates backend is fully operational', () => {
      cy.request('http://localhost:7777/api/system/status').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.runtime).to.exist;
        expect(response.body.runtime.agentId).to.be.a('string');
        cy.log(`✅ Agent ID: ${response.body.runtime.agentId}`);
      });
    });

    it('validates container health', () => {
      cy.request('http://localhost:7777/api/containers/health').then((response) => {
        expect(response.status).to.eq(200);
        const health = response.body.health;

        // Verify PostgreSQL is running
        expect(health['eliza-postgres']).to.exist;
        expect(health['eliza-postgres'].status).to.eq('running');

        // Verify Ollama is available
        if (health['eliza-ollama']) {
          expect(health['eliza-ollama'].status).to.eq('running');
        }

        cy.screenshot('container-health');
      });
    });
  });

  describe('Real Chat with LLM', () => {
    it('sends message and receives real LLM response', () => {
      const testMessage = 'Hello! What is 2+2? Please respond with just the number.';

      // Type message
      cy.get('[data-testid="chat-input"]').type(testMessage);
      cy.get('[data-testid="chat-send-button"]').click();

      // Verify user message appears
      cy.get('[data-testid="user-message"]').last().should('contain', testMessage);

      // Wait for real LLM response
      cy.get('[data-testid="agent-message"]', { timeout: TEST_TIMEOUT })
        .should('exist')
        .then(($msg) => {
          const response = $msg.text();
          cy.log(`LLM Response: ${response}`);

          // Verify it's a real response (should contain "4" for 2+2)
          expect(response).to.match(/4|four/i);

          // Verify it's not a mock or error
          expect(response).to.not.include('[Mock');
          expect(response).to.not.include('Error');
          expect(response).to.not.include('undefined');
        });

      cy.screenshot('real-llm-response');
    });

    it('maintains conversation context', () => {
      // First message
      cy.get('[data-testid="chat-input"]').type('My favorite color is blue');
      cy.get('[data-testid="chat-send-button"]').click();

      // Wait for response
      cy.get('[data-testid="agent-message"]', { timeout: TEST_TIMEOUT }).should('exist');

      // Second message testing context
      cy.get('[data-testid="chat-input"]').type('What is my favorite color?');
      cy.get('[data-testid="chat-send-button"]').click();

      // Verify agent remembers
      cy.get('[data-testid="agent-message"]').last().should('contain.text', 'blue');

      cy.screenshot('context-maintained');
    });
  });

  describe('Plugin Features', () => {
    it('creates and manages goals', () => {
      // Navigate to goals tab
      cy.get('[data-testid="goals-tab"]').click();
      cy.get('[data-testid="goals-content"]').should('be.visible');

      // Send message to create a goal
      cy.get('[data-testid="chat-input"]').type('Create a goal to learn TypeScript');
      cy.get('[data-testid="chat-send-button"]').click();

      // Wait for agent response
      cy.get('[data-testid="agent-message"]', { timeout: TEST_TIMEOUT }).should('exist');

      // Refresh goals
      cy.wait(2000);
      cy.get('[data-testid="goals-tab"]').click();

      // Verify goal appears
      cy.get('[data-testid="goals-list"]')
        .should('contain.text', 'TypeScript')
        .or('contain.text', 'typescript')
        .or('contain.text', 'learn');

      cy.screenshot('goal-created');
    });

    it('creates and manages todos', () => {
      // Navigate to todos tab
      cy.get('[data-testid="todos-tab"]').click();
      cy.get('[data-testid="todos-content"]').should('be.visible');

      // Create a todo via chat
      cy.get('[data-testid="chat-input"]').type('Add a todo: Review Cypress documentation');
      cy.get('[data-testid="chat-send-button"]').click();

      // Wait for response
      cy.get('[data-testid="agent-message"]', { timeout: TEST_TIMEOUT }).should('exist');

      // Refresh and check todos
      cy.wait(2000);
      cy.get('[data-testid="todos-tab"]').click();

      // Verify todo appears
      cy.get('[data-testid="todos-content"]')
        .should('contain.text', 'Cypress')
        .or('contain.text', 'Review')
        .or('contain.text', 'documentation');

      cy.screenshot('todo-created');
    });

    it('uploads and manages knowledge', () => {
      // Navigate to knowledge tab
      cy.get('[data-testid="knowledge-tab"]').click();
      cy.get('[data-testid="knowledge-content"]').should('be.visible');

      // Create a test file
      const fileName = 'test-knowledge.txt';
      const fileContent = 'This is test knowledge content for Cypress testing.';

      cy.get('[data-testid="document-upload"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName,
          mimeType: 'text/plain',
        },
        { force: true }
      );

      // Wait for upload
      cy.wait(3000);

      // Verify file appears
      cy.get('[data-testid="knowledge-content"]').should('contain.text', fileName);

      cy.screenshot('knowledge-uploaded');
    });
  });

  describe('Capability Toggles', () => {
    it('toggles autonomy capability', () => {
      // Check initial state
      cy.get('[data-testid="autonomy-toggle"]').then(($toggle) => {
        const initialState = $toggle.find('[data-testid="autonomy-toggle-status"]').text();

        // Toggle autonomy
        cy.wrap($toggle).click();
        cy.wait(2000);

        // Verify state changed
        cy.get('[data-testid="autonomy-toggle-status"]').should('not.have.text', initialState);

        // Verify status indicator updates
        cy.get('[data-testid="autonomy-status"]').should(
          'contain.text',
          initialState === '○' ? 'Active' : 'Paused'
        );
      });

      cy.screenshot('autonomy-toggled');
    });

    it('toggles vision capabilities', () => {
      const visionCapabilities = ['camera', 'screen', 'microphone', 'speakers'];

      visionCapabilities.forEach((capability) => {
        cy.get(`[data-testid="${capability}-toggle"]`).then(($toggle) => {
          const initialState = $toggle.find(`[data-testid="${capability}-toggle-status"]`).text();

          // Toggle capability
          cy.wrap($toggle).click();
          cy.wait(1000);

          // Verify visual feedback changed
          cy.get(`[data-testid="${capability}-toggle-status"]`).should(
            'not.have.text',
            initialState
          );
        });
      });

      cy.screenshot('vision-capabilities-toggled');
    });

    it('toggles dangerous capabilities with security warning', () => {
      // Test shell capability (dangerous)
      cy.get('[data-testid="shell-toggle"]').click();

      // Security warning should appear
      cy.get('.modal-overlay').should('be.visible');
      cy.get('.modal-title').should('contain', 'SECURITY');

      // Cancel first
      cy.get('.cancel-btn').click();
      cy.get('.modal-overlay').should('not.exist');

      // Try again and confirm
      cy.get('[data-testid="shell-toggle"]').click();
      cy.get('.confirm-btn').click();
      cy.wait(2000);

      // Verify toggle state changed
      cy.get('[data-testid="shell-toggle-status"]').should('have.text', '●');

      cy.screenshot('dangerous-capability-enabled');
    });
  });

  describe('Error Scenarios (Fail Fast)', () => {
    it('handles invalid API endpoint', () => {
      // This should throw an error - no defensive programming
      cy.request({
        url: 'http://localhost:7777/api/invalid-endpoint-xyz',
        failOnStatusCode: true, // Explicitly fail on 404
      }).then(
        () => {
          throw new Error('Should have failed with 404');
        },
        (error) => {
          expect(error.status).to.eq(404);
          cy.log('✅ Correctly failed on invalid endpoint');
        }
      );
    });

    it('handles malformed chat input', () => {
      // Send extremely long message
      const longMessage = 'x'.repeat(10000);

      cy.get('[data-testid="chat-input"]').invoke('val', longMessage);
      cy.get('[data-testid="chat-send-button"]').click();

      // Should either handle it or fail fast
      cy.get('[data-testid="user-message"]', { timeout: 5000 }).last().should('exist');
    });
  });

  describe('Monologue System', () => {
    it('displays agent autonomous thoughts', () => {
      // Enable autonomy first
      cy.get('[data-testid="autonomy-toggle"]').then(($toggle) => {
        const status = $toggle.find('[data-testid="autonomy-toggle-status"]').text();
        if (status === '○') {
          cy.wrap($toggle).click();
          cy.wait(2000);
        }
      });

      // Navigate to monologue
      cy.get('[data-testid="monologue-tab"]').click();
      cy.get('[data-testid="monologue-content"]').should('be.visible');

      // Wait for autonomous thoughts
      cy.wait(10000);

      // Verify monologue content
      cy.get('[data-testid="monologue-content"]')
        .should('not.contain', 'Agent is quiet')
        .should('contain', '🤖');

      cy.screenshot('agent-monologue');
    });
  });

  describe('Plugin Development', () => {
    it('accesses plugin development interface', () => {
      cy.get('[data-testid="plugins-tab"]').click();
      cy.wait(2000);

      // Verify plugin development UI loads
      cy.get('[data-testid="plugins-content"]')
        .should('be.visible')
        .should('contain', 'PLUGIN DEVELOPMENT');

      cy.screenshot('plugin-development');
    });
  });

  // Comprehensive validation after all tests
  after(() => {
    cy.log('=== COMPREHENSIVE TEST REPORT ===');

    if (testErrors.length > 0) {
      cy.log(`❌ ${testErrors.length} TESTS FAILED:`);
      testErrors.forEach((err, idx) => {
        cy.log(`${idx + 1}. ${err.test}`);
        cy.log(`   Error: ${err.error}`);
        if (err.screenshot) {
          cy.log(`   Screenshot: ${err.screenshot}.png`);
        }
      });

      // Take final failure screenshot
      cy.screenshot('test-failures-summary');

      throw new Error(`${testErrors.length} tests failed. 100% pass rate required.`);
    } else {
      cy.log('✅ ALL TESTS PASSED - 100% SUCCESS');
      cy.screenshot('all-tests-passed');
    }
  });
});
