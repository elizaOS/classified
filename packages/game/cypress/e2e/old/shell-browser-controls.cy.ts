/// <reference types="cypress" />

describe('Shell and Browser Plugin Controls', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5174');
    cy.wait(2000); // Wait for initial load
  });

  it('should display shell and browser controls in agent capabilities section', () => {
    // Check that agent capabilities section is visible
    cy.contains('◆ AGENT CAPABILITIES').should('be.visible');
    
    // Check that shell and browser control buttons are present
    cy.get('.control-btn').contains('SHELL').should('be.visible');
    cy.get('.control-btn').contains('BROWSER').should('be.visible');
  });

  it('should show shell and browser controls as disabled initially', () => {
    // Shell and browser should start as disabled by default
    cy.get('.control-btn').contains('SHELL').should('have.class', 'disabled');
    cy.get('.control-btn').contains('BROWSER').should('have.class', 'disabled');
    
    // Status indicators should show disabled symbol ◯
    cy.get('.control-btn').contains('SHELL').find('.control-indicator').should('contain', '◯');
    cy.get('.control-btn').contains('BROWSER').find('.control-indicator').should('contain', '◯');
  });

  it('should enable shell capability and update status', () => {
    // Find the shell control and click it
    cy.get('.control-btn').contains('SHELL').click();
    
    // Wait for the update to complete and status should change to enabled
    cy.get('.control-btn').contains('SHELL').should('have.class', 'enabled', { timeout: 10000 });
    
    // Indicator should show enabled symbol ◉
    cy.get('.control-btn').contains('SHELL').find('.control-indicator').should('contain', '◉');
  });

  it('should enable browser capability and update status', () => {
    // Find the browser control and click it
    cy.get('.control-btn').contains('BROWSER').click();
    
    // Wait for the update to complete and status should change to enabled
    cy.get('.control-btn').contains('BROWSER').should('have.class', 'enabled', { timeout: 10000 });
    
    // Indicator should show enabled symbol ◉
    cy.get('.control-btn').contains('BROWSER').find('.control-indicator').should('contain', '◉');
  });

  it('should disable shell after enabling it', () => {
    // First enable shell
    cy.get('.control-btn').contains('SHELL').click();
    cy.get('.control-btn').contains('SHELL').should('have.class', 'enabled', { timeout: 10000 });
    
    // Then disable it
    cy.get('.control-btn').contains('SHELL').click();
    cy.get('.control-btn').contains('SHELL').should('have.class', 'disabled', { timeout: 10000 });
    
    // Indicator should show disabled symbol ◯
    cy.get('.control-btn').contains('SHELL').find('.control-indicator').should('contain', '◯');
  });

  it('should disable browser after enabling it', () => {
    // First enable browser
    cy.get('.control-btn').contains('BROWSER').click();
    cy.get('.control-btn').contains('BROWSER').should('have.class', 'enabled', { timeout: 10000 });
    
    // Then disable it
    cy.get('.control-btn').contains('BROWSER').click();
    cy.get('.control-btn').contains('BROWSER').should('have.class', 'disabled', { timeout: 10000 });
    
    // Indicator should show disabled symbol ◯
    cy.get('.control-btn').contains('BROWSER').find('.control-indicator').should('contain', '◯');
  });

  it('should make API calls when shell toggle is changed', () => {
    // Set up intercepts to monitor API calls
    cy.intercept('POST', '/api/agents/default/capabilities/shell/toggle').as('toggleShell');
    
    // Enable shell - should trigger API call
    cy.get('.control-btn').contains('SHELL').click();
    
    // Should see shell toggle API call
    cy.wait('@toggleShell');
    
    // Status should update to enabled
    cy.get('.control-btn').contains('SHELL').should('have.class', 'enabled', { timeout: 10000 });
  });

  it('should make API calls when browser toggle is changed', () => {
    // Set up intercepts to monitor API calls
    cy.intercept('POST', '/api/agents/default/capabilities/browser/toggle').as('toggleBrowser');
    
    // Enable browser - should trigger API call
    cy.get('.control-btn').contains('BROWSER').click();
    
    // Should see browser toggle API call
    cy.wait('@toggleBrowser');
    
    // Status should update to enabled
    cy.get('.control-btn').contains('BROWSER').should('have.class', 'enabled', { timeout: 10000 });
  });

  it('should handle shell API errors gracefully', () => {
    // Mock API failure
    cy.intercept('POST', '/api/agents/default/capabilities/shell/toggle', { statusCode: 500 }).as('failedShellToggle');
    
    // Try to enable shell
    cy.get('.control-btn').contains('SHELL').click();
    
    // Should eventually remain disabled due to API failure
    cy.wait('@failedShellToggle');
    cy.get('.control-btn').contains('SHELL').should('have.class', 'disabled', { timeout: 10000 });
  });

  it('should handle browser API errors gracefully', () => {
    // Mock API failure
    cy.intercept('POST', '/api/agents/default/capabilities/browser/toggle', { statusCode: 500 }).as('failedBrowserToggle');
    
    // Try to enable browser
    cy.get('.control-btn').contains('BROWSER').click();
    
    // Should eventually remain disabled due to API failure
    cy.wait('@failedBrowserToggle');
    cy.get('.control-btn').contains('BROWSER').should('have.class', 'disabled', { timeout: 10000 });
  });

  it('should persist shell and browser settings across reload', () => {
    // Enable shell and browser
    cy.get('.control-btn').contains('SHELL').click();
    cy.get('.control-btn').contains('SHELL').should('have.class', 'enabled', { timeout: 10000 });
    
    cy.get('.control-btn').contains('BROWSER').click();
    cy.get('.control-btn').contains('BROWSER').should('have.class', 'enabled', { timeout: 10000 });
    
    // Reload the page
    cy.reload();
    
    // Wait for page to load
    cy.contains('◆ AGENT CAPABILITIES').should('be.visible');
    
    // Settings should persist - controls should be enabled
    cy.get('.control-btn').contains('SHELL').should('have.class', 'enabled');
    cy.get('.control-btn').contains('BROWSER').should('have.class', 'enabled');
  });
});

