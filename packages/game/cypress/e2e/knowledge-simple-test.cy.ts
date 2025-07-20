describe('Simple Knowledge UI Test', () => {
  it('should load the game interface and navigate to Files tab', () => {
    // Visit the game interface with longer timeout
    cy.visit('/', { timeout: 30000 });
    
    // Wait for loading to complete and the actual game interface to appear
    cy.get('body').should('be.visible');
    
    // Wait for the terminal container to load (the main game interface)
    cy.get('[data-testid="game-interface"]', { timeout: 60000 }).should('be.visible');
    
    // Wait for connection status to show online
    cy.get('[data-testid="connection-status"]', { timeout: 30000 }).should('contain', 'ONLINE');
    
    // Navigate to Files tab
    cy.contains('FILES', { timeout: 15000 }).click();
    
    // Verify we're in the files tab by checking for the knowledge base header
    cy.contains('KNOWLEDGE BASE', { timeout: 15000 }).should('be.visible');
    
    cy.log('✅ Basic UI navigation to Files tab successful');
  });
});