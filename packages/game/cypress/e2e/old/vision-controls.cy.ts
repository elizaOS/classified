describe('Agent Capabilities Vision Controls', () => {
  beforeEach(() => {
    // Visit the game interface
    cy.visit('http://localhost:5174');
    
    // Wait for the interface to load - check for game interface components
    cy.get('body').should('be.visible');
    cy.wait(2000); // Give the React app time to load
  });

  it('should display agent capabilities section with vision controls', () => {
    // Check that agent capabilities section is visible
    cy.contains('◆ AGENT CAPABILITIES').should('be.visible');
    
    // Check that all control buttons are present
    cy.get('.control-btn').contains('CAMERA').should('be.visible');
    cy.get('.control-btn').contains('SCREEN').should('be.visible');
    cy.get('.control-btn').contains('MICROPHONE').should('be.visible');
    cy.get('.control-btn').contains('SPEAKERS').should('be.visible');
  });

  it('should show all controls as disabled initially', () => {
    // All control buttons should start as disabled (showing ◯ indicator)
    cy.get('.control-btn').contains('CAMERA').should('have.class', 'disabled');
    cy.get('.control-btn').contains('SCREEN').should('have.class', 'disabled');
    cy.get('.control-btn').contains('MICROPHONE').should('have.class', 'disabled');
    cy.get('.control-btn').contains('SPEAKERS').should('have.class', 'disabled');
    
    // Status indicators should show disabled symbol ◯
    cy.get('.control-btn').contains('CAMERA').find('.control-indicator').should('contain', '◯');
    cy.get('.control-btn').contains('SCREEN').find('.control-indicator').should('contain', '◯');
    cy.get('.control-btn').contains('MICROPHONE').find('.control-indicator').should('contain', '◯');
    cy.get('.control-btn').contains('SPEAKERS').find('.control-indicator').should('contain', '◯');
  });

  it('should enable camera and update status', () => {
    // Find the camera control and click it
    cy.get('.control-btn').contains('CAMERA').click();
    
    // Wait for the update to complete and status should change to enabled
    cy.get('.control-btn').contains('CAMERA').should('have.class', 'enabled', { timeout: 10000 });
    
    // Indicator should show enabled symbol ◉
    cy.get('.control-btn').contains('CAMERA').find('.control-indicator').should('contain', '◉');
  });

  it('should enable screen capture and update status', () => {
    // Find the screen control and click it
    cy.get('.control-btn').contains('SCREEN').click();
    
    // Wait for the update to complete and status should change to enabled
    cy.get('.control-btn').contains('SCREEN').should('have.class', 'enabled', { timeout: 10000 });
    
    // Indicator should show enabled symbol ◉
    cy.get('.control-btn').contains('SCREEN').find('.control-indicator').should('contain', '◉');
  });

  it('should enable microphone and update status', () => {
    // Find the microphone control and click it
    cy.get('.control-btn').contains('MICROPHONE').click();
    
    // Wait for the update to complete and status should change to enabled
    cy.get('.control-btn').contains('MICROPHONE').should('have.class', 'enabled', { timeout: 10000 });
    
    // Indicator should show enabled symbol ◉
    cy.get('.control-btn').contains('MICROPHONE').find('.control-indicator').should('contain', '◉');
  });

  it('should enable text-to-speech and update status', () => {
    // Find the speakers control and click it
    cy.get('.control-btn').contains('SPEAKERS').click();
    
    // Wait for the update to complete and status should change to enabled
    cy.get('.control-btn').contains('SPEAKERS').should('have.class', 'enabled', { timeout: 10000 });
    
    // Indicator should show enabled symbol ◉
    cy.get('.control-btn').contains('SPEAKERS').find('.control-indicator').should('contain', '◉');
  });

  it('should disable camera after enabling it', () => {
    // First enable camera
    cy.get('.control-btn').contains('CAMERA').click();
    cy.get('.control-btn').contains('CAMERA').should('have.class', 'enabled', { timeout: 10000 });
    
    // Then disable it
    cy.get('.control-btn').contains('CAMERA').click();
    cy.get('.control-btn').contains('CAMERA').should('have.class', 'disabled', { timeout: 10000 });
    
    // Indicator should show disabled symbol ◯
    cy.get('.control-btn').contains('CAMERA').find('.control-indicator').should('contain', '◯');
  });

  it('should update vision provider status when camera is enabled', () => {
    // Enable camera
    cy.get('.control-btn').contains('CAMERA').click();
    cy.get('.control-btn').contains('CAMERA').should('have.class', 'enabled', { timeout: 10000 });
    
    // Send a message to trigger vision provider
    cy.get('.chat-input').type('What do you see?');
    cy.get('.send-btn').click();
    
    // Wait for agent response
    cy.get('.chat-line.chat-agent', { timeout: 15000 }).should('be.visible');
    
    // Check that the response doesn't contain "Vision service is currently disabled"
    cy.get('.chat-line.chat-agent').last().should('not.contain', 'Vision services are currently disabled');
    
    // The response should indicate vision is active (not showing stale "disabled" message)
    cy.get('.chat-line.chat-agent').last().should('not.contain', 'Vision service is not available');
  });

  it('should show disabled status in vision provider when all features are off', () => {
    // Make sure camera and screen features are disabled (they should be by default)
    cy.get('.control-btn').contains('CAMERA').should('have.class', 'disabled');
    cy.get('.control-btn').contains('SCREEN').should('have.class', 'disabled');
    
    // Send a message to trigger vision provider
    cy.get('.chat-input').type('What do you see?');
    cy.get('.send-btn').click();
    
    // Wait for agent response
    cy.get('.chat-line.chat-agent', { timeout: 15000 }).should('be.visible');
    
    // Check that the response indicates vision is disabled
    cy.get('.chat-line.chat-agent').last().should('contain', 'disabled');
  });

  it('should make API calls when toggles are changed', () => {
    // Set up intercepts to monitor API calls
    cy.intercept('POST', '/api/agents/default/settings').as('postSetting');
    cy.intercept('POST', '/api/agents/default/vision/refresh').as('refreshVision');
    
    // Enable camera - should trigger setting updates and refresh
    cy.get('.control-btn').contains('CAMERA').click();
    
    // Should see setting API calls
    cy.wait('@postSetting').its('request.body').should('deep.include', {
      key: 'ENABLE_CAMERA',
      value: 'true'
    });
    
    // Should trigger vision service refresh
    cy.wait('@refreshVision');
    
    // Status should update to enabled
    cy.get('.control-btn').contains('CAMERA').should('have.class', 'enabled', { timeout: 10000 });
  });

  it('should handle API errors gracefully', () => {
    // Mock API failure
    cy.intercept('POST', '/api/agents/default/settings', { statusCode: 500 }).as('failedSetting');
    
    // Try to enable camera
    cy.get('.control-btn').contains('CAMERA').click();
    
    // Should eventually remain disabled due to API failure
    cy.wait('@failedSetting');
    cy.get('.control-btn').contains('CAMERA').should('have.class', 'disabled', { timeout: 10000 });
  });

  it('should have agent capabilities section always visible', () => {
    // Agent capabilities section should be visible
    cy.contains('◆ AGENT CAPABILITIES').should('be.visible');
    
    // All controls should be visible
    cy.get('.control-btn').contains('CAMERA').should('be.visible');
    cy.get('.control-btn').contains('SCREEN').should('be.visible');
    cy.get('.control-btn').contains('MICROPHONE').should('be.visible');
    cy.get('.control-btn').contains('SPEAKERS').should('be.visible');
  });

  it('should persist settings across reload', () => {
    // Enable camera and screen capture
    cy.get('.control-btn').contains('CAMERA').click();
    cy.get('.control-btn').contains('CAMERA').should('have.class', 'enabled', { timeout: 10000 });
    
    cy.get('.control-btn').contains('SCREEN').click();
    cy.get('.control-btn').contains('SCREEN').should('have.class', 'enabled', { timeout: 10000 });
    
    // Reload the page
    cy.reload();
    
    // Wait for page to load
    cy.contains('◆ AGENT CAPABILITIES').should('be.visible');
    
    // Settings should persist - controls should be enabled
    cy.get('.control-btn').contains('CAMERA').should('have.class', 'enabled');
    cy.get('.control-btn').contains('SCREEN').should('have.class', 'enabled');
  });

  it('should validate OCR functionality when screen capture is enabled', () => {
    // Enable screen capture
    cy.get('.control-btn').contains('SCREEN').click();
    cy.get('.control-btn').contains('SCREEN').should('have.class', 'enabled', { timeout: 10000 });
    
    // Wait a moment for the service to fully initialize
    cy.wait(2000);
    
    // Ask about what's on screen (should trigger OCR)
    cy.get('.chat-input').type('What text do you see on the screen?');
    cy.get('.send-btn').click();
    
    // Wait for agent response
    cy.get('.chat-line.chat-agent', { timeout: 20000 }).should('be.visible');
    
    // The response should not indicate vision is disabled
    cy.get('.chat-line.chat-agent').last().should('not.contain', 'currently disabled');
    
    // Should contain some reference to screen content or OCR results
    // (The exact content will vary, but it shouldn't be a "disabled" message)
    cy.get('.chat-line.chat-agent').last().invoke('text').then((text) => {
      expect(text.toLowerCase()).to.not.contain('disabled');
      expect(text.length).to.be.greaterThan(10); // Should have substantial content
    });
  });
});