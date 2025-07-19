describe('Entity Graph E2E Tests', () => {
  beforeEach(() => {
    // Visit the test components page
    cy.visit('/test-components');

    // Wait for initial load
    cy.get('body').should('be.visible');
    cy.get('h2').contains('RolodexTab Component').should('be.visible');
  });

  it('displays test page structure correctly', () => {
    // Check that the page loads with expected components
    cy.get('h2').contains('Badge Components').should('be.visible');
    cy.get('h2').contains('Button Components').should('be.visible');
    cy.get('h2').contains('Table Components').should('be.visible');

    // Check that RolodexTab container exists
    cy.get('#rolodex-tab').should('exist');
  });

  it('tests basic UI components functionality', () => {
    // Test buttons
    cy.get('[data-testid="button-default"]').should('be.visible');
    cy.get('[data-testid="button-clickable"]').click();
    cy.get('[data-testid="click-count"]').should('contain', '1');

    // Test inputs
    cy.get('[data-testid="input-placeholder"]').should('have.attr', 'placeholder', 'Enter text...');

    // Test table
    cy.get('[data-testid="table"]').should('be.visible');
    cy.get('[data-testid="table-caption"]').should('contain', 'Test Caption');
  });

  it('verifies component accessibility', () => {
    // Check for proper button labeling
    cy.get('button').each(($el) => {
      cy.wrap($el).should('satisfy', (element) => {
        return element.text().trim() !== '' || element.attr('aria-label') || element.attr('title');
      });
    });
  });

  it('tests responsive design elements', () => {
    // Change viewport to test responsiveness
    cy.viewport(800, 600);
    cy.get('body').should('be.visible');

    // Restore viewport
    cy.viewport(1280, 720);
    cy.get('body').should('be.visible');
  });
});