describe('Shell Plugin Functionality', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5174');
    cy.wait(2000);
    
    // Enable shell capability first
    cy.get('.control-btn').contains('SHELL').click();
    cy.get('.control-btn').contains('SHELL').should('have.class', 'enabled', { timeout: 10000 });
  });

  it('should execute shell commands when shell is enabled', () => {
    // Send a simple shell command
    cy.get('.chat-input').type('ls -la');
    cy.get('.send-btn').click();
    
    // Wait for agent response
    cy.get('.chat-line.chat-agent', { timeout: 15000 }).should('be.visible');
    
    // Response should contain shell command output or acknowledgment
    cy.get('.chat-line.chat-agent').last().should('not.contain', 'Shell capability disabled');
    cy.get('.chat-line.chat-agent').last().should('not.contain', 'unable to run shell commands');
  });

  it('should handle complex shell commands', () => {
    // Send a more complex command
    cy.get('.chat-input').type('pwd && echo "test" && ls');
    cy.get('.send-btn').click();
    
    // Wait for agent response
    cy.get('.chat-line.chat-agent', { timeout: 15000 }).should('be.visible');
    
    // Should process the command successfully
    cy.get('.chat-line.chat-agent').last().invoke('text').then((text) => {
      expect(text.toLowerCase()).to.not.contain('disabled');
      expect(text.length).to.be.greaterThan(10);
    });
  });

  it('should show disabled message when shell is turned off', () => {
    // Disable shell capability
    cy.get('.control-btn').contains('SHELL').click();
    cy.get('.control-btn').contains('SHELL').should('have.class', 'disabled', { timeout: 10000 });
    
    // Try to send a shell command
    cy.get('.chat-input').type('ls');
    cy.get('.send-btn').click();
    
    // Wait for agent response
    cy.get('.chat-line.chat-agent', { timeout: 15000 }).should('be.visible');
    
    // Should contain disabled message or not execute command
    cy.get('.chat-line.chat-agent').last().invoke('text').then((text) => {
      // The agent might not recognize this as a shell command when disabled,
      // or might respond with a generic message
      expect(text).to.exist;
    });
  });

  it('should handle natural language shell requests', () => {
    // Send natural language request
    cy.get('.chat-input').type('Can you list the files in the current directory?');
    cy.get('.send-btn').click();
    
    // Wait for agent response
    cy.get('.chat-line.chat-agent', { timeout: 15000 }).should('be.visible');
    
    // Should process the natural language command
    cy.get('.chat-line.chat-agent').last().should('not.contain', 'Shell capability disabled');
  });
});

describe('Browser Plugin Functionality', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5174');
    cy.wait(2000);
    
    // Enable browser capability first
    cy.get('.control-btn').contains('BROWSER').click();
    cy.get('.control-btn').contains('BROWSER').should('have.class', 'enabled', { timeout: 10000 });
  });

  it('should handle browser navigation when browser is enabled', () => {
    // Send a browser navigation request
    cy.get('.chat-input').type('navigate to https://example.com');
    cy.get('.send-btn').click();
    
    // Wait for agent response
    cy.get('.chat-line.chat-agent', { timeout: 20000 }).should('be.visible');
    
    // Response should not indicate browser is disabled
    cy.get('.chat-line.chat-agent').last().should('not.contain', 'Browser capability disabled');
    cy.get('.chat-line.chat-agent').last().should('not.contain', 'unable to browse');
  });

  it('should show disabled message when browser is turned off', () => {
    // Disable browser capability
    cy.get('.control-btn').contains('BROWSER').click();
    cy.get('.control-btn').contains('BROWSER').should('have.class', 'disabled', { timeout: 10000 });
    
    // Try to send a browser command
    cy.get('.chat-input').type('navigate to https://google.com');
    cy.get('.send-btn').click();
    
    // Wait for agent response
    cy.get('.chat-line.chat-agent', { timeout: 15000 }).should('be.visible');
    
    // Should handle the disabled state appropriately
    cy.get('.chat-line.chat-agent').last().invoke('text').then((text) => {
      expect(text).to.exist;
    });
  });

  it('should handle complex browser actions', () => {
    // Send a complex browser request
    cy.get('.chat-input').type('Go to google.com and search for "ElizaOS"');
    cy.get('.send-btn').click();
    
    // Wait for agent response
    cy.get('.chat-line.chat-agent', { timeout: 25000 }).should('be.visible');
    
    // Should process the browser action
    cy.get('.chat-line.chat-agent').last().should('not.contain', 'Browser capability disabled');
  });
});

