/// <reference types="cypress" />

describe('Complete Boot Sequence Testing', () => {
  beforeEach(() => {
    // Start fresh without skipping boot
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it('should complete full boot sequence with environment detection', () => {
    cy.visit('/', { timeout: 15000 });

    // Step 1: Initial loading screen
    cy.contains('ELIZA', { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="loading-indicator"]', { timeout: 5000 }).should('exist');

    // Step 2: Environment detection phase
    cy.contains('Detecting system capabilities', { timeout: 10000 }).should('be.visible');
    cy.screenshot('boot-01-environment-detection');

    // Step 3: Model provider selection
    cy.get('[data-testid="model-provider-selection"]', { timeout: 15000 }).should('be.visible');
    cy.contains('Choose AI Model Provider').should('be.visible');
    cy.screenshot('boot-02-model-provider-selection');

    // Test local AI option
    cy.get('[data-testid="local-ai-option"]').should('be.visible').click();
    cy.contains('Local AI').should('be.visible');
    cy.contains('Run AI models on your hardware').should('be.visible');

    // Test cloud API option
    cy.get('[data-testid="cloud-api-option"]').should('be.visible').click();
    cy.contains('Cloud API').should('be.visible');
    cy.contains('OpenAI, Anthropic').should('be.visible');

    // Select cloud option and proceed
    cy.get('[data-testid="proceed-button"]').should('be.visible').click();
    cy.screenshot('boot-03-model-provider-selected');

    // Step 4: API Key configuration (if cloud selected)
    cy.get('[data-testid="api-key-setup"]', { timeout: 10000 }).should('be.visible');
    cy.contains('API Key Configuration').should('be.visible');
    
    // Test API key input
    cy.get('[data-testid="openai-api-key-input"]').should('be.visible')
      .type(Cypress.env('OPENAI_API_KEY') || 'test-key-placeholder');
    
    cy.get('[data-testid="validate-api-key-button"]').click();
    cy.contains('Validating API key', { timeout: 5000 }).should('be.visible');
    cy.screenshot('boot-04-api-key-configuration');

    // Step 5: Capability permissions
    cy.get('[data-testid="capability-permissions"]', { timeout: 15000 }).should('be.visible');
    cy.contains('Hardware Permissions').should('be.visible');
    cy.screenshot('boot-05-capability-permissions');

    // Test each capability toggle
    const capabilities = [
      { testId: 'microphone-toggle', label: 'Microphone Input' },
      { testId: 'speaker-toggle', label: 'Speaker Output' },
      { testId: 'camera-toggle', label: 'Camera Access' },
      { testId: 'screen-toggle', label: 'Screen Capture' },
      { testId: 'shell-toggle', label: 'Shell Access' },
      { testId: 'browser-toggle', label: 'Browser Access' },
      { testId: 'coding-toggle', label: 'Autonomous Coding' }
    ];

    capabilities.forEach((capability, index) => {
      cy.get(`[data-testid="${capability.testId}"]`).should('be.visible');
      cy.contains(capability.label).should('be.visible');
      
      // Toggle each capability on and off
      cy.get(`[data-testid="${capability.testId}"]`).click();
      cy.get(`[data-testid="${capability.testId}"]`).should('have.attr', 'aria-checked', 'true');
      
      if (index === 2) { // Take screenshot after a few toggles
        cy.screenshot('boot-06-capabilities-configured');
      }
    });

    // Step 6: Complete boot sequence
    cy.get('[data-testid="complete-setup-button"]').should('be.visible').click();
    cy.contains('Initializing Agent', { timeout: 10000 }).should('be.visible');
    cy.screenshot('boot-07-initializing-agent');

    // Step 7: Verify successful boot to main interface
    cy.get('[data-testid="chat-interface"]', { timeout: 20000 }).should('be.visible');
    cy.get('[data-testid="agent-status"]').should('contain', 'Ready');
    cy.contains('Agent loaded').should('be.visible');
    cy.screenshot('boot-08-successful-completion');

    // Verify all main UI elements are present after boot
    cy.get('[data-testid="goals-tab"]').should('be.visible');
    cy.get('[data-testid="todos-tab"]').should('be.visible');
    cy.get('[data-testid="monologue-tab"]').should('be.visible');
    cy.get('[data-testid="files-tab"]').should('be.visible');
    cy.get('[data-testid="config-tab"]').should('be.visible');

    // Verify agent initialization message
    cy.get('[data-testid="chat-messages"]').should('contain', 'Hello! I\'m ready to assist you');
  });

  it('should handle boot sequence errors gracefully', () => {
    cy.visit('/');

    // Wait for model provider selection
    cy.get('[data-testid="model-provider-selection"]', { timeout: 15000 }).should('be.visible');
    
    // Select cloud option
    cy.get('[data-testid="cloud-api-option"]').click();
    cy.get('[data-testid="proceed-button"]').click();

    // Test invalid API key handling
    cy.get('[data-testid="api-key-setup"]', { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="openai-api-key-input"]').type('invalid-api-key');
    cy.get('[data-testid="validate-api-key-button"]').click();

    // Should show error message
    cy.contains('Invalid API key', { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="error-message"]').should('be.visible');
    cy.screenshot('boot-error-invalid-api-key');

    // Should allow retry
    cy.get('[data-testid="retry-api-key-button"]').should('be.visible');
  });

  it('should persist boot configuration across sessions', () => {
    // Complete initial boot
    cy.visit('/');
    
    // Skip through boot sequence with valid configuration
    cy.get('[data-testid="model-provider-selection"]', { timeout: 15000 }).should('be.visible');
    cy.get('[data-testid="cloud-api-option"]').click();
    cy.get('[data-testid="proceed-button"]').click();
    
    cy.get('[data-testid="api-key-setup"]', { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="openai-api-key-input"]').type(Cypress.env('OPENAI_API_KEY') || 'test-key');
    cy.get('[data-testid="validate-api-key-button"]').click();
    
    // Enable some capabilities
    cy.get('[data-testid="capability-permissions"]', { timeout: 15000 }).should('be.visible');
    cy.get('[data-testid="microphone-toggle"]').click();
    cy.get('[data-testid="browser-toggle"]').click();
    
    cy.get('[data-testid="complete-setup-button"]').click();
    cy.get('[data-testid="chat-interface"]', { timeout: 20000 }).should('be.visible');

    // Reload page - should skip boot sequence
    cy.reload();
    
    // Should go directly to main interface without boot sequence
    cy.get('[data-testid="chat-interface"]', { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="model-provider-selection"]').should('not.exist');
    
    // Verify capabilities were persisted
    cy.get('[data-testid="config-tab"]').click();
    cy.get('[data-testid="microphone-setting"]').should('have.attr', 'aria-checked', 'true');
    cy.get('[data-testid="browser-setting"]').should('have.attr', 'aria-checked', 'true');
  });

  it('should validate hardware capabilities during boot', () => {
    cy.visit('/');

    // Navigate to capability permissions
    cy.get('[data-testid="model-provider-selection"]', { timeout: 15000 }).should('be.visible');
    cy.get('[data-testid="local-ai-option"]').click(); // Test local option this time
    cy.get('[data-testid="proceed-button"]').click();

    // Should detect local hardware capabilities
    cy.contains('Scanning hardware capabilities', { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="hardware-detection"]').should('be.visible');
    cy.screenshot('boot-hardware-detection');

    // Should show detected capabilities
    cy.get('[data-testid="capability-permissions"]', { timeout: 15000 }).should('be.visible');
    
    // Verify each capability shows detection status
    cy.get('[data-testid="microphone-status"]').should('contain.oneOf', ['Detected', 'Not Available']);
    cy.get('[data-testid="camera-status"]').should('contain.oneOf', ['Detected', 'Not Available']);
    cy.get('[data-testid="gpu-status"]').should('contain.oneOf', ['CUDA Available', 'CPU Only']);
  });

  afterEach(() => {
    cy.screenshot('boot-test-complete');
  });
});