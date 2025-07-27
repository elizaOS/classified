describe('Configuration Validation System', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5173');

    // Wait for the game interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('exist');
    cy.get('[data-testid="connection-status"]', { timeout: 10000 }).should(
      'contain.text',
      'ONLINE'
    );

    // Navigate to CONFIG tab
    cy.get('[data-testid="config-tab"]').click();
    cy.get('[data-testid="config-content"]').should('be.visible');
  });

  describe('Configuration UI Elements', () => {
    it('should display configuration validation buttons', () => {
      // Check that validation buttons are present
      cy.get('[data-testid="validate-config-button"]')
        .should('be.visible')
        .should('contain.text', 'VALIDATE CONFIG');

      cy.get('[data-testid="test-config-button"]')
        .should('be.visible')
        .should('contain.text', 'TEST CONFIG');
    });

    it('should display model provider configuration options', () => {
      // Check model provider dropdown
      cy.get('[data-testid="model-provider-select"]')
        .should('be.visible')
        .should('have.value', 'openai');

      // Check provider options exist
      cy.get('[data-testid="model-provider-select"] option[value="openai"]').should('exist');
      cy.get('[data-testid="model-provider-select"] option[value="anthropic"]').should('exist');
      cy.get('[data-testid="model-provider-select"] option[value="ollama"]').should('exist');
    });

    it('should show conditional configuration fields based on provider selection', () => {
      // Test OpenAI configuration (default)
      cy.get('[data-testid="openai-api-key-input"]').should('be.visible');
      cy.get('[data-testid="openai-model-select"]').should('be.visible');

      // Switch to Anthropic
      cy.get('[data-testid="model-provider-select"]').select('anthropic');
      cy.get('[data-testid="anthropic-api-key-input"]').should('be.visible');
      cy.get('[data-testid="anthropic-model-select"]').should('be.visible');
      cy.get('[data-testid="openai-api-key-input"]').should('not.exist');

      // Switch to Ollama
      cy.get('[data-testid="model-provider-select"]').select('ollama');
      cy.get('[data-testid="ollama-server-url-input"]').should('be.visible');
      cy.get('[data-testid="ollama-model-input"]').should('be.visible');
      cy.get('[data-testid="anthropic-api-key-input"]').should('not.exist');
    });
  });

  describe('Configuration Validation', () => {
    it('should perform configuration validation and show results', () => {
      // Set up interceptor for validation API call
      cy.intercept('POST', '**/api/config/validate', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            validation: {
              overall: 'degraded',
              providers: {
                openai: {
                  status: 'unhealthy',
                  message: 'OpenAI API key missing',
                  apiKey: 'missing',
                },
              },
              environment: {
                MODEL_PROVIDER: {
                  value: 'openai',
                  status: 'healthy',
                  message: 'Provider set to: openai',
                },
              },
              services: {
                openai: {
                  loaded: false,
                  status: 'not_loaded',
                },
              },
            },
            recommendations: [
              '⚠️ Warning: Some issues detected with model provider configuration.',
              '🔑 Configure openai API key to enable openai provider.',
            ],
          },
        },
      }).as('validateConfig');

      // Click validation button
      cy.get('[data-testid="validate-config-button"]').click();

      // Wait for API call
      cy.wait('@validateConfig');

      // Check that validation results appear in chat
      cy.get('[data-testid="chat-messages"]')
        .should('contain.text', 'Validating configuration')
        .should('contain.text', 'Configuration Validation Complete')
        .should('contain.text', 'Overall Status: DEGRADED')
        .should('contain.text', 'openai: OpenAI API key missing')
        .should('contain.text', 'Recommendations:')
        .should('contain.text', 'Configure openai API key');
    });

    it('should handle validation success with healthy status', () => {
      // Set up API key first
      cy.get('[data-testid="openai-api-key-input"]').type('sk-test-key-123456789');

      // Mock successful validation
      cy.intercept('POST', '**/api/config/validate', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            validation: {
              overall: 'healthy',
              providers: {
                openai: {
                  status: 'healthy',
                  message: 'OpenAI configured with model: gpt-4o-mini',
                  apiKey: 'present',
                  connectionTest: {
                    status: 'success',
                    modelAvailable: true,
                    message: 'Connection successful and model available',
                  },
                },
              },
              environment: {
                MODEL_PROVIDER: {
                  value: 'openai',
                  status: 'healthy',
                },
              },
              services: {
                openai: {
                  loaded: true,
                  status: 'healthy',
                },
              },
            },
            recommendations: [
              '✅ openai configuration is working correctly.',
              '✅ All configurations appear to be working correctly.',
            ],
          },
        },
      }).as('validateConfigSuccess');

      cy.get('[data-testid="validate-config-button"]').click();
      cy.wait('@validateConfigSuccess');

      // Check for success indicators
      cy.get('[data-testid="chat-messages"]')
        .should('contain.text', 'Overall Status: HEALTHY')
        .should('contain.text', 'openai: OpenAI configured with model')
        .should('contain.text', '✅ openai configuration is working correctly');
    });
  });

  describe('Configuration Testing', () => {
    it('should perform live configuration testing with LLM calls', () => {
      // Mock the configuration test API
      cy.intercept('POST', '**/api/config/test', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            overallStatus: 'success',
            testResults: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              tests: {
                llmCompletion: {
                  status: 'success',
                  request: "Respond with exactly: 'Configuration test successful'",
                  response: 'Configuration test successful',
                  match: true,
                  message: 'LLM completion test passed',
                },
                embedding: {
                  status: 'success',
                  textLength: 39,
                  embeddingDimensions: 768,
                  message: 'Generated 768-dimensional embedding',
                },
                memory: {
                  status: 'success',
                  memoryId: 'test-memory-123',
                  retrieved: true,
                  message: 'Memory operations working correctly',
                },
              },
            },
            summary: {
              total: 3,
              passed: 3,
              failed: 0,
              partial: 0,
            },
          },
        },
      }).as('testConfig');

      // Click test button
      cy.get('[data-testid="test-config-button"]').click();

      // Wait for API call
      cy.wait('@testConfig');

      // Check test results in chat
      cy.get('[data-testid="chat-messages"]')
        .should('contain.text', 'Testing configuration with actual LLM calls')
        .should('contain.text', 'Configuration Test Complete (Provider: openai)')
        .should('contain.text', 'Test Status: SUCCESS')
        .should('contain.text', 'Results: 3/3 tests passed, 0 failed')
        .should('contain.text', '✅ llmCompletion: LLM completion test passed')
        .should('contain.text', '✅ embedding: Generated 768-dimensional embedding')
        .should('contain.text', '✅ memory: Memory operations working correctly');
    });

    it('should handle configuration test failures', () => {
      // Mock failed test
      cy.intercept('POST', '**/api/config/test', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            overallStatus: 'failed',
            testResults: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              tests: {
                llmCompletion: {
                  status: 'failed',
                  error: 'API key invalid',
                  message: 'Failed to generate LLM completion',
                },
                embedding: {
                  status: 'failed',
                  error: 'No API key provided',
                  message: 'Failed to generate embedding',
                },
                memory: {
                  status: 'success',
                  message: 'Memory operations working correctly',
                },
              },
            },
            summary: {
              total: 3,
              passed: 1,
              failed: 2,
              partial: 0,
            },
          },
        },
      }).as('testConfigFailed');

      cy.get('[data-testid="test-config-button"]').click();
      cy.wait('@testConfigFailed');

      // Check error indicators
      cy.get('[data-testid="chat-messages"]')
        .should('contain.text', 'Test Status: FAILED')
        .should('contain.text', 'Results: 1/3 tests passed, 2 failed')
        .should('contain.text', '❌ llmCompletion: Failed to generate LLM completion')
        .should('contain.text', '❌ embedding: Failed to generate embedding')
        .should('contain.text', '✅ memory: Memory operations working correctly');
    });
  });

  describe('Configuration Error Handling', () => {
    it('should handle validation API errors gracefully', () => {
      // Mock API error
      cy.intercept('POST', '**/api/config/validate', {
        statusCode: 500,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Internal server error during validation',
          },
        },
      }).as('validateConfigError');

      cy.get('[data-testid="validate-config-button"]').click();
      cy.wait('@validateConfigError');

      // Check error message appears
      cy.get('[data-testid="chat-messages"]').should(
        'contain.text',
        'Validation failed: Internal server error during validation'
      );
    });

    it('should handle network errors during testing', () => {
      // Mock network failure
      cy.intercept('POST', '**/api/config/test', { forceNetworkError: true }).as(
        'testConfigNetworkError'
      );

      cy.get('[data-testid="test-config-button"]').click();
      cy.wait('@testConfigNetworkError');

      // Check network error message
      cy.get('[data-testid="chat-messages"]').should(
        'contain.text',
        'Configuration test failed: Network error'
      );
    });
  });

  describe('Configuration Integration', () => {
    it('should validate configuration after changing provider settings', () => {
      // Change to Anthropic provider
      cy.get('[data-testid="model-provider-select"]').select('anthropic');

      // Add API key
      cy.get('[data-testid="anthropic-api-key-input"]').type('sk-ant-test-123');

      // Wait a moment for the configuration to update
      cy.wait(1000);

      // Mock validation for Anthropic
      cy.intercept('POST', '**/api/config/validate', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            validation: {
              overall: 'healthy',
              providers: {
                anthropic: {
                  status: 'healthy',
                  message: 'Anthropic configured with model: claude-3-5-sonnet-20241022',
                  apiKey: 'present',
                },
              },
            },
            recommendations: ['✅ anthropic configuration is working correctly.'],
          },
        },
      }).as('validateAnthropic');

      // Validate the new configuration
      cy.get('[data-testid="validate-config-button"]').click();
      cy.wait('@validateAnthropic');

      cy.get('[data-testid="chat-messages"]').should(
        'contain.text',
        'anthropic: Anthropic configured with model'
      );
    });

    it('should test Ollama local configuration', () => {
      // Switch to Ollama
      cy.get('[data-testid="model-provider-select"]').select('ollama');

      // Set custom server URL and model
      cy.get('[data-testid="ollama-server-url-input"]').clear().type('http://localhost:11434');
      cy.get('[data-testid="ollama-model-input"]').clear().type('llama3.1:8b');

      // Mock Ollama validation
      cy.intercept('POST', '**/api/config/validate', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            validation: {
              overall: 'degraded',
              providers: {
                ollama: {
                  status: 'unhealthy',
                  message: 'Failed to connect to Ollama at http://localhost:11434',
                  connectionTest: {
                    status: 'failed',
                    error: 'Connection refused',
                    message: 'Failed to connect to Ollama at http://localhost:11434',
                  },
                },
              },
            },
            recommendations: [
              '🔗 ollama API key present but connection failed: Failed to connect to Ollama at http://localhost:11434',
            ],
          },
        },
      }).as('validateOllama');

      cy.get('[data-testid="validate-config-button"]').click();
      cy.wait('@validateOllama');

      cy.get('[data-testid="chat-messages"]')
        .should('contain.text', 'ollama: Failed to connect to Ollama')
        .should('contain.text', 'connection failed');
    });
  });

  describe('User Experience', () => {
    it('should provide clear feedback during validation process', () => {
      // Mock delayed response to test loading state
      cy.intercept('POST', '**/api/config/validate', (req) => {
        req.reply({
          delay: 2000,
          statusCode: 200,
          body: {
            success: true,
            data: { validation: { overall: 'healthy' }, recommendations: [] },
          },
        });
      }).as('validateConfigSlow');

      cy.get('[data-testid="validate-config-button"]').click();

      // Should show immediate feedback
      cy.get('[data-testid="chat-messages"]').should('contain.text', 'Validating configuration...');

      cy.wait('@validateConfigSlow');

      // Should show completion
      cy.get('[data-testid="chat-messages"]').should(
        'contain.text',
        'Configuration Validation Complete'
      );
    });

    it('should provide helpful guidance in validation messages', () => {
      cy.intercept('POST', '**/api/config/validate', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            validation: {
              overall: 'unhealthy',
              providers: {},
              environment: {},
              services: {},
            },
            recommendations: [
              '❌ Critical: No working model provider configured. Please configure at least one provider.',
              '🔑 Configure openai API key to enable openai provider.',
              '📋 openai connected but model "invalid-model" not available. Check model name or permissions.',
            ],
          },
        },
      }).as('validateConfigGuidance');

      cy.get('[data-testid="validate-config-button"]').click();
      cy.wait('@validateConfigGuidance');

      // Check that helpful guidance is provided
      cy.get('[data-testid="chat-messages"]')
        .should('contain.text', 'Critical: No working model provider configured')
        .should('contain.text', 'Configure openai API key to enable')
        .should('contain.text', 'Check model name or permissions');
    });
  });

  afterEach(() => {
    // Take screenshot after each test for debugging
    cy.screenshot(`config-validation-${Cypress.currentTest.title}`, {
      capture: 'viewport',
      overwrite: true,
    });
  });
});
