describe('Permission Buttons Integration Test', () => {
  beforeEach(() => {
    // Start with all capabilities disabled
    cy.request('POST', 'http://localhost:7777/autonomy/disable');
    cy.visit('http://localhost:5173');
    cy.wait(5000); // Wait for app to load and fetch initial states
  });

  it('should have all permission buttons and they should be functional', () => {
    // Verify all buttons exist and show their states
    cy.get('[data-testid="autonomy-toggle"]').should('be.visible').and('contain.text', 'AUTO');
    cy.get('[data-testid="camera-toggle"]').should('be.visible').and('contain.text', 'CAM');
    cy.get('[data-testid="screen-toggle"]').should('be.visible').and('contain.text', 'SCR');
    cy.get('[data-testid="microphone-toggle"]').should('be.visible').and('contain.text', 'MIC');
    cy.get('[data-testid="speakers-toggle"]').should('be.visible').and('contain.text', 'SPK');
    cy.get('[data-testid="shell-toggle"]').should('be.visible').and('contain.text', 'SH');
    cy.get('[data-testid="browser-toggle"]').should('be.visible').and('contain.text', 'WWW');
  });

  it('should toggle autonomy capability and reflect changes in API', () => {
    // Initial state should be disabled (○)
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '○');
    
    // Verify API shows disabled state
    cy.request('GET', 'http://localhost:7777/autonomy/status')
      .then((response) => {
        expect(response.body.data.enabled).to.be.false;
      });
    
    // Click to enable
    cy.get('[data-testid="autonomy-toggle"]').click();
    cy.wait(3000); // Wait for API call to complete
    
    // UI should show enabled state (●)
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '●');
    
    // Verify API shows enabled state
    cy.request('GET', 'http://localhost:7777/autonomy/status')
      .then((response) => {
        expect(response.body.data.enabled).to.be.true;
        expect(response.body.data.running).to.be.true;
      });
    
    // Click to disable
    cy.get('[data-testid="autonomy-toggle"]').click();
    cy.wait(3000); // Wait for API call to complete
    
    // UI should show disabled state (○)
    cy.get('[data-testid="autonomy-toggle-status"]').should('contain.text', '○');
    
    // Verify API shows disabled state
    cy.request('GET', 'http://localhost:7777/autonomy/status')
      .then((response) => {
        expect(response.body.data.enabled).to.be.false;
        expect(response.body.data.running).to.be.false;
      });
  });

  it('should toggle camera capability', () => {
    // Initial state check
    cy.get('[data-testid="camera-toggle-status"]').should('contain.text', '○');
    
    // Click to enable camera
    cy.get('[data-testid="camera-toggle"]').click();
    cy.wait(3000); // Wait for API call to complete
    
    // UI should show enabled state
    cy.get('[data-testid="camera-toggle-status"]').should('contain.text', '●');
    
    // Verify via vision settings API
    cy.request('GET', 'http://localhost:7777/api/agents/default/settings/vision')
      .then((response) => {
        expect(response.body.data.ENABLE_CAMERA).to.eq('true');
      });
  });

  it('should toggle shell capability', () => {
    // Initial state check
    cy.get('[data-testid="shell-toggle-status"]').should('contain.text', '○');
    
    // Click to enable shell
    cy.get('[data-testid="shell-toggle"]').click();
    cy.wait(3000); // Wait for API call to complete
    
    // UI should show enabled state
    cy.get('[data-testid="shell-toggle-status"]').should('contain.text', '●');
    
    // Verify via shell capability API
    cy.request('GET', 'http://localhost:7777/api/agents/default/capabilities/shell')
      .then((response) => {
        expect(response.body.data.enabled).to.be.true;
      });
  });

  it('should show loading state during API calls', () => {
    // Click autonomy button and check for loading state
    cy.get('[data-testid="autonomy-toggle"]').click();
    
    // Should show "..." while loading (briefly)
    cy.get('[data-testid="autonomy-toggle"]').should('contain.text', '...');
    
    // Wait for API call to complete
    cy.wait(3000);
    
    // Should go back to normal text
    cy.get('[data-testid="autonomy-toggle"]').should('contain.text', 'AUTO');
  });
});