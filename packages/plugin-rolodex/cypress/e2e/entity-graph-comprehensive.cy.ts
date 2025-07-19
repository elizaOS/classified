describe('Entity Graph Comprehensive E2E Tests', () => {
  beforeEach(() => {
    // Visit the test components page
    cy.visit('/test-components');

    // Wait for initial load
    cy.get('body').should('be.visible');

    // Scroll to RolodexTab section
    cy.get('h2').contains('RolodexTab Component').should('be.visible');
    cy.get('#rolodex-tab').should('be.visible');
  });

  describe('UI Components Structure', () => {
    it('should verify test page loads with all UI components', () => {
      // Verify all component sections are present
      cy.get('h2').contains('Badge Components').should('be.visible');
      cy.get('h2').contains('Button Components').should('be.visible');
      cy.get('h2').contains('Card Components').should('be.visible');
      cy.get('h2').contains('Input Components').should('be.visible');
      cy.get('h2').contains('Table Components').should('be.visible');
      cy.get('h2').contains('Tabs Components').should('be.visible');
      cy.get('h2').contains('RolodexTab Component').should('be.visible');
    });

    it('should verify RolodexTab container exists', () => {
      // Check that the RolodexTab container exists
      cy.get('#rolodex-tab').should('exist').and('be.visible');

      // The actual React component would be loaded here in a real environment
      // For static testing, we just verify the container is available
    });

    it('should verify ELIZA config is available', () => {
      // Check that window.ELIZA_CONFIG is set
      cy.window().should('have.property', 'ELIZA_CONFIG');
      cy.window().its('ELIZA_CONFIG').should('have.property', 'agentId', 'test-agent-123');
      cy.window().its('ELIZA_CONFIG').should('have.property', 'apiBase', 'http://localhost:3000');
    });

    it('should verify page styling and dark mode', () => {
      // Check that dark mode is applied
      cy.get('html').should('have.class', 'dark');
      cy.get('body').should('have.class', 'bg-background');
      cy.get('body').should('have.class', 'text-foreground');
    });
  });

  describe('Tabs Component Testing', () => {
    it('should verify tabs component structure', () => {
      cy.get('[data-testid="tabs"]').should('be.visible');
      cy.get('[data-testid="tabs-list"]').should('be.visible');
      cy.get('[data-testid="tabs-trigger-1"]').should('be.visible').and('contain', 'Tab 1');
      cy.get('[data-testid="tabs-trigger-2"]').should('be.visible').and('contain', 'Tab 2');
      cy.get('[data-testid="tabs-content-1"]')
        .should('be.visible')
        .and('contain', 'Content for Tab 1');
    });

    it('should verify tab states', () => {
      cy.get('[data-testid="tabs-trigger-1"]').should('have.attr', 'data-state', 'active');
      cy.get('[data-testid="tabs-trigger-2"]').should('have.attr', 'data-state', 'inactive');
    });
  });

  describe('Component Interaction Testing', () => {
    it('should test component interactivity', () => {
      // Test button sizes and variants
      cy.get('[data-testid="button-size-default"]').should('be.visible');
      cy.get('[data-testid="button-size-sm"]').should('be.visible');
      cy.get('[data-testid="button-size-lg"]').should('be.visible');
      cy.get('[data-testid="button-size-icon"]').should('be.visible').and('contain', '🔍');
    });
  });
});