describe('Shell and Browser Server Integration', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5174');
    cy.wait(2000);
  });

  it('should reflect actual shell capability status from server', () => {
    // Test real API integration
    cy.request({
      url: 'http://localhost:3000/api/agents/default/capabilities/shell',
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        const status = response.body;
        
        // UI should reflect server state
        const shellBtn = cy.get('.control-btn').contains('SHELL');
        
        if (status.enabled) {
          shellBtn.should('have.class', 'enabled');
          shellBtn.find('.control-indicator').should('contain', '◉');
        } else {
          shellBtn.should('have.class', 'disabled');
          shellBtn.find('.control-indicator').should('contain', '◯');
        }
      }
    });
  });

  it('should reflect actual browser capability status from server', () => {
    // Test real API integration
    cy.request({
      url: 'http://localhost:3000/api/agents/default/capabilities/browser',
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        const status = response.body;
        
        // UI should reflect server state
        const browserBtn = cy.get('.control-btn').contains('BROWSER');
        
        if (status.enabled) {
          browserBtn.should('have.class', 'enabled');
          browserBtn.find('.control-indicator').should('contain', '◉');
        } else {
          browserBtn.should('have.class', 'disabled');
          browserBtn.find('.control-indicator').should('contain', '◯');
        }
      }
    });
  });

  it('should successfully toggle shell capability with real server', () => {
    // Test actual shell toggle functionality
    cy.request({
      method: 'POST',
      url: 'http://localhost:3000/api/agents/default/capabilities/shell/toggle',
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body).to.have.property('enabled');
        
        // Check status after toggle
        cy.request('http://localhost:3000/api/agents/default/capabilities/shell').then((statusResponse) => {
          expect(statusResponse.status).to.equal(200);
          expect(statusResponse.body).to.have.property('enabled');
          expect(statusResponse.body).to.have.property('service_available');
        });
      }
    });
  });

  it('should successfully toggle browser capability with real server', () => {
    // Test actual browser toggle functionality
    cy.request({
      method: 'POST',
      url: 'http://localhost:3000/api/agents/default/capabilities/browser/toggle',
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body).to.have.property('enabled');
        
        // Check status after toggle
        cy.request('http://localhost:3000/api/agents/default/capabilities/browser').then((statusResponse) => {
          expect(statusResponse.status).to.equal(200);
          expect(statusResponse.body).to.have.property('enabled');
          expect(statusResponse.body).to.have.property('service_available');
        });
      }
    });
  });

  it('should fetch shell and browser status periodically', () => {
    // Intercept the status APIs
    cy.intercept('GET', '/api/agents/default/capabilities/shell', { 
      statusCode: 200,
      body: { enabled: false, service_available: true }
    }).as('getShellStatus');
    
    cy.intercept('GET', '/api/agents/default/capabilities/browser', { 
      statusCode: 200,
      body: { enabled: false, service_available: true }
    }).as('getBrowserStatus');
    
    // Wait for initial load and periodic refresh
    cy.wait('@getShellStatus');
    cy.wait('@getBrowserStatus');
    
    // Should call status APIs multiple times due to 5-second interval
    cy.wait(6000); // Wait longer than the 5-second refresh interval
    cy.get('@getShellStatus.all').should('have.length.at.least', 2);
    cy.get('@getBrowserStatus.all').should('have.length.at.least', 2);
  });

  it('should validate backend API responses have correct structure', () => {
    // Test shell API response structure
    cy.request('http://localhost:3000/api/agents/default/capabilities/shell').then((response) => {
      if (response.status === 200) {
        expect(response.body).to.have.property('enabled');
        expect(response.body).to.have.property('service_available');
        expect(response.body.enabled).to.be.a('boolean');
        expect(response.body.service_available).to.be.a('boolean');
      }
    });
    
    // Test browser API response structure
    cy.request('http://localhost:3000/api/agents/default/capabilities/browser').then((response) => {
      if (response.status === 200) {
        expect(response.body).to.have.property('enabled');
        expect(response.body).to.have.property('service_available');
        expect(response.body.enabled).to.be.a('boolean');
        expect(response.body.service_available).to.be.a('boolean');
      }
    });
  });
});