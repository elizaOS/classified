describe('ELIZA Game Interface - Complete Functionality Test', () => {
  beforeEach(() => {
    // Visit the game interface
    cy.visit('http://localhost:5173');
    
    // Wait for the page to load
    cy.get('body', { timeout: 10000 }).should('be.visible');
  });

  it('should display the boot sequence and game initialization', () => {
    // Check that the game is loading/booting - look for any of these keywords
    cy.get('body').then(($body) => {
      const text = $body.text();
      const hasExpectedText = text.includes('ELIZA') || 
                              text.includes('Agent Runtime') || 
                              text.includes('Copyright') ||
                              text.includes('Initializing') ||
                              text.includes('Loading');
      expect(hasExpectedText).to.be.true;
    });
    
    // Take a screenshot to document the current state
    cy.screenshot('game-boot-sequence');
  });

  it('should show agent capabilities controls', () => {
    // Check all plugin controls are present
    const expectedPlugins = ['autonomy', 'vision', 'microphone', 'speakers', 'shell', 'browser'];
    
    expectedPlugins.forEach(plugin => {
      cy.get('.control-btn').contains(plugin.toUpperCase()).should('be.visible');
    });
    
    // Verify controls can be toggled
    cy.get('.control-btn').contains('SHELL').click();
    cy.get('.control-btn').contains('SHELL').should('have.class', 'enabled');
  });

  it('should display status tabs and allow navigation', () => {
    const tabs = ['GOALS', 'TODOS', 'MONOLOGUE', 'FILES', 'CONFIG'];
    
    tabs.forEach(tab => {
      cy.get('.tab-btn').contains(tab).should('be.visible');
    });
    
    // Test tab navigation
    cy.get('.tab-btn').contains('TODOS').click();
    cy.get('.status-header').contains('TASK QUEUE').should('be.visible');
    
    cy.get('.tab-btn').contains('MONOLOGUE').click();
    cy.get('.status-header').contains('AGENT THOUGHTS').should('be.visible');
    
    cy.get('.tab-btn').contains('FILES').click();
    cy.get('.status-header').contains('KNOWLEDGE BASE').should('be.visible');
    
    cy.get('.tab-btn').contains('CONFIG').click();
    cy.get('.status-header').contains('CONFIGURATION').should('be.visible');
  });

  it('should show connection status', () => {
    // Check connection status indicator
    cy.get('.connection-status').should('contain.text', 'ONLINE').or('contain.text', 'OFFLINE');
    
    // Check agent status in panel header
    cy.get('.panel-subtitle').should('contain.text', 'Connected').or('contain.text', 'Disconnected');
    cy.get('.panel-subtitle').should('contain.text', 'Tokens:');
    cy.get('.panel-subtitle').should('contain.text', 'Cost:');
  });

  it('should display system initialization message', () => {
    // Check for the boot sequence message
    cy.get('.chat-line').should('contain.text', 'ELIZA TERMINAL v2.0 - Agent Connection Established');
  });

  it('should allow text input in chat', () => {
    const testMessage = 'Hello ELIZA, can you hear me?';
    
    // Type in chat input
    cy.get('.chat-input').type(testMessage);
    cy.get('.chat-input').should('have.value', testMessage);
    
    // Submit the message
    cy.get('.send-btn').click();
    
    // Verify message appears in chat
    cy.get('.chat-line').contains(testMessage).should('be.visible');
    cy.get('.chat-line').contains('[USER]').should('be.visible');
  });

  it('should show configuration options', () => {
    // Navigate to config tab
    cy.get('.tab-btn').contains('CONFIG').click();
    
    // Check AI provider dropdown
    cy.get('.config-select').should('be.visible');
    cy.get('.config-select option').should('contain.text', 'OpenAI');
    
    // Check API key inputs
    cy.get('.config-input[placeholder="OpenAI API Key"]').should('be.visible');
    cy.get('.config-input[placeholder="Anthropic API Key"]').should('be.visible');
    
    // Check agent settings
    cy.get('.config-input[placeholder="Agent Name"]').should('be.visible');
    cy.get('.config-input[placeholder="Temperature (0.0-1.0)"]').should('be.visible');
    
    // Check danger zone
    cy.get('.danger-section').should('be.visible');
    cy.get('.reset-btn').should('be.visible').should('contain.text', 'RESET AGENT');
  });

  it('should show reset agent dialog when reset is clicked', () => {
    // Navigate to config tab and click reset
    cy.get('.tab-btn').contains('CONFIG').click();
    cy.get('.reset-btn').click();
    
    // Check modal appears
    cy.get('.modal-overlay').should('be.visible');
    cy.get('.modal-dialog').should('be.visible');
    cy.get('.modal-title').should('contain.text', 'CONFIRM AGENT RESET');
    
    // Check warning content
    cy.get('.warning-message').should('contain.text', 'This action will permanently:');
    cy.get('.warning-message').should('contain.text', 'Kill your current agent instance');
    cy.get('.warning-message').should('contain.text', 'This cannot be undone!');
    
    // Check confirmation input
    cy.get('.confirm-input').should('be.visible');
    cy.get('.confirmation-input').should('contain.text', 'Type "RESET AGENT" to confirm:');
    
    // Check action buttons
    cy.get('.cancel-btn').should('be.visible');
    cy.get('.confirm-reset-btn').should('be.visible');
    
    // Cancel the dialog
    cy.get('.cancel-btn').click();
    cy.get('.modal-overlay').should('not.exist');
  });

  it('should show file upload functionality', () => {
    // Navigate to files tab
    cy.get('.tab-btn').contains('FILES').click();
    
    // Check knowledge base display
    cy.get('.status-header').should('contain.text', 'KNOWLEDGE BASE');
    cy.get('.file-item').should('contain.text', 'letter-from-creators.md');
    
    // Check upload functionality
    cy.get('.upload-btn').should('be.visible').should('contain.text', '+ Upload File');
    cy.get('#file-upload').should('exist');
  });

  it('should handle keyboard navigation in chat input', () => {
    const messages = ['First message', 'Second message', 'Third message'];
    
    // Send multiple messages to build history
    messages.forEach(message => {
      cy.get('.chat-input').type(message);
      cy.get('.send-btn').click();
      cy.wait(100); // Small delay between messages
    });
    
    // Test arrow key navigation through history
    cy.get('.chat-input').focus();
    cy.get('.chat-input').type('{uparrow}');
    cy.get('.chat-input').should('have.value', 'Third message');
    
    cy.get('.chat-input').type('{uparrow}');
    cy.get('.chat-input').should('have.value', 'Second message');
    
    cy.get('.chat-input').type('{downarrow}');
    cy.get('.chat-input').should('have.value', 'Third message');
  });

  it('should show proper visual styling (CRT terminal theme)', () => {
    // Check for terminal-style visual elements
    cy.get('.terminal-container').should('have.css', 'background-color');
    
    // Check for monospace fonts in chat
    cy.get('.chat-content').should('have.css', 'font-family').and('include', 'monospace');
    
    // Check for terminal-style colors
    cy.get('.connection-status').should('have.css', 'color');
    
    // Verify panel styling
    cy.get('.panel').should('have.css', 'border');
    cy.get('.panel-header').should('have.css', 'background-color');
    
    // Check button styling
    cy.get('.control-btn').should('have.css', 'border');
    cy.get('.tab-btn').should('have.css', 'background-color');
  });

  it('should handle chat message timestamps', () => {
    const testMessage = 'Test timestamp message';
    
    cy.get('.chat-input').type(testMessage);
    cy.get('.send-btn').click();
    
    // Verify timestamp is displayed
    cy.get('.chat-line').last().within(() => {
      cy.get('.chat-timestamp').should('be.visible');
      cy.get('.chat-timestamp').should('match', /^\d{1,2}:\d{2}:\d{2}/); // HH:MM:SS format
    });
  });
});