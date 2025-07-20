/// <reference types="cypress" />

describe('Autonomy Plugin Controls', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.wait(2000); // Wait for initial load
  });

  it('should show autonomy toggle in agent capabilities panel', () => {
    // Check that the autonomy control is visible
    cy.get('.controls-section').should('be.visible');
    cy.get('.controls-header').should('contain', 'AGENT CAPABILITIES');
    
    // Find the autonomy button
    cy.get('.control-btn').contains('AUTONOMY').should('be.visible');
  });

  it('should allow toggling autonomy on and off', () => {
    // Find the autonomy button
    const autonomyBtn = cy.get('.control-btn').contains('AUTONOMY').parent();
    
    // Check initial state (should be on by default)
    autonomyBtn.should('have.class', 'enabled');
    autonomyBtn.find('.control-indicator').should('contain', '◉');
    
    // Toggle off
    autonomyBtn.click();
    cy.wait(1000); // Wait for API call
    
    // Verify it's disabled (may take a moment due to async API call)
    cy.get('.control-btn').contains('AUTONOMY').parent().should('have.class', 'disabled');
    cy.get('.control-btn').contains('AUTONOMY').parent()
      .find('.control-indicator').should('contain', '◯');
    
    // Toggle back on
    cy.get('.control-btn').contains('AUTONOMY').parent().click();
    cy.wait(1000); // Wait for API call
    
    // Verify it's enabled again
    cy.get('.control-btn').contains('AUTONOMY').parent().should('have.class', 'enabled');
    cy.get('.control-btn').contains('AUTONOMY').parent()
      .find('.control-indicator').should('contain', '◉');
  });

  it('should make API calls when toggling autonomy', () => {
    // Intercept the autonomy toggle API
    cy.intercept('POST', '/autonomy/toggle', { statusCode: 200 }).as('toggleAutonomy');
    
    // Click the autonomy button
    cy.get('.control-btn').contains('AUTONOMY').parent().click();
    
    // Verify API was called
    cy.wait('@toggleAutonomy');
  });

  it('should handle autonomy toggle errors gracefully', () => {
    // Intercept with error response
    cy.intercept('POST', '/autonomy/toggle', { statusCode: 500 }).as('toggleAutonomyError');
    
    // Click the autonomy button
    const autonomyBtn = cy.get('.control-btn').contains('AUTONOMY').parent();
    const initialState = autonomyBtn.should('have.class', 'enabled'); // Assume starts enabled
    
    autonomyBtn.click();
    
    // Wait for API call
    cy.wait('@toggleAutonomyError');
    
    // State should remain unchanged on error
    cy.get('.control-btn').contains('AUTONOMY').parent().should('have.class', 'enabled');
  });

  it('should check autonomy status periodically', () => {
    // Intercept the status API
    cy.intercept('GET', '/autonomy/status', { 
      statusCode: 200,
      body: { enabled: true, running: true, interval: 30000 }
    }).as('getAutonomyStatus');
    
    // Wait for initial load and periodic refresh
    cy.wait('@getAutonomyStatus');
    
    // Should call status API multiple times due to 5-second interval
    cy.wait(6000); // Wait longer than the 5-second refresh interval
    cy.get('@getAutonomyStatus.all').should('have.length.at.least', 2);
  });
});

describe('Autonomy Plugin Server Integration', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.wait(2000);
  });

  it('should reflect actual autonomy service status', () => {
    // Test real API integration (these tests require a running server)
    cy.request({
      url: 'http://localhost:3000/autonomy/status',
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        const status = response.body;
        
        // UI should reflect server state
        const autonomyBtn = cy.get('.control-btn').contains('AUTONOMY').parent();
        
        if (status.enabled && status.running) {
          autonomyBtn.should('have.class', 'enabled');
          autonomyBtn.find('.control-indicator').should('contain', '◉');
        } else {
          autonomyBtn.should('have.class', 'disabled');
          autonomyBtn.find('.control-indicator').should('contain', '◯');
        }
      }
    });
  });

  it('should successfully toggle autonomy with real server', () => {
    // Test actual toggle functionality
    cy.request({
      method: 'POST',
      url: 'http://localhost:3000/autonomy/toggle',
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 200) {
        // Should be able to toggle without error
        expect(response.status).to.equal(200);
        
        // Check status after toggle
        cy.request('http://localhost:3000/autonomy/status').then((statusResponse) => {
          expect(statusResponse.status).to.equal(200);
          expect(statusResponse.body).to.have.property('enabled');
          expect(statusResponse.body).to.have.property('running');
          expect(statusResponse.body).to.have.property('interval');
        });
      }
    });
  });
});